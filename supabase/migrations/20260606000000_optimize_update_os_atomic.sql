-- Otimiza a função update_os_atomic para bulk inserts e adiciona índices
-- nas tabelas filhas da OS para acelerar DELETEs e JOINs.

-- Índices para acelerar os DELETEs e JOINs por ordem_servico_id
CREATE INDEX IF NOT EXISTS idx_os_waypoints_ordem_servico_id
  ON public.os_waypoints (ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_os_waypoint_comments_ordem_servico_id
  ON public.os_waypoint_comments (ordem_servico_id);

-- Reescreve a função para usar bulk inserts (sem loops FOR um-a-um)
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

  -- 4. Deletar ciclos operacionais antigos
  DELETE FROM public.os_operational_cycles WHERE ordem_servico_id = p_os_id;

  -- 5. Recriar ciclos operacionais em lote (bulk insert)
  IF p_operational_cycles IS NOT NULL AND jsonb_typeof(p_operational_cycles) = 'array' THEN
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
    )
    SELECT
      p_os_id,
      COALESCE((value->>'itineraryIndex')::INTEGER, 0),
      COALESCE((value->>'sequenceOrder')::INTEGER, 0),
      COALESCE(value->>'kind', 'itinerary'),
      COALESCE((value->>'ordinal')::INTEGER, 1),
      COALESCE(NULLIF(value->>'title', ''), ''),
      COALESCE(value->>'state', 'pending'),
      NULLIF(value->>'messageSentAt', '')::timestamptz,
      NULLIF(value->>'acceptedAt', '')::timestamptz,
      NULLIF(value->>'startedAt', '')::timestamptz,
      NULLIF(value->>'finishedAt', '')::timestamptz,
      NULLIF(value->>'kmInitial', '')::INTEGER,
      NULLIF(value->>'kmFinal', '')::INTEGER
    FROM jsonb_array_elements(p_operational_cycles);
  END IF;

  -- 5. Inserir novos waypoints em lote (bulk insert)
  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' AND jsonb_array_length(p_waypoints) > 0 THEN
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
    )
    SELECT
      p_os_id,
      (ordinality - 1)::integer AS position,
      COALESCE(value->>'label', ''),
      (value->>'lat')::DOUBLE PRECISION,
      (value->>'lng')::DOUBLE PRECISION,
      COALESCE(value->>'comment', ''),
      (value->>'itinerary_index')::INTEGER,
      (value->>'hora')::TIME,
      (value->>'data')::DATE
    FROM jsonb_array_elements(p_waypoints) WITH ORDINALITY AS t(value, ordinality);

    -- 6. Inserir passageiros em lote (bulk insert)
    INSERT INTO public.os_waypoint_passengers (
      waypoint_id,
      passageiro_id
    )
    SELECT
      w.id,
      (pass->>'solicitante_id')::UUID
    FROM jsonb_array_elements(p_waypoints) WITH ORDINALITY AS wp(value, wp_idx)
    CROSS JOIN jsonb_array_elements(COALESCE(wp.value->'passengers', '[]'::jsonb)) AS pass
    JOIN public.os_waypoints w
      ON w.ordem_servico_id = p_os_id
      AND w.position = (wp_idx - 1)::integer;

    -- 7. Inserir comentários em lote (bulk insert)
    INSERT INTO public.os_waypoint_comments (
      ordem_servico_id,
      waypoint_position,
      waypoint_label,
      comment
    )
    SELECT
      p_os_id,
      w.position,
      COALESCE(wp.value->>'label', ''),
      wp.value->>'comment'
    FROM jsonb_array_elements(p_waypoints) WITH ORDINALITY AS wp(value, wp_idx)
    JOIN public.os_waypoints w
      ON w.ordem_servico_id = p_os_id
      AND w.position = (wp_idx - 1)::integer
    WHERE COALESCE(wp.value->>'comment', '') <> '';
  END IF;
END;
$$;

-- Conceder permissões para authenticated e service_role
GRANT EXECUTE ON FUNCTION update_os_atomic(UUID, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_os_atomic(UUID, JSONB, JSONB, JSONB) TO service_role;
