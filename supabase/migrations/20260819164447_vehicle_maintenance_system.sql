-- Migration: Sistema de Manutenção de Veículos
-- Cria tabela vehicle_maintenance, adiciona colunas de alerta em veiculos
-- e trigger que sincroniza veiculos.status com manutenções abertas.

-- 1. Colunas de alerta em veiculos (próxima revisão por KM e por data)
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS proxima_revisao_km INTEGER,
  ADD COLUMN IF NOT EXISTS proxima_revisao_data DATE;

COMMENT ON COLUMN public.veiculos.proxima_revisao_km IS 'KM previsto para a próxima revisão preventiva (alerta)';
COMMENT ON COLUMN public.veiculos.proxima_revisao_data IS 'Data prevista para a próxima revisão preventiva (alerta)';

-- 2. Tabela principal de manutenções
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('preventiva','corretiva','revisao','troca_oleo','pneus','outro')),
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_andamento','concluida','cancelada')),
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  km_registrado INTEGER,
  custo NUMERIC(12,2) DEFAULT 0,
  oficina TEXT,
  responsavel TEXT,
  observacoes TEXT,
  -- Alerta: próxima revisão sugerida a partir desta manutenção
  proxima_revisao_km INTEGER,
  proxima_revisao_data DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_veiculo_id ON public.vehicle_maintenance(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_status ON public.vehicle_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_data_abertura ON public.vehicle_maintenance(data_abertura DESC);

ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS: mesma matriz do projeto (admin/diretoria/operador escrevem; financeiro só lê)
CREATE POLICY "vehicle_maintenance_select_by_categoria"
  ON public.vehicle_maintenance FOR SELECT TO authenticated
  USING (user_categoria() = any (array['administrador','diretoria','operador','financeiro']));

CREATE POLICY "vehicle_maintenance_insert_by_categoria"
  ON public.vehicle_maintenance FOR INSERT TO authenticated
  WITH CHECK (user_categoria() = any (array['administrador','diretoria','operador']));

CREATE POLICY "vehicle_maintenance_update_by_categoria"
  ON public.vehicle_maintenance FOR UPDATE TO authenticated
  USING (user_categoria() = any (array['administrador','diretoria','operador']))
  WITH CHECK (user_categoria() = any (array['administrador','diretoria','operador']));

CREATE POLICY "vehicle_maintenance_delete_by_categoria"
  ON public.vehicle_maintenance FOR DELETE TO authenticated
  USING (user_categoria() = any (array['administrador','diretoria','operador']));

-- Service role full access
CREATE POLICY "vehicle_maintenance_service_role_all"
  ON public.vehicle_maintenance FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Trigger de updated_at
CREATE OR REPLACE FUNCTION public.update_vehicle_maintenance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vehicle_maintenance_updated_at ON public.vehicle_maintenance;
CREATE TRIGGER trigger_vehicle_maintenance_updated_at
  BEFORE UPDATE ON public.vehicle_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_maintenance_updated_at();

-- 4. Função que sincroniza veiculos.status e colunas de alerta
--    quando uma manutenção é inserida/atualizada/excluída.
--    Regra:
--      - Se existir manutenção aberta/em_andamento para o veículo → status='manutencao'
--      - proxima_revisao_km/data = última manutenção concluída com valor definido
CREATE OR REPLACE FUNCTION public.sync_veiculo_maintenance_state(p_veiculo_id UUID)
RETURNS VOID AS $$
DECLARE
  v_has_open BOOLEAN;
  v_next_km INTEGER;
  v_next_data DATE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.vehicle_maintenance
    WHERE veiculo_id = p_veiculo_id
      AND status IN ('aberta','em_andamento')
  ) INTO v_has_open;

  -- Próxima revisão: pega a mais recente que tenha proxima_revisao_km/data definida
  SELECT proxima_revisao_km, proxima_revisao_data
  INTO v_next_km, v_next_data
  FROM public.vehicle_maintenance
  WHERE veiculo_id = p_veiculo_id
    AND proxima_revisao_km IS NOT NULL
  ORDER BY data_abertura DESC, created_at DESC
  LIMIT 1;

  -- Atualiza veiculos: status e alertas
  UPDATE public.veiculos
  SET
    status = CASE WHEN v_has_open THEN 'manutencao' ELSE status END,
    proxima_revisao_km = COALESCE(v_next_km, proxima_revisao_km),
    proxima_revisao_data = COALESCE(v_next_data, proxima_revisao_data),
    updated_at = NOW()
  WHERE id = p_veiculo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Triggers AFTER INSERT/UPDATE/DELETE em vehicle_maintenance
CREATE OR REPLACE FUNCTION public.vehicle_maintenance_after_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.sync_veiculo_maintenance_state(OLD.veiculo_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_veiculo_maintenance_state(NEW.veiculo_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_vehicle_maintenance_after_insert ON public.vehicle_maintenance;
CREATE TRIGGER trigger_vehicle_maintenance_after_insert
  AFTER INSERT ON public.vehicle_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_maintenance_after_trigger();

DROP TRIGGER IF EXISTS trigger_vehicle_maintenance_after_update ON public.vehicle_maintenance;
CREATE TRIGGER trigger_vehicle_maintenance_after_update
  AFTER UPDATE ON public.vehicle_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_maintenance_after_trigger();

DROP TRIGGER IF EXISTS trigger_vehicle_maintenance_after_delete ON public.vehicle_maintenance;
CREATE TRIGGER trigger_vehicle_maintenance_after_delete
  AFTER DELETE ON public.vehicle_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_maintenance_after_trigger();

-- 6. Realtime
ALTER TABLE public.vehicle_maintenance REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_maintenance;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.vehicle_maintenance IS 'Histórico de manutenções por veículo (preventiva, corretiva, revisão, troca de óleo, pneus)';
COMMENT ON FUNCTION public.sync_veiculo_maintenance_state IS 'Sincroniza veiculos.status e colunas de alerta com base nas manutenções abertas/concluídas';
