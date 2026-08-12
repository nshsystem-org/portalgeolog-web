-- Atualiza a função atômica para persistir ciclos operacionais na nova tabela normalizada
-- Removendo dependência de colunas legadas da ordens_servico

CREATE OR REPLACE FUNCTION update_os_atomic(
  p_os_id UUID,
  p_os_data JSONB,
  p_waypoints JSONB,
  p_operational_cycles JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wp JSONB;
  v_passenger JSONB;
  v_cycle JSONB;
  v_wp_id UUID;
  v_position INTEGER := 0;
BEGIN
  -- 1. Atualizar a ordem de serviço (cabeçalho)
  UPDATE public.ordens_servico SET
    data = (p_os_data->>'data')::DATE,
    hora = COALESCE(p_os_data->>'hora', ''),
    hora_extra = COALESCE(p_os_data->>'hora_extra', ''),
    os_number = COALESCE(p_os_data->>'os_number', ''),
    cliente_id = (p_os_data->>'cliente_id')::UUID,
    solicitante = COALESCE(p_os_data->>'solicitante', ''),
    solicitante_id = (p_os_data->>'solicitante_id')::UUID,
    centro_custo = COALESCE(p_os_data->>'centro_custo', ''),
    centro_custo_id = (p_os_data->>'centro_custo_id')::UUID,
    motorista = COALESCE(p_os_data->>'motorista', ''),
    driver_id = (p_os_data->>'driver_id')::UUID,
    veiculo_id = (p_os_data->>'veiculo_id')::UUID,
    valor_bruto = COALESCE((p_os_data->>'valor_bruto')::NUMERIC, 0),
    obs_financeiras = COALESCE(p_os_data->>'obs_financeiras', ''),
    imposto = COALESCE((p_os_data->>'imposto')::NUMERIC, 0),
    custo = COALESCE((p_os_data->>'custo')::NUMERIC, 0),
    lucro = COALESCE((p_os_data->>'lucro')::NUMERIC, 0),
    updated_at = NOW()
  WHERE id = p_os_id;

  -- 2. Deletar waypoints antigos (cascade deleta passageiros)
  DELETE FROM public.os_waypoints WHERE ordem_servico_id = p_os_id;

  -- 3. Deletar comentários antigos
  DELETE FROM public.os_waypoint_comments WHERE ordem_servico_id = p_os_id;

  -- 4. Recriar ciclos operacionais na tabela normalizada
  DELETE FROM public.os_operational_cycles WHERE ordem_servico_id = p_os_id;

  IF p_operational_cycles IS NOT NULL AND jsonb_typeof(p_operational_cycles) = 'array' THEN
    FOR v_cycle IN SELECT * FROM jsonb_array_elements(p_operational_cycles)
    LOOP
      INSERT INTO public.os_operational_cycles (
        ordem_servico_id,
        itinerary_index,
        sequence_order,
        kind,
        ordinal,
        title,
        state,
        message_sent_at,
        accepted_at,
        started_at,
        finished_at,
        km_initial,
        km_final
      ) VALUES (
        p_os_id,
        COALESCE((v_cycle->>'itineraryIndex')::INTEGER, 0),
        COALESCE((v_cycle->>'sequenceOrder')::INTEGER, 0),
        COALESCE(v_cycle->>'kind', 'itinerary'),
        COALESCE((v_cycle->>'ordinal')::INTEGER, 1),
        COALESCE(NULLIF(v_cycle->>'title', ''), ''),
        COALESCE(v_cycle->>'state', 'pending'),
        NULLIF(v_cycle->>'messageSentAt', '')::timestamptz,
        NULLIF(v_cycle->>'acceptedAt', '')::timestamptz,
        NULLIF(v_cycle->>'startedAt', '')::timestamptz,
        NULLIF(v_cycle->>'finishedAt', '')::timestamptz,
        NULLIF(v_cycle->>'kmInitial', '')::INTEGER,
        NULLIF(v_cycle->>'kmFinal', '')::INTEGER
      );
    END LOOP;
  END IF;

  -- 5. Inserir novos waypoints com passageiros e comentários
  FOR v_wp IN SELECT * FROM jsonb_array_elements(p_waypoints)
  LOOP
    INSERT INTO public.os_waypoints (
      ordem_servico_id,
      position,
      label,
      lat,
      lng,
      comment,
      itinerary_index,
      hora,
      data
    ) VALUES (
      p_os_id,
      v_position,
      COALESCE(v_wp->>'label', ''),
      (v_wp->>'lat')::DOUBLE PRECISION,
      (v_wp->>'lng')::DOUBLE PRECISION,
      COALESCE(v_wp->>'comment', ''),
      (v_wp->>'itinerary_index')::INTEGER,
      (v_wp->>'hora')::TIME,
      (v_wp->>'data')::DATE
    )
    RETURNING id INTO v_wp_id;

    IF jsonb_array_length(COALESCE(v_wp->'passengers', '[]'::jsonb)) > 0 THEN
      FOR v_passenger IN SELECT * FROM jsonb_array_elements(COALESCE(v_wp->'passengers', '[]'::jsonb))
      LOOP
        INSERT INTO public.os_waypoint_passengers (
          waypoint_id,
          passageiro_id
        ) VALUES (
          v_wp_id,
          (v_passenger->>'solicitante_id')::UUID
        );
      END LOOP;
    END IF;

    IF COALESCE(v_wp->>'comment', '') <> '' THEN
      INSERT INTO public.os_waypoint_comments (
        ordem_servico_id,
        waypoint_position,
        waypoint_label,
        comment
      ) VALUES (
        p_os_id,
        v_position,
        COALESCE(v_wp->>'label', ''),
        v_wp->>'comment'
      );
    END IF;

    v_position := v_position + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION update_os_atomic(UUID, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_os_atomic(UUID, JSONB, JSONB, JSONB) TO service_role;
