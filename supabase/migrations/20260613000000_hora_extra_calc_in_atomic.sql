-- Atualiza insert_os_atomic e update_os_atomic para incluir o cálculo de
-- hora extra na apuração de imposto e lucro.
--
-- Regras de negócio:
--   - R$ 50/h cobrado do cliente
--   - R$ 20/h repassado ao motorista
--   - Cobrança mínima: 1h (se hora_extra > '00:00')
--   - Acima de 1h: blocos de 30 min
--     - resto ≤ 15 min → arredonda pra baixo
--     - resto ≥ 16 min → arredonda pra cima
--
-- Exemplos:
--   00:01 → 60 min (1h) | 01:15 → 60 min | 01:16 → 90 min | 01:30 → 90 min
--   01:46 → 120 min | 02:15 → 120 min | 02:16 → 150 min

-- ─── Função auxiliar: converte hora_extra (text 'HH:MM') em minutos faturados ─

CREATE OR REPLACE FUNCTION public.calc_hora_extra_billed_minutes(p_hora_extra text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total_minutes integer;
  v_blocks integer;
  v_remainder integer;
  v_billed_blocks integer;
  v_billed_minutes integer;
BEGIN
  -- Retorna 0 se vazio ou nulo
  IF p_hora_extra IS NULL OR trim(p_hora_extra) = '' OR trim(p_hora_extra) = '00:00' THEN
    RETURN 0;
  END IF;

  -- Parse de HH:MM usando EXTRACT sobre interval
  v_total_minutes := (
    EXTRACT(HOUR FROM p_hora_extra::interval) * 60 +
    EXTRACT(MINUTE FROM p_hora_extra::interval)
  )::integer;

  IF v_total_minutes <= 0 THEN
    RETURN 0;
  END IF;

  -- Arredondamento em blocos de 30 min
  v_blocks     := v_total_minutes / 30;
  v_remainder  := v_total_minutes % 30;

  IF v_remainder > 15 THEN
    v_billed_blocks := v_blocks + 1;
  ELSE
    v_billed_blocks := v_blocks;
  END IF;

  -- Mínimo 1h (60 min)
  v_billed_minutes := GREATEST(v_billed_blocks * 30, 60);

  RETURN v_billed_minutes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_hora_extra_billed_minutes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_hora_extra_billed_minutes(text) TO service_role;

-- ─── insert_os_atomic ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.insert_os_atomic(
  p_os_data jsonb,
  p_waypoints jsonb DEFAULT '[]'::jsonb,
  p_operational_cycles jsonb DEFAULT '[]'::jsonb,
  p_actor_name text DEFAULT 'Sistema',
  p_actor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_os_id uuid;
  v_wp jsonb;
  v_passenger jsonb;
  v_cycle jsonb;
  v_wp_id uuid;
  v_position integer := 0;
  v_imposto_percentual numeric;
  v_v_bruto numeric;
  v_v_custo numeric;
  v_no_show boolean;
  v_no_show_percentual numeric;
  -- hora extra
  v_hora_extra_text text;
  v_billed_minutes integer;
  v_hora_extra_cliente numeric;
  v_hora_extra_motorista numeric;
  -- totais efetivos
  v_total_efetivo_cliente numeric;
  v_total_efetivo_motorista numeric;
  v_base_cobranca numeric;
  v_imposto numeric;
  v_lucro numeric;
BEGIN
  -- 1. Calcular valores financeiros
  v_v_bruto           := COALESCE((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo           := COALESCE((p_os_data->>'custo')::numeric, 0);
  v_no_show           := COALESCE((p_os_data->>'no_show')::boolean, false);
  v_no_show_percentual :=
    CASE
      WHEN v_no_show THEN COALESCE(NULLIF(p_os_data->>'no_show_percentual', '')::numeric, 100)
      ELSE NULL
    END;

  -- Hora extra
  v_hora_extra_text     := COALESCE(p_os_data->>'hora_extra', '');
  v_billed_minutes      := public.calc_hora_extra_billed_minutes(v_hora_extra_text);
  v_hora_extra_cliente  := (v_billed_minutes::numeric / 60) * 50;  -- R$ 50/h
  v_hora_extra_motorista := (v_billed_minutes::numeric / 60) * 20; -- R$ 20/h

  v_total_efetivo_cliente  := v_v_bruto + v_hora_extra_cliente;
  v_total_efetivo_motorista := v_v_custo + v_hora_extra_motorista;

  v_base_cobranca :=
    CASE
      WHEN v_no_show THEN v_total_efetivo_cliente * (COALESCE(v_no_show_percentual, 100) / 100)
      ELSE v_total_efetivo_cliente
    END;

  v_imposto_percentual := public.get_imposto_percentual_for_date(
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE)
  );

  v_imposto := v_base_cobranca * (v_imposto_percentual / 100);
  v_lucro   := v_base_cobranca - v_imposto - v_total_efetivo_motorista;

  -- 2. Inserir ordem de serviço
  INSERT INTO public.ordens_servico (
    protocolo,
    data,
    hora,
    hora_extra,
    no_show,
    no_show_percentual,
    os_number,
    cliente_id,
    solicitante,
    solicitante_id,
    centro_custo,
    centro_custo_id,
    motorista,
    driver_id,
    veiculo_id,
    valor_bruto,
    obs_financeiras,
    imposto,
    custo,
    lucro,
    status_operacional,
    status_financeiro,
    created_by,
    created_by_name
  ) VALUES (
    '',
    (p_os_data->>'data')::date,
    NULLIF(p_os_data->>'hora', ''),
    COALESCE(p_os_data->>'hora_extra', ''),
    v_no_show,
    CASE
      WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100)
      ELSE NULL
    END,
    COALESCE(p_os_data->>'os_number', ''),
    NULLIF(p_os_data->>'cliente_id', '')::uuid,
    COALESCE(p_os_data->>'solicitante', ''),
    NULLIF(p_os_data->>'solicitante_id', '')::uuid,
    COALESCE(p_os_data->>'centro_custo', ''),
    NULLIF(p_os_data->>'centro_custo_id', '')::uuid,
    COALESCE(p_os_data->>'motorista', ''),
    NULLIF(p_os_data->>'driver_id', '')::uuid,
    NULLIF(p_os_data->>'veiculo_id', '')::uuid,
    v_v_bruto,
    COALESCE(p_os_data->>'obs_financeiras', ''),
    v_imposto,
    v_v_custo,
    v_lucro,
    'Pendente',
    'Pendente',
    p_actor_id,
    p_actor_name
  )
  RETURNING id INTO v_os_id;

  -- 3. Inserir ciclos operacionais
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
        v_os_id,
        COALESCE((v_cycle->>'itineraryIndex')::integer, 0),
        COALESCE((v_cycle->>'sequenceOrder')::integer, 0),
        COALESCE(v_cycle->>'kind', 'itinerary'),
        COALESCE((v_cycle->>'ordinal')::integer, 1),
        COALESCE(NULLIF(v_cycle->>'title', ''), ''),
        COALESCE(v_cycle->>'state', 'pending'),
        NULLIF(v_cycle->>'messageSentAt', '')::timestamptz,
        NULLIF(v_cycle->>'acceptedAt', '')::timestamptz,
        NULLIF(v_cycle->>'startedAt', '')::timestamptz,
        NULLIF(v_cycle->>'finishedAt', '')::timestamptz,
        NULLIF(v_cycle->>'kmInitial', '')::integer,
        NULLIF(v_cycle->>'kmFinal', '')::integer
      );
    END LOOP;
  END IF;

  -- 4. Inserir waypoints, passageiros e comentários
  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' THEN
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
        v_os_id,
        v_position,
        COALESCE(v_wp->>'label', ''),
        NULLIF(v_wp->>'lat', '')::double precision,
        NULLIF(v_wp->>'lng', '')::double precision,
        COALESCE(v_wp->>'comment', ''),
        NULLIF(v_wp->>'itinerary_index', '')::integer,
        NULLIF(v_wp->>'hora', '')::time,
        NULLIF(v_wp->>'data', '')::date
      )
      RETURNING id INTO v_wp_id;

      IF jsonb_array_length(COALESCE(v_wp->'passengers', '[]'::jsonb)) > 0 THEN
        FOR v_passenger IN SELECT * FROM jsonb_array_elements(COALESCE(v_wp->'passengers', '[]'::jsonb))
        LOOP
          INSERT INTO public.os_waypoint_passengers (waypoint_id, passageiro_id)
          VALUES (v_wp_id, NULLIF(v_passenger->>'solicitante_id', '')::uuid);
        END LOOP;
      END IF;

      IF COALESCE(v_wp->>'comment', '') <> '' THEN
        INSERT INTO public.os_waypoint_comments (
          ordem_servico_id,
          waypoint_position,
          waypoint_label,
          comment
        ) VALUES (
          v_os_id,
          v_position,
          COALESCE(v_wp->>'label', ''),
          v_wp->>'comment'
        );
      END IF;

      v_position := v_position + 1;
    END LOOP;
  END IF;

  -- 5. Inserir log de criação
  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (v_os_id, 'create', 'Dados de cadastro do atendimento', p_actor_name, p_actor_id, '{}'::jsonb);

  RETURN v_os_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_os_atomic(jsonb, jsonb, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_os_atomic(jsonb, jsonb, jsonb, text, uuid) TO service_role;

-- ─── update_os_atomic ─────────────────────────────────────────────────────────

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
  v_v_bruto numeric;
  v_v_custo numeric;
  v_no_show boolean;
  v_no_show_percentual numeric;
  -- hora extra
  v_hora_extra_text text;
  v_billed_minutes integer;
  v_hora_extra_cliente numeric;
  v_hora_extra_motorista numeric;
  -- totais efetivos
  v_total_efetivo_cliente numeric;
  v_total_efetivo_motorista numeric;
  v_base_cobranca numeric;
  v_imposto_percentual numeric;
BEGIN
  v_v_bruto           := COALESCE((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo           := COALESCE((p_os_data->>'custo')::numeric, 0);
  v_no_show           := COALESCE((p_os_data->>'no_show')::boolean, false);
  v_no_show_percentual :=
    CASE
      WHEN v_no_show THEN COALESCE(NULLIF(p_os_data->>'no_show_percentual', '')::numeric, 100)
      ELSE NULL
    END;

  -- Hora extra
  v_hora_extra_text      := COALESCE(p_os_data->>'hora_extra', '');
  v_billed_minutes       := public.calc_hora_extra_billed_minutes(v_hora_extra_text);
  v_hora_extra_cliente   := (v_billed_minutes::numeric / 60) * 50;  -- R$ 50/h
  v_hora_extra_motorista := (v_billed_minutes::numeric / 60) * 20;  -- R$ 20/h

  v_total_efetivo_cliente  := v_v_bruto + v_hora_extra_cliente;
  v_total_efetivo_motorista := v_v_custo + v_hora_extra_motorista;

  v_base_cobranca :=
    CASE
      WHEN v_no_show THEN v_total_efetivo_cliente * (COALESCE(v_no_show_percentual, 100) / 100)
      ELSE v_total_efetivo_cliente
    END;

  v_imposto_percentual := public.get_imposto_percentual_for_date(
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE)
  );

  -- 1. Atualizar a ordem de serviço (cabeçalho)
  UPDATE public.ordens_servico SET
    data                = (p_os_data->>'data')::DATE,
    hora                = COALESCE(p_os_data->>'hora', ''),
    hora_extra          = COALESCE(p_os_data->>'hora_extra', ''),
    no_show             = v_no_show,
    no_show_percentual  = CASE
                            WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100)
                            ELSE NULL
                          END,
    os_number           = COALESCE(p_os_data->>'os_number', ''),
    cliente_id          = (p_os_data->>'cliente_id')::UUID,
    solicitante         = COALESCE(p_os_data->>'solicitante', ''),
    solicitante_id      = (p_os_data->>'solicitante_id')::UUID,
    centro_custo        = COALESCE(p_os_data->>'centro_custo', ''),
    centro_custo_id     = (p_os_data->>'centro_custo_id')::UUID,
    motorista           = COALESCE(p_os_data->>'motorista', ''),
    driver_id           = (p_os_data->>'driver_id')::UUID,
    veiculo_id          = (p_os_data->>'veiculo_id')::UUID,
    valor_bruto         = v_v_bruto,
    obs_financeiras     = COALESCE(p_os_data->>'obs_financeiras', ''),
    imposto             = v_base_cobranca * (v_imposto_percentual / 100),
    custo               = v_v_custo,
    lucro               = v_base_cobranca - (v_base_cobranca * (v_imposto_percentual / 100)) - v_total_efetivo_motorista,
    updated_at          = NOW()
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

  -- 6. Inserir novos waypoints em lote (bulk insert)
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

    -- 7. Inserir passageiros em lote (bulk insert)
    INSERT INTO public.os_waypoint_passengers (waypoint_id, passageiro_id)
    SELECT
      w.id,
      (pass->>'solicitante_id')::UUID
    FROM jsonb_array_elements(p_waypoints) WITH ORDINALITY AS wp(value, wp_idx)
    CROSS JOIN jsonb_array_elements(COALESCE(wp.value->'passengers', '[]'::jsonb)) AS pass
    JOIN public.os_waypoints w
      ON w.ordem_servico_id = p_os_id
     AND w.position = (wp_idx - 1)::integer;

    -- 8. Inserir comentários em lote (bulk insert)
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

GRANT EXECUTE ON FUNCTION update_os_atomic(UUID, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_os_atomic(UUID, JSONB, JSONB, JSONB) TO service_role;
