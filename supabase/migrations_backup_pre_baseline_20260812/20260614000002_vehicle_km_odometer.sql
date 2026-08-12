-- Migration: Odômetro Global de Veículos
-- Regra: o KM registrado em qualquer OS nunca pode ser menor que o último KM registrado do veículo

-- 1. Tabela principal de odômetro por veículo
CREATE TABLE IF NOT EXISTS public.vehicle_km_odometer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  last_km NUMERIC(12, 2) NOT NULL DEFAULT 0,
  last_km_type TEXT NOT NULL DEFAULT 'initial' CHECK (last_km_type IN ('initial','final')),
  last_os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  last_recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_km_odometer_unique_vehicle UNIQUE (veiculo_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_km_odometer_veiculo_id ON public.vehicle_km_odometer(veiculo_id);

ALTER TABLE public.vehicle_km_odometer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on vehicle_km_odometer"
  ON public.vehicle_km_odometer FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read vehicle_km_odometer"
  ON public.vehicle_km_odometer FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION update_vehicle_km_odometer_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_vehicle_km_odometer_updated_at
  BEFORE UPDATE ON public.vehicle_km_odometer
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_km_odometer_updated_at();

-- 2. Histórico de KM por veículo (rastreabilidade completa)
CREATE TABLE IF NOT EXISTS public.vehicle_km_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  km_value NUMERIC(12, 2) NOT NULL,
  km_type TEXT NOT NULL CHECK (km_type IN ('initial','final')),
  driver_name TEXT,
  recorded_via TEXT NOT NULL DEFAULT 'webhook' CHECK (recorded_via IN ('webhook','manual','import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_km_history_veiculo_id ON public.vehicle_km_history(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_km_history_os_id ON public.vehicle_km_history(os_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_km_history_created_at ON public.vehicle_km_history(created_at DESC);

ALTER TABLE public.vehicle_km_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on vehicle_km_history"
  ON public.vehicle_km_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read vehicle_km_history"
  ON public.vehicle_km_history FOR SELECT TO authenticated USING (true);

-- 3. RPC atômica: valida e atualiza o odômetro
CREATE OR REPLACE FUNCTION public.validate_and_update_vehicle_km(
  p_veiculo_id UUID,
  p_os_id UUID,
  p_km_value NUMERIC,
  p_km_type TEXT,  -- 'initial' ou 'final'
  p_driver_name TEXT DEFAULT NULL,
  p_recorded_via TEXT DEFAULT 'webhook'
)
RETURNS JSONB AS $$
DECLARE
  v_current_km NUMERIC;
  v_current_type TEXT;
BEGIN
  -- 1. Buscar odômetro atual com lock
  SELECT last_km, last_km_type INTO v_current_km, v_current_type
  FROM public.vehicle_km_odometer
  WHERE veiculo_id = p_veiculo_id
  FOR UPDATE;

  -- 2. Validar: novo KM nunca pode ser <= ao último registrado
  IF v_current_km IS NOT NULL AND p_km_value <= v_current_km THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'KM_BELOW_ODOMETER',
      'message', 'O KM informado (' || p_km_value || ') é menor ou igual ao último KM registrado para este veículo (' || v_current_km || '). Verifique o hodômetro.',
      'currentKm', v_current_km,
      'currentKmType', v_current_type,
      'rejectedKm', p_km_value
    );
  END IF;

  -- 3. Inserir ou atualizar odômetro
  INSERT INTO public.vehicle_km_odometer (veiculo_id, last_km, last_km_type, last_os_id, last_recorded_at)
  VALUES (p_veiculo_id, p_km_value, p_km_type, p_os_id, NOW())
  ON CONFLICT (veiculo_id) DO UPDATE SET
    last_km = EXCLUDED.last_km,
    last_km_type = EXCLUDED.last_km_type,
    last_os_id = EXCLUDED.last_os_id,
    last_recorded_at = NOW(),
    updated_at = NOW();

  -- 4. Gravar no histórico
  INSERT INTO public.vehicle_km_history (veiculo_id, os_id, km_value, km_type, driver_name, recorded_via)
  VALUES (p_veiculo_id, p_os_id, p_km_value, p_km_type, p_driver_name, p_recorded_via);

  -- 5. Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'veiculoId', p_veiculo_id,
    'kmValue', p_km_value,
    'kmType', p_km_type,
    'previousKm', v_current_km
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.vehicle_km_odometer IS 'Odometro global por veiculo: garante que nenhum KM registrado seja menor que o ultimo';
COMMENT ON TABLE public.vehicle_km_history IS 'Historico completo de KMs registrados por veiculo';
COMMENT ON FUNCTION public.validate_and_update_vehicle_km IS 'Valida e atualiza o odometro do veiculo de forma atomica';
