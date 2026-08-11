-- Adiciona caixa_conta_id dentro das funcoes RPC insert_os_atomic e update_os_atomic
-- para que a atribuicao da conta de caixa seja atomica com o resto da OS,
-- eliminando a necessidade de um UPDATE post-RPC no application layer.
--
-- Antes: o TS fazia rpc(insert_os_atomic) + .update({ caixa_conta_id }) separado.
--   Risco: se o segundo UPDATE falhasse, a OS ficava sem conta (estado inconsistente).
-- Agora: caixa_conta_id faz parte do INSERT/UPDATE transacional da funcao RPC.

-- ============================================================
-- 1. insert_os_atomic: adiciona caixa_conta_id ao INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_os_atomic(
  p_os_data jsonb,
  p_waypoints jsonb DEFAULT '[]'::jsonb,
  p_operational_cycles jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  v_no_show_fator numeric;
  v_hora_extra_text text;
  v_billed_minutes integer;
  v_hora_extra_cliente numeric;
  v_hora_extra_motorista numeric;
  v_base_cobranca numeric;
  v_repasse_efetivo numeric;
  v_imposto numeric;
  v_lucro numeric;
  v_actor_id uuid;
  v_actor_name text;
  v_tipo text;
  v_is_freelance boolean;
  v_status_op text;
  v_status_fin text;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  v_v_bruto := COALESCE((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo := COALESCE((p_os_data->>'custo')::numeric, 0);
  v_no_show := COALESCE((p_os_data->>'no_show')::boolean, false);
  v_no_show_percentual :=
    CASE
      WHEN v_no_show THEN COALESCE(NULLIF(p_os_data->>'no_show_percentual', '')::numeric, 100)
      ELSE NULL
    END;
  v_no_show_fator := COALESCE(v_no_show_percentual, 100) / 100;

  v_hora_extra_text := COALESCE(p_os_data->>'hora_extra', '');
  v_billed_minutes := public.calc_hora_extra_billed_minutes(v_hora_extra_text);
  v_hora_extra_cliente := (v_billed_minutes::numeric / 60) * 50;
  v_hora_extra_motorista := (v_billed_minutes::numeric / 60) * 20;

  IF v_no_show THEN
    v_base_cobranca := (v_v_bruto + v_hora_extra_cliente) * v_no_show_fator;
    v_repasse_efetivo := (v_v_custo + v_hora_extra_motorista) * v_no_show_fator;
  ELSE
    v_base_cobranca := v_v_bruto + v_hora_extra_cliente;
    v_repasse_efetivo := v_v_custo + v_hora_extra_motorista;
  END IF;

  v_imposto_percentual := public.get_imposto_percentual_for_date(
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE)
  );

  v_imposto := v_base_cobranca * (v_imposto_percentual / 100);
  v_lucro := v_base_cobranca - v_imposto - v_repasse_efetivo;

  v_tipo := COALESCE(NULLIF(p_os_data->>'tipo', ''), 'os');
  v_is_freelance := (v_tipo = 'freelance');

  IF v_tipo = 'rascunho' THEN
    v_status_op := 'Rascunho';
    v_status_fin := 'Rascunho';
  ELSE
    v_status_op := 'Pendente';
    v_status_fin := 'Pendente';
  END IF;

  INSERT INTO public.ordens_servico (
    protocolo, data, hora, hora_extra, no_show, no_show_percentual,
    os_number, cliente_id, solicitante, solicitante_id, centro_custo, centro_custo_id,
    motorista, driver_id, veiculo_id, valor_bruto, obs_financeiras,
    imposto, custo, lucro, status_operacional, status_financeiro,
    created_by, created_by_name, is_freelance, tipo,
    isento_valor_bruto, isento_custo, caixa_conta_id
  ) VALUES (
    '',
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE),
    NULLIF(p_os_data->>'hora', ''),
    COALESCE(p_os_data->>'hora_extra', ''),
    v_no_show,
    CASE WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100) ELSE NULL END,
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
    v_status_op,
    v_status_fin,
    v_actor_id,
    v_actor_name,
    v_is_freelance,
    v_tipo,
    COALESCE((p_os_data->>'isento_valor_bruto')::boolean, false),
    COALESCE((p_os_data->>'isento_custo')::boolean, false),
    NULLIF(p_os_data->>'caixa_conta_id', '')::uuid
  )
  RETURNING id INTO v_os_id;

  IF p_operational_cycles IS NOT NULL AND jsonb_typeof(p_operational_cycles) = 'array' THEN
    FOR v_cycle IN SELECT * FROM jsonb_array_elements(p_operational_cycles)
    LOOP
      INSERT INTO public.os_operational_cycles (
        ordem_servico_id, itinerary_index, sequence_order, kind, ordinal, title, state,
        message_sent_at, accepted_at, started_at, finished_at, km_initial, km_final
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

  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' THEN
    FOR v_wp IN SELECT * FROM jsonb_array_elements(p_waypoints)
    LOOP
      INSERT INTO public.os_waypoints (
        ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data
      ) VALUES (
        v_os_id, v_position,
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
          ordem_servico_id, waypoint_position, waypoint_label, comment
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

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (v_os_id, 'create', 'Dados de cadastro do atendimento', v_actor_name, v_actor_id, '{}'::jsonb);

  RETURN v_os_id;
END;
$function$;

-- ============================================================
-- 2. update_os_atomic: adiciona caixa_conta_id ao UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_os_atomic(
  p_os_id uuid,
  p_os_data jsonb,
  p_waypoints jsonb,
  p_operational_cycles jsonb DEFAULT '[]'::jsonb,
  p_log_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_v_bruto numeric;
  v_v_custo numeric;
  v_no_show boolean;
  v_no_show_percentual numeric;
  v_no_show_fator numeric;
  v_hora_extra_text text;
  v_billed_minutes integer;
  v_hora_extra_cliente numeric;
  v_hora_extra_motorista numeric;
  v_base_cobranca numeric;
  v_repasse_efetivo numeric;
  v_imposto_percentual numeric;
  v_actor_id uuid;
  v_actor_name text;
  v_log_description text;
  v_changed_sections text;
  v_changed_fields text;
  v_new_status text;
  v_tipo text;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  IF p_log_metadata IS NOT NULL
     AND jsonb_typeof(p_log_metadata) = 'object'
     AND p_log_metadata ? 'field_changes'
     AND jsonb_typeof(p_log_metadata->'field_changes') = 'array'
     AND jsonb_array_length(p_log_metadata->'field_changes') > 0
  THEN
    SELECT string_agg(v_item, ' | ')
      INTO v_changed_fields
    FROM (
      SELECT
        CASE
          WHEN COALESCE(fc_elem.fc->>'action', '') = 'added' THEN
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' adicionado'
          WHEN COALESCE(fc_elem.fc->>'action', '') = 'removed' THEN
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' removido'
          ELSE
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' alterado'
        END AS v_item
      FROM (
        SELECT value::jsonb AS fc
        FROM jsonb_array_elements(p_log_metadata->'field_changes')
      ) fc_elem
    ) mapped
    WHERE v_item IS NOT NULL AND v_item <> '';
  END IF;

  IF p_log_metadata IS NOT NULL
     AND jsonb_typeof(p_log_metadata) = 'object'
     AND p_log_metadata ? 'changed_sections'
     AND jsonb_typeof(p_log_metadata->'changed_sections') = 'array'
  THEN
    SELECT string_agg(sec_elem.sec, ', ')
      INTO v_changed_sections
    FROM (
      SELECT value::text AS sec
      FROM jsonb_array_elements_text(p_log_metadata->'changed_sections')
    ) sec_elem;
  END IF;

  IF v_changed_fields IS NOT NULL AND v_changed_fields <> '' THEN
    v_log_description := 'Atualizacao: ' || v_changed_fields;
  ELSIF v_changed_sections IS NOT NULL AND v_changed_sections <> '' THEN
    v_log_description := 'Atualizacao em: ' || v_changed_sections;
  ELSE
    v_log_description := 'Dados de edicao do atendimento';
  END IF;

  v_v_bruto := COALESCE((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo := COALESCE((p_os_data->>'custo')::numeric, 0);
  v_no_show := COALESCE((p_os_data->>'no_show')::boolean, false);
  v_no_show_percentual :=
    CASE
      WHEN v_no_show THEN COALESCE(NULLIF(p_os_data->>'no_show_percentual', ''), '100')::numeric
      ELSE NULL
    END;
  v_no_show_fator := COALESCE(v_no_show_percentual, 100) / 100;

  v_hora_extra_text := COALESCE(p_os_data->>'hora_extra', '');
  v_billed_minutes := public.calc_hora_extra_billed_minutes(v_hora_extra_text);
  v_hora_extra_cliente := (v_billed_minutes::numeric / 60) * 50;
  v_hora_extra_motorista := (v_billed_minutes::numeric / 60) * 20;

  IF v_no_show THEN
    v_base_cobranca := (v_v_bruto + v_hora_extra_cliente) * v_no_show_fator;
    v_repasse_efetivo := (v_v_custo + v_hora_extra_motorista) * v_no_show_fator;
  ELSE
    v_base_cobranca := v_v_bruto + v_hora_extra_cliente;
    v_repasse_efetivo := v_v_custo + v_hora_extra_motorista;
  END IF;

  v_imposto_percentual := public.get_imposto_percentual_for_date(
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE)
  );

  SELECT tipo INTO v_tipo FROM public.ordens_servico WHERE id = p_os_id;
  v_tipo := COALESCE(NULLIF(p_os_data->>'tipo', ''), v_tipo);
  IF v_tipo IS NULL OR v_tipo NOT IN ('os', 'freelance', 'rascunho') THEN
    v_tipo := 'os';
  END IF;

  UPDATE public.ordens_servico
  SET
    data                = (p_os_data->>'data')::date,
    hora                = NULLIF(p_os_data->>'hora', ''),
    hora_extra          = COALESCE(p_os_data->>'hora_extra', ''),
    no_show             = v_no_show,
    no_show_percentual  = CASE WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100) ELSE NULL END,
    os_number           = COALESCE(p_os_data->>'os_number', ''),
    cliente_id          = NULLIF(p_os_data->>'cliente_id', '')::uuid,
    solicitante         = COALESCE(p_os_data->>'solicitante', ''),
    solicitante_id      = NULLIF(p_os_data->>'solicitante_id', '')::uuid,
    centro_custo        = COALESCE(p_os_data->>'centro_custo', ''),
    centro_custo_id     = NULLIF(p_os_data->>'centro_custo_id', '')::uuid,
    motorista           = COALESCE(p_os_data->>'motorista', ''),
    driver_id           = NULLIF(p_os_data->>'driver_id', '')::uuid,
    veiculo_id          = NULLIF(p_os_data->>'veiculo_id', '')::uuid,
    valor_bruto         = v_v_bruto,
    obs_financeiras     = COALESCE(p_os_data->>'obs_financeiras', ''),
    imposto             = v_base_cobranca * (v_imposto_percentual / 100),
    custo               = v_v_custo,
    lucro               = v_base_cobranca - (v_base_cobranca * (v_imposto_percentual / 100)) - v_repasse_efetivo,
    tipo                = v_tipo,
    is_freelance        = (v_tipo = 'freelance'),
    isento_valor_bruto  = COALESCE((p_os_data->>'isento_valor_bruto')::boolean, false),
    isento_custo        = COALESCE((p_os_data->>'isento_custo')::boolean, false),
    caixa_conta_id      = NULLIF(p_os_data->>'caixa_conta_id', '')::uuid,
    updated_at          = NOW()
  WHERE id = p_os_id;

  DELETE FROM public.os_operational_cycles WHERE ordem_servico_id = p_os_id;

  IF p_operational_cycles IS NOT NULL AND jsonb_typeof(p_operational_cycles) = 'array' THEN
    INSERT INTO public.os_operational_cycles (
      ordem_servico_id, itinerary_index, sequence_order, kind, ordinal, title, state,
      message_sent_at, accepted_at, started_at, finished_at, km_initial, km_final
    )
    SELECT
      p_os_id,
      COALESCE((elem->>'itineraryIndex')::integer, 0),
      COALESCE((elem->>'sequenceOrder')::integer, 0),
      COALESCE(elem->>'kind', 'itinerary'),
      COALESCE((elem->>'ordinal')::integer, 1),
      COALESCE(NULLIF(elem->>'title', ''), ''),
      COALESCE(elem->>'state', 'pending'),
      NULLIF(elem->>'messageSentAt', '')::timestamptz,
      NULLIF(elem->>'acceptedAt', '')::timestamptz,
      NULLIF(elem->>'startedAt', '')::timestamptz,
      NULLIF(elem->>'finishedAt', '')::timestamptz,
      NULLIF(elem->>'kmInitial', '')::integer,
      NULLIF(elem->>'kmFinal', '')::integer
    FROM jsonb_array_elements(p_operational_cycles) AS elem_row(elem);
  END IF;

  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);
  UPDATE public.ordens_servico
  SET status_operacional = v_new_status, updated_at = NOW()
  WHERE id = p_os_id;

  DELETE FROM public.os_waypoints WHERE ordem_servico_id = p_os_id;

  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' THEN
    WITH inserted_waypoints AS (
      INSERT INTO public.os_waypoints (
        ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data
      )
      SELECT
        p_os_id,
        row_number() OVER () - 1,
        COALESCE(wp_row.elem->>'label', ''),
        NULLIF(wp_row.elem->>'lat', '')::double precision,
        NULLIF(wp_row.elem->>'lng', '')::double precision,
        COALESCE(wp_row.elem->>'comment', ''),
        NULLIF(wp_row.elem->>'itinerary_index', '')::integer,
        NULLIF(wp_row.elem->>'hora', '')::time,
        NULLIF(wp_row.elem->>'data', '')::date
      FROM jsonb_array_elements(p_waypoints) AS wp_row(elem)
      RETURNING id, position
    )
    INSERT INTO public.os_waypoint_passengers (waypoint_id, passageiro_id)
    SELECT iw.id, NULLIF(p_elem.pax->>'solicitante_id', '')::uuid
    FROM inserted_waypoints iw
    JOIN (
      SELECT
        (row_number() OVER () - 1)::integer AS pos,
        wp_row2.elem AS wp_elem
      FROM jsonb_array_elements(p_waypoints) AS wp_row2(elem)
    ) wp_pos ON iw.position = wp_pos.pos
    JOIN jsonb_array_elements(wp_pos.wp_elem->'passengers') AS p_elem(pax) ON true
    WHERE jsonb_array_length(COALESCE(wp_pos.wp_elem->'passengers', '[]'::jsonb)) > 0;
  END IF;

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (
    p_os_id,
    'update',
    v_log_description,
    v_actor_name,
    v_actor_id,
    COALESCE(p_log_metadata, '{}'::jsonb)
  );
END;
$function$;
