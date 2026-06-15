-- Migration: Fix RPCs de KM para usar a tabela correta de ciclos
-- Observação: ordens_servico é preservada; os ciclos vivem em os_operational_cycles

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
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle JSONB;
  v_target_found BOOLEAN := false;
  v_result JSONB;
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
        'sequenceOrder', sequence_order,
        'kind', kind,
        'ordinal', ordinal,
        'title', title,
        'state', state,
        'messageSentAt', message_sent_at,
        'acceptedAt', accepted_at,
        'startedAt', started_at,
        'finishedAt', finished_at,
        'kmInitial', km_initial,
        'kmFinal', km_final
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
      'error', 'NO_OPERATIONAL_CYCLES',
      'message', 'OS não possui ciclos operacionais cadastrados'
    );
  END IF;

  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      v_cycle := jsonb_set(v_cycle, '{kmInitial}', to_jsonb(p_km_initial), true);
      v_cycle := jsonb_set(v_cycle, '{startedAt}', to_jsonb(NOW()::TEXT), true);
      v_cycle := jsonb_set(v_cycle, '{state}', to_jsonb('awaiting_finish'::TEXT), true);
      v_cycle := jsonb_set(v_cycle, '{acceptedAt}', to_jsonb(NOW()::TEXT), true);
      v_target_found := true;
    END IF;

    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CYCLE_NOT_FOUND',
      'message', 'Ciclo operacional não encontrado para a OS informada',
      'cycleIndex', p_cycle_index
    );
  END IF;

  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  INSERT INTO public.os_logs (
    os_id,
    type,
    actor_name,
    description,
    metadata
  ) VALUES (
    p_os_id,
    'driver_start',
    p_actor_name,
    'KM inicial registrado via flow: ' || p_km_initial,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmInitial', p_km_initial,
      'messageId', p_message_id
    )
  );

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
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle JSONB;
  v_km_initial NUMERIC;
  v_has_next_cycle BOOLEAN := false;
  v_next_cycle JSONB;
  v_target_found BOOLEAN := false;
  v_result JSONB;
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
        'sequenceOrder', sequence_order,
        'kind', kind,
        'ordinal', ordinal,
        'title', title,
        'state', state,
        'messageSentAt', message_sent_at,
        'acceptedAt', accepted_at,
        'startedAt', started_at,
        'finishedAt', finished_at,
        'kmInitial', km_initial,
        'kmFinal', km_final
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
      'error', 'NO_OPERATIONAL_CYCLES',
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
            'success', false,
            'error', 'INVALID_KM',
            'message', 'KM final deve ser maior que KM inicial',
            'kmInitial', v_km_initial,
            'kmFinal', p_km_final
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  FOR v_cycle IN SELECT * FROM jsonb_array_elements(v_cycles)
  LOOP
    IF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index THEN
      v_cycle := jsonb_set(v_cycle, '{kmFinal}', to_jsonb(p_km_final), true);
      v_cycle := jsonb_set(v_cycle, '{finishedAt}', to_jsonb(NOW()::TEXT), true);
      v_cycle := jsonb_set(v_cycle, '{state}', to_jsonb('completed'::TEXT), true);
      v_target_found := true;
    ELSIF (v_cycle->>'itineraryIndex')::INTEGER = p_cycle_index + 1 THEN
      IF (v_cycle->>'state')::TEXT NOT IN ('completed', 'cancelled') THEN
        v_has_next_cycle := true;
        v_next_cycle := v_cycle;
      END IF;
    END IF;

    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CYCLE_NOT_FOUND',
      'message', 'Ciclo operacional não encontrado para a OS informada',
      'cycleIndex', p_cycle_index
    );
  END IF;

  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  INSERT INTO public.os_logs (
    os_id,
    type,
    actor_name,
    description,
    metadata
  ) VALUES (
    p_os_id,
    'driver_finish',
    p_actor_name,
    'KM final registrado via flow: ' || p_km_final,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmFinal', p_km_final,
      'kmInitial', v_km_initial
    )
  );

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
