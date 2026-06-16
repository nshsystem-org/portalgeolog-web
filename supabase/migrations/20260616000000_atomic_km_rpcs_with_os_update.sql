-- Migration: Atualização atômica de ordens_servico dentro das RPCs de KM
-- Elimina a janela de inconsistência onde a RPC de ciclos podia suceder
-- mas o UPDATE separado de status_operacional podia falhar.

-- ============================================================================
-- Helper: deriva status_operacional a partir dos ciclos atualizados na tabela
-- Espelha exatamente a lógica de deriveCyclesOperationalStatus() no TypeScript:
--   1. Qualquer ciclo "awaiting_finish" ou "awaiting_km_finish" → "Em Rota"
--   2. Qualquer ciclo "awaiting_accept", "awaiting_start" ou "awaiting_km_start" → "Aguardando"
--   3. Todos os ativos (não-cancelados) "completed" → "Finalizado"
--   4. Todos "cancelled" → "Cancelado"
--   5. Fallback → "Pendente"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.derive_os_operational_status_from_cycles(
  p_os_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_has_in_progress BOOLEAN;
  v_has_waiting     BOOLEAN;
  v_active_total    INTEGER;
  v_completed_total INTEGER;
BEGIN
  SELECT
    COALESCE(BOOL_OR(state IN ('awaiting_finish', 'awaiting_km_finish')), false),
    COALESCE(BOOL_OR(state IN ('awaiting_accept', 'awaiting_start', 'awaiting_km_start')), false),
    COUNT(*) FILTER (WHERE state <> 'cancelled'),
    COUNT(*) FILTER (WHERE state = 'completed')
  INTO v_has_in_progress, v_has_waiting, v_active_total, v_completed_total
  FROM public.os_operational_cycles
  WHERE ordem_servico_id = p_os_id;

  IF v_has_in_progress THEN RETURN 'Em Rota';   END IF;
  IF v_has_waiting     THEN RETURN 'Aguardando'; END IF;
  IF v_active_total > 0 AND v_active_total = v_completed_total THEN RETURN 'Finalizado'; END IF;
  IF v_active_total = 0 THEN RETURN 'Cancelado'; END IF;
  RETURN 'Pendente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- process_driver_km_start: agora também atualiza ordens_servico na mesma transação
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
  v_cycles         JSONB;
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle          JSONB;
  v_target_found   BOOLEAN := false;
  v_result         JSONB;
BEGIN
  WITH locked_cycles AS (
    SELECT *
    FROM public.os_operational_cycles
    WHERE ordem_servico_id = p_os_id
    ORDER BY sequence_order
    FOR UPDATE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'itineraryIndex', itinerary_index,
        'sequenceOrder',  sequence_order,
        'kind',           kind,
        'ordinal',        ordinal,
        'title',          title,
        'state',          state,
        'messageSentAt',  message_sent_at,
        'acceptedAt',     accepted_at,
        'startedAt',      started_at,
        'finishedAt',     finished_at,
        'kmInitial',      km_initial,
        'kmFinal',        km_final
      )
      ORDER BY sequence_order
    ),
    '[]'::JSONB
  )
  INTO v_cycles
  FROM locked_cycles;

  IF v_cycles IS NULL OR jsonb_array_length(v_cycles) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'NO_OPERATIONAL_CYCLES',
      'message', 'OS não possui ciclos operacionais cadastrados'
    );
  END IF;

  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      v_cycle := jsonb_set(v_cycle, '{kmInitial}',  to_jsonb(p_km_initial),        true);
      v_cycle := jsonb_set(v_cycle, '{startedAt}',  to_jsonb(NOW()::TEXT),          true);
      v_cycle := jsonb_set(v_cycle, '{state}',      to_jsonb('awaiting_finish'::TEXT), true);
      v_cycle := jsonb_set(v_cycle, '{acceptedAt}', to_jsonb(NOW()::TEXT),          true);
      v_target_found := true;
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'CYCLE_NOT_FOUND',
      'message',    'Ciclo operacional não encontrado para a OS informada',
      'cycleIndex', p_cycle_index
    );
  END IF;

  -- Atualiza os ciclos na tabela
  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  -- Atualiza ordens_servico na mesma transação (elimina janela de inconsistência)
  -- Após km_start sempre existe um ciclo awaiting_finish, portanto status = 'Em Rota'
  UPDATE public.ordens_servico
  SET
    status_operacional = 'Em Rota',
    route_started_at   = NOW(),
    route_started_km   = p_km_initial
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, actor_name, description, metadata)
  VALUES (
    p_os_id,
    'driver_start',
    p_actor_name,
    'KM inicial registrado via flow: ' || p_km_initial,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmInitial',  p_km_initial,
      'messageId',  p_message_id
    )
  );

  v_result := jsonb_build_object(
    'success',            true,
    'osId',               p_os_id,
    'cycleIndex',         p_cycle_index,
    'kmInitial',          p_km_initial,
    'statusOperacional',  'Em Rota',
    'updatedCycles',      v_updated_cycles
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- process_driver_km_finish: agora também atualiza ordens_servico na mesma transação
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_driver_km_finish(
  p_os_id       UUID,
  p_cycle_index INTEGER,
  p_km_final    NUMERIC,
  p_actor_name  TEXT,
  p_validate_km BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
  v_cycles         JSONB;
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle          JSONB;
  v_km_initial     NUMERIC;
  v_has_next_cycle BOOLEAN := false;
  v_next_cycle     JSONB;
  v_target_found   BOOLEAN := false;
  v_new_status     TEXT;
  v_result         JSONB;
BEGIN
  WITH locked_cycles AS (
    SELECT *
    FROM public.os_operational_cycles
    WHERE ordem_servico_id = p_os_id
    ORDER BY sequence_order
    FOR UPDATE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'itineraryIndex', itinerary_index,
        'sequenceOrder',  sequence_order,
        'kind',           kind,
        'ordinal',        ordinal,
        'title',          title,
        'state',          state,
        'messageSentAt',  message_sent_at,
        'acceptedAt',     accepted_at,
        'startedAt',      started_at,
        'finishedAt',     finished_at,
        'kmInitial',      km_initial,
        'kmFinal',        km_final
      )
      ORDER BY sequence_order
    ),
    '[]'::JSONB
  )
  INTO v_cycles
  FROM locked_cycles;

  IF v_cycles IS NULL OR jsonb_array_length(v_cycles) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'NO_OPERATIONAL_CYCLES',
      'message', 'OS não possui ciclos operacionais cadastrados'
    );
  END IF;

  IF p_validate_km THEN
    FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
    LOOP
      IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
        v_km_initial := COALESCE((v_cycle->>'kmInitial')::NUMERIC, 0);
        IF p_km_final <= v_km_initial THEN
          RETURN jsonb_build_object(
            'success',   false,
            'error',     'INVALID_KM',
            'message',   'KM final deve ser maior que KM inicial',
            'kmInitial', v_km_initial,
            'kmFinal',   p_km_final
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      v_cycle := jsonb_set(v_cycle, '{kmFinal}',    to_jsonb(p_km_final),    true);
      v_cycle := jsonb_set(v_cycle, '{finishedAt}', to_jsonb(NOW()::TEXT),    true);
      v_cycle := jsonb_set(v_cycle, '{state}',      to_jsonb('completed'::TEXT), true);
      v_target_found := true;
    ELSIF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index + 1 THEN
      IF (v_cycle->>'state')::TEXT NOT IN ('completed', 'cancelled') THEN
        v_has_next_cycle := true;
        v_next_cycle     := v_cycle;
      END IF;
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'CYCLE_NOT_FOUND',
      'message',    'Ciclo operacional não encontrado para a OS informada',
      'cycleIndex', p_cycle_index
    );
  END IF;

  -- Atualiza os ciclos na tabela
  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  -- Deriva o novo status a partir dos ciclos já atualizados (na mesma transação)
  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);

  -- Atualiza ordens_servico na mesma transação (elimina janela de inconsistência)
  UPDATE public.ordens_servico
  SET
    status_operacional = v_new_status,
    route_finished_at  = NOW(),
    route_finished_km  = p_km_final
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, actor_name, description, metadata)
  VALUES (
    p_os_id,
    'driver_finish',
    p_actor_name,
    'KM final registrado via flow: ' || p_km_final,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmFinal',    p_km_final,
      'kmInitial',  v_km_initial
    )
  );

  v_result := jsonb_build_object(
    'success',           true,
    'osId',              p_os_id,
    'cycleIndex',        p_cycle_index,
    'kmFinal',           p_km_final,
    'statusOperacional', v_new_status,
    'hasNextCycle',      v_has_next_cycle,
    'nextCycle',         v_next_cycle,
    'updatedCycles',     v_updated_cycles
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
