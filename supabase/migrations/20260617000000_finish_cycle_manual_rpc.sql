-- Migration: RPC finish_cycle_manual
--
-- Finaliza um ciclo operacional manualmente pelo operador, sem exigir KM.
-- Regras:
--   - Se km_initial já existe: mantém, ignora km_final
--   - Se nenhum KM existe: finaliza sem KM
--   - Em ambos os casos: atualiza as DUAS tabelas de forma atômica
--     (os_operational_cycles + ordens_servico), idêntico ao fluxo WhatsApp.
--   - Preenche acceptedAt e startedAt se estiverem nulos (ciclo que não
--     passou pelo flow WhatsApp).
--   - Guard interno: rejeita ciclo já completed/cancelled.

CREATE OR REPLACE FUNCTION public.finish_cycle_manual(
  p_os_id       UUID,
  p_cycle_index INTEGER,
  p_actor_name  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycles         JSONB;
  v_updated_cycles JSONB := '[]'::JSONB;
  v_cycle          JSONB;
  v_km_initial     NUMERIC;
  v_target_found   BOOLEAN := false;
  v_new_status     TEXT;
  v_now            TIMESTAMPTZ := NOW();
BEGIN
  -- Lock atômico das linhas do ciclo para evitar race conditions
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

      -- Guard: não finalizar ciclo já concluído ou cancelado
      IF (v_cycle->>'state')::TEXT IN ('completed', 'cancelled') THEN
        RETURN jsonb_build_object(
          'success',          false,
          'error',            'ALREADY_FINISHED',
          'already_finished', true,
          'message',          'Este ciclo já está finalizado'
        );
      END IF;

      -- Capturar km_initial existente (pode ser null)
      v_km_initial := (v_cycle->>'kmInitial')::NUMERIC;

      -- Sempre: marcar completed + finishedAt
      v_cycle := jsonb_set(v_cycle, '{state}',      to_jsonb('completed'::TEXT), true);
      v_cycle := jsonb_set(v_cycle, '{finishedAt}', to_jsonb(v_now::TEXT),        true);

      -- Preencher timestamps ausentes (ciclo que não passou pelo fluxo WhatsApp)
      IF (v_cycle->>'acceptedAt') IS NULL THEN
        v_cycle := jsonb_set(v_cycle, '{acceptedAt}', to_jsonb(v_now::TEXT), true);
      END IF;
      IF (v_cycle->>'startedAt') IS NULL THEN
        v_cycle := jsonb_set(v_cycle, '{startedAt}', to_jsonb(v_now::TEXT), true);
      END IF;

      -- km_initial: manter o que já existe (não sobrescrever)
      -- km_final:   não definir (operador não informou)

      v_target_found := true;
    END IF;
    v_updated_cycles := v_updated_cycles || jsonb_build_array(v_cycle);
  END LOOP;

  IF NOT v_target_found THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'CYCLE_NOT_FOUND',
      'message',    'Ciclo operacional não encontrado',
      'cycleIndex', p_cycle_index
    );
  END IF;

  -- Persistir ciclos atualizados (mesma função usada pelo flow WhatsApp)
  PERFORM public.replace_os_operational_cycles(p_os_id, v_updated_cycles);

  -- Derivar novo status operacional igual ao fluxo WhatsApp
  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);

  -- Atualizar ordens_servico de forma idêntica ao process_driver_km_finish
  -- route_finished_at: sempre agora (operador está encerrando)
  -- route_started_at:  COALESCE para não sobrescrever se já foi preenchido pelo WhatsApp
  -- route_started_km e route_finished_km: manter o que já existe
  UPDATE public.ordens_servico
  SET
    status_operacional = v_new_status,
    route_finished_at  = v_now,
    route_started_at   = COALESCE(route_started_at, v_now),
    updated_at         = v_now
  WHERE id = p_os_id;

  -- Log de auditoria
  INSERT INTO public.os_logs (os_id, type, actor_name, description, metadata)
  VALUES (
    p_os_id,
    'status_change',
    p_actor_name,
    'Ciclo finalizado manualmente pelo operador' ||
      CASE WHEN v_km_initial IS NOT NULL
        THEN ' (km inicial registrado: ' || v_km_initial::TEXT || ', km final ignorado)'
        ELSE ' (sem KM registrado)'
      END,
    jsonb_build_object(
      'cycleIndex', p_cycle_index,
      'kmInitial',  v_km_initial,
      'hasKm',      v_km_initial IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'success',           true,
    'osId',              p_os_id,
    'cycleIndex',        p_cycle_index,
    'statusOperacional', v_new_status,
    'kmInitial',         v_km_initial,
    'updatedCycles',     v_updated_cycles
  );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.finish_cycle_manual(UUID, INTEGER, TEXT) TO service_role;
