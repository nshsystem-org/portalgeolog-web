-- Migration: Sistema de Metas de Desempenho (Performance Goals)
-- Cria tabela performance_goals para metas configuráveis por entidade
-- (motorista, funcionário, parceiro, cliente).
-- As métricas derivadas (OS por motorista, tempo médio de rota, lucro por cliente etc.)
-- são calculadas em tempo real a partir de ordens_servico — sem alterar essa tabela.

CREATE TABLE IF NOT EXISTS public.performance_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Entidade alvo da meta
  entidade_tipo TEXT NOT NULL CHECK (entidade_tipo IN ('motorista','funcionario','parceiro','cliente','veiculo')),
  entidade_id UUID, -- FK opcional conforme o tipo (drivers, parceiros_servico, clientes, veiculos)
  entidade_nome TEXT NOT NULL, -- denormalizado para exibição mesmo se entidade for excluída
  -- Parâmetro / métrica
  parametro TEXT NOT NULL CHECK (parametro IN (
    'os_concluidas_mes',
    'taxa_conclusao',
    'tempo_medio_rota_min',
    'lucro_mes',
    'faturamento_mes',
    'custo_mes',
    'avaliacao_media',
    'pontualidade_percent',
    'sinistralidade_percent',
    'km_rodado_mes',
    'manutencoes_mes',
    'custom'
  )),
  parametro_label TEXT, -- rótulo amigável exibido na UI (especialmente para 'custom')
  -- Meta
  valor_meta NUMERIC(12,2) NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un', -- un, %, min, R$, km
  -- Período
  periodo TEXT NOT NULL DEFAULT 'mensal' CHECK (periodo IN ('semanal','mensal','trimestral','anual')),
  -- Vigência
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  -- Auditoria
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_goals_entidade ON public.performance_goals(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_performance_goals_parametro ON public.performance_goals(parametro);
CREATE INDEX IF NOT EXISTS idx_performance_goals_ativo ON public.performance_goals(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_performance_goals_periodo ON public.performance_goals(data_inicio DESC);

-- Constraints opcionais por tipo (só aplicamos se a tabela alvo existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='drivers') THEN
    ALTER TABLE public.performance_goals
      ADD CONSTRAINT fk_performance_goals_driver
      FOREIGN KEY (entidade_id) REFERENCES public.drivers(id) ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE public.performance_goals VALIDATE CONSTRAINT fk_performance_goals_driver;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clientes') THEN
    ALTER TABLE public.performance_goals
      ADD CONSTRAINT fk_performance_goals_cliente
      FOREIGN KEY (entidade_id) REFERENCES public.clientes(id) ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE public.performance_goals VALIDATE CONSTRAINT fk_performance_goals_cliente;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='veiculos') THEN
    ALTER TABLE public.performance_goals
      ADD CONSTRAINT fk_performance_goals_veiculo
      FOREIGN KEY (entidade_id) REFERENCES public.veiculos(id) ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE public.performance_goals VALIDATE CONSTRAINT fk_performance_goals_veiculo;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='parceiros_servico') THEN
    ALTER TABLE public.performance_goals
      ADD CONSTRAINT fk_performance_goals_parceiro
      FOREIGN KEY (entidade_id) REFERENCES public.parceiros_servico(id) ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE public.performance_goals VALIDATE CONSTRAINT fk_performance_goals_parceiro;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') THEN
    ALTER TABLE public.performance_goals
      ADD CONSTRAINT fk_performance_goals_funcionario
      FOREIGN KEY (entidade_id) REFERENCES public.user_roles(id) ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE public.performance_goals VALIDATE CONSTRAINT fk_performance_goals_funcionario;
  END IF;
END $$;

ALTER TABLE public.performance_goals ENABLE ROW LEVEL SECURITY;

-- RLS: admin/diretoria/operador/financeiro todos leem (todos os perfis têm acesso à página)
CREATE POLICY "performance_goals_select_by_categoria"
  ON public.performance_goals FOR SELECT TO authenticated
  USING (user_categoria() = any (array['administrador','diretoria','operador','financeiro']));

-- Escrita: admin/diretoria/operador (financeiro só visualiza)
CREATE POLICY "performance_goals_insert_by_categoria"
  ON public.performance_goals FOR INSERT TO authenticated
  WITH CHECK (user_categoria() = any (array['administrador','diretoria','operador']));

CREATE POLICY "performance_goals_update_by_categoria"
  ON public.performance_goals FOR UPDATE TO authenticated
  USING (user_categoria() = any (array['administrador','diretoria','operador']))
  WITH CHECK (user_categoria() = any (array['administrador','diretoria','operador']));

CREATE POLICY "performance_goals_delete_by_categoria"
  ON public.performance_goals FOR DELETE TO authenticated
  USING (user_categoria() = any (array['administrador','diretoria','operador']));

-- Service role full access
CREATE POLICY "performance_goals_service_role_all"
  ON public.performance_goals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_performance_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_performance_goals_updated_at ON public.performance_goals;
CREATE TRIGGER trigger_performance_goals_updated_at
  BEFORE UPDATE ON public.performance_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_performance_goals_updated_at();

-- Realtime
ALTER TABLE public.performance_goals REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_goals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.performance_goals IS 'Metas de desempenho configuráveis por entidade (motorista, funcionário, parceiro, cliente, veículo)';
