-- Migration: RPCs Atômicos para Processamento de KM do Motorista
-- Objetivo: Garantir transações atômicas para evitar inconsistência de dados

-- ============================================================================
-- 1. RPC: process_driver_km_start
-- Processa KM inicial do motorista de forma atômica
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_driver_km_start(
  p_os_id UUID,
  p_cycle_index INTEGER,
  p_km_initial NUMERIC,
  p_actor_name TEXT,
  p_message_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cycles JSONB;
  v_updated_cycles JSONB;
  v_cycle JSONB;
  v_result JSONB;
BEGIN
  -- 1. Buscar cycles atuais
  SELECT operational_cycles INTO v_cycles
  FROM public.ordens_servico
  WHERE id = p_os_id
  FOR UPDATE; -- Lock pessimista

  IF v_cycles IS NULL THEN
    v_cycles := '[]'::JSONB;
  END IF;

  -- 2. Atualizar o ciclo específico
  v_updated_cycles := '[]'::JSONB;
  
  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      -- Atualizar ciclo alvo
      v_cycle := jsonb_set(v_cycle, '{kmInitial}', to_jsonb(p_km_initial));
      v_cycle := jsonb_set(v_cycle, '{startedAt}', to_jsonb(NOW()::TEXT));
      v_cycle := jsonb_set(v_cycle, '{state}', to_jsonb('awaiting_finish'::TEXT));
      v_cycle := jsonb_set(v_cycle, '{acceptedAt}', to_jsonb(NOW()::TEXT), true);
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  -- 3. Atualizar OS com novo cycles e message_id (se fornecido)
  IF p_message_id IS NOT NULL THEN
    UPDATE public.ordens_servico
    SET 
      operational_cycles = v_updated_cycles,
      driver_flow_finish_message_id = p_message_id,
      updated_at = NOW()
    WHERE id = p_os_id;
  ELSE
    UPDATE public.ordens_servico
    SET 
      operational_cycles = v_updated_cycles,
      updated_at = NOW()
    WHERE id = p_os_id;
  END IF;

  -- 4. Registrar log de ação
  INSERT INTO public.os_action_logs (
    os_id,
    action_type,
    actor_type,
    actor_name,
    details,
    created_at
  ) VALUES (
    p_os_id,
    'km_start_recorded',
    'driver',
    p_actor_name,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmInitial', p_km_initial,
      'messageId', p_message_id
    ),
    NOW()
  );

  -- 5. Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'osId', p_os_id,
    'cycleIndex', p_cycle_index,
    'kmInitial', p_km_initial,
    'updatedCycles', v_updated_cycles
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. RPC: process_driver_km_finish
-- Processa KM final do motorista de forma atômica
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_driver_km_finish(
  p_os_id UUID,
  p_cycle_index INTEGER,
  p_km_final NUMERIC,
  p_actor_name TEXT,
  p_validate_km BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
  v_cycles JSONB;
  v_updated_cycles JSONB;
  v_cycle JSONB;
  v_km_initial NUMERIC;
  v_has_next_cycle BOOLEAN := false;
  v_next_cycle JSONB;
  v_result JSONB;
BEGIN
  -- 1. Buscar cycles atuais
  SELECT operational_cycles INTO v_cycles
  FROM public.ordens_servico
  WHERE id = p_os_id
  FOR UPDATE; -- Lock pessimista

  IF v_cycles IS NULL THEN
    RAISE EXCEPTION 'OS % não possui cycles operacionais', p_os_id;
  END IF;

  -- 2. Validar KM final vs inicial (se solicitado)
  IF p_validate_km THEN
    FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
    LOOP
      IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
        v_km_initial := COALESCE((v_cycle->>'kmInitial')::NUMERIC, 0);
        
        IF p_km_final <= v_km_initial THEN
          v_result := jsonb_build_object(
            'success', false,
            'error', 'INVALID_KM',
            'message', 'KM final deve ser maior que KM inicial',
            'kmInitial', v_km_initial,
            'kmFinal', p_km_final
          );
          RETURN v_result;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 3. Atualizar o ciclo específico e verificar próximo
  v_updated_cycles := '[]'::JSONB;
  
  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      -- Atualizar ciclo alvo
      v_cycle := jsonb_set(v_cycle, '{kmFinal}', to_jsonb(p_km_final));
      v_cycle := jsonb_set(v_cycle, '{finishedAt}', to_jsonb(NOW()::TEXT));
      v_cycle := jsonb_set(v_cycle, '{state}', to_jsonb('completed'::TEXT));
    ELSIF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index + 1 THEN
      -- Verificar se existe próximo ciclo
      IF (v_cycle->>'state')::TEXT NOT IN ('completed', 'cancelled') THEN
        v_has_next_cycle := true;
        v_next_cycle := v_cycle;
      END IF;
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  -- 4. Atualizar OS
  UPDATE public.ordens_servico
  SET 
    operational_cycles = v_updated_cycles,
    updated_at = NOW()
  WHERE id = p_os_id;

  -- 5. Registrar log de ação
  INSERT INTO public.os_action_logs (
    os_id,
    action_type,
    actor_type,
    actor_name,
    details,
    created_at
  ) VALUES (
    p_os_id,
    'km_finish_recorded',
    'driver',
    p_actor_name,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmFinal', p_km_final,
      'kmInitial', v_km_initial
    ),
    NOW()
  );

  -- 6. Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'osId', p_os_id,
    'cycleIndex', p_cycle_index,
    'kmFinal', p_km_final,
    'hasNextCycle', v_has_next_cycle,
    'nextCycle', v_next_cycle,
    'updatedCycles', v_updated_cycles
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. RPC: check_and_claim_flow_event
-- Verifica idempotência e reclama o evento de forma atômica
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_and_claim_flow_event(
  p_context_id TEXT,
  p_flow_type TEXT,
  p_os_id UUID,
  p_cycle_index INTEGER,
  p_km_value NUMERIC DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_existing_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Verificar se já foi processado
  SELECT id INTO v_existing_id
  FROM public.webhook_flow_events
  WHERE context_id = p_context_id
    AND flow_type = p_flow_type
  FOR UPDATE SKIP LOCKED; -- Evita deadlock

  IF v_existing_id IS NOT NULL THEN
    -- Já processado
    v_result := jsonb_build_object(
      'success', false,
      'alreadyProcessed', true,
      'eventId', v_existing_id
    );
    RETURN v_result;
  END IF;

  -- 2. Reclamar o evento (inserir registro)
  INSERT INTO public.webhook_flow_events (
    context_id,
    flow_type,
    os_id,
    cycle_index,
    km_value,
    payload,
    processed_at
  ) VALUES (
    p_context_id,
    p_flow_type,
    p_os_id,
    p_cycle_index,
    p_km_value,
    p_payload,
    NOW()
  )
  ON CONFLICT (context_id, flow_type) DO NOTHING
  RETURNING id INTO v_existing_id;

  IF v_existing_id IS NULL THEN
    -- Conflito de concorrência (outro processo inseriu primeiro)
    v_result := jsonb_build_object(
      'success', false,
      'alreadyProcessed', true,
      'eventId', NULL
    );
    RETURN v_result;
  END IF;

  -- 3. Evento reclamado com sucesso
  v_result := jsonb_build_object(
    'success', true,
    'alreadyProcessed', false,
    'eventId', v_existing_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RPC: check_rate_limit
-- Verifica e incrementa rate limit de forma atômica
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_phone TEXT,
  p_event_type TEXT,
  p_max_per_minute INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_result JSONB;
BEGIN
  -- 1. Definir janela (minuto atual)
  v_window_start := date_trunc('minute', NOW());

  -- 2. Incrementar contador ou criar novo
  INSERT INTO public.webhook_rate_limits (
    phone,
    event_type,
    count,
    window_start
  ) VALUES (
    p_phone,
    p_event_type,
    1,
    v_window_start
  )
  ON CONFLICT (phone, event_type, window_start)
  DO UPDATE SET count = webhook_rate_limits.count + 1
  RETURNING count INTO v_count;

  -- 3. Verificar se excedeu limite
  IF v_count > p_max_per_minute THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'limit', p_max_per_minute,
      'resetAt', v_window_start + INTERVAL '1 minute'
    );
  ELSE
    v_result := jsonb_build_object(
      'allowed', true,
      'count', v_count,
      'limit', p_max_per_minute,
      'resetAt', v_window_start + INTERVAL '1 minute'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. RPC: record_webhook_metric
-- Registra métrica de webhook de forma assíncrona
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_webhook_metric(
  p_event_type TEXT,
  p_os_id UUID DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO public.webhook_metrics (
    event_type,
    os_id,
    phone,
    duration_ms,
    success,
    error_message,
    metadata
  ) VALUES (
    p_event_type,
    p_os_id,
    p_phone,
    p_duration_ms,
    p_success,
    p_error_message,
    p_metadata
  )
  RETURNING id INTO v_metric_id;

  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.process_driver_km_start IS 'Processa KM inicial do motorista de forma atômica';
COMMENT ON FUNCTION public.process_driver_km_finish IS 'Processa KM final do motorista de forma atômica com validação';
COMMENT ON FUNCTION public.check_and_claim_flow_event IS 'Verifica e reclama evento de flow para garantir idempotência';
COMMENT ON FUNCTION public.check_rate_limit IS 'Verifica rate limit por telefone e tipo de evento';
COMMENT ON FUNCTION public.record_webhook_metric IS 'Registra métrica de performance do webhook';
