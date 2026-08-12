-- =============================================================================
-- Migration: add_is_freelance_to_os
-- Data: 2026-06-23
-- =============================================================================
-- Objetivo: Suportar OS do tipo "Freelance" — motoristas parceiros que fazem
--           atendimentos avulsos sem contar no repasse do parceiro.
--
-- Alterações:
--   1. ordens_servico → ADD COLUMN is_freelance BOOLEAN (não-destrutivo)
--   2. insert_os_atomic → lê is_freelance do payload e persiste na OS
--   3. update_os_atomic → preserva is_freelance existente se não informado
-- =============================================================================

-- ── 1. Adicionar coluna (IF NOT EXISTS = operação segura, sem dano a dados) ──
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS is_freelance BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. insert_os_atomic: inclui is_freelance no INSERT ───────────────────────
-- (corpo idêntico ao 20260613000003; única diferença: variável v_is_freelance
--  e o campo is_freelance nas listas de INSERT)
CREATE OR REPLACE FUNCTION public.insert_os_atomic(
  p_os_data jsonb,
  p_waypoints jsonb DEFAULT '[]'::jsonb,
  p_operational_cycles jsonb DEFAULT '[]'::jsonb
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
  v_is_freelance boolean;
BEGIN
  -- Actor do JWT
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

  -- is_freelance: default false se não informado no payload
  v_is_freelance := COALESCE((p_os_data->>'is_freelance')::boolean, false);

  INSERT INTO public.ordens_servico (
    protocolo, data, hora, hora_extra, no_show, no_show_percentual,
    os_number, cliente_id, solicitante, solicitante_id, centro_custo, centro_custo_id,
    motorista, driver_id, veiculo_id, valor_bruto, obs_financeiras,
    imposto, custo, lucro, status_operacional, status_financeiro,
    created_by, created_by_name, is_freelance
  ) VALUES (
    '',
    (p_os_data->>'data')::date,
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
    'Pendente',
    'Pendente',
    v_actor_id,
    v_actor_name,
    v_is_freelance
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
$$;

-- ── 3. update_os_atomic: preserva is_freelance se não informado no payload ───
-- (corpo idêntico ao 20260613000003; única diferença: linha is_freelance no SET)
CREATE OR REPLACE FUNCTION public.update_os_atomic(
  p_os_id uuid,
  p_os_data jsonb,
  p_waypoints jsonb,
  p_operational_cycles jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
BEGIN
  -- Actor do JWT (fonte da verdade, imune a spoofing)
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

  UPDATE public.ordens_servico
  SET
    data              = (p_os_data->>'data')::date,
    hora              = NULLIF(p_os_data->>'hora', ''),
    hora_extra        = COALESCE(p_os_data->>'hora_extra', ''),
    no_show           = v_no_show,
    no_show_percentual = CASE WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100) ELSE NULL END,
    os_number         = COALESCE(p_os_data->>'os_number', ''),
    cliente_id        = NULLIF(p_os_data->>'cliente_id', '')::uuid,
    solicitante       = COALESCE(p_os_data->>'solicitante', ''),
    solicitante_id    = NULLIF(p_os_data->>'solicitante_id', '')::uuid,
    centro_custo      = COALESCE(p_os_data->>'centro_custo', ''),
    centro_custo_id   = NULLIF(p_os_data->>'centro_custo_id', '')::uuid,
    motorista         = COALESCE(p_os_data->>'motorista', ''),
    driver_id         = NULLIF(p_os_data->>'driver_id', '')::uuid,
    veiculo_id        = NULLIF(p_os_data->>'veiculo_id', '')::uuid,
    valor_bruto       = v_v_bruto,
    obs_financeiras   = COALESCE(p_os_data->>'obs_financeiras', ''),
    imposto           = v_base_cobranca * (v_imposto_percentual / 100),
    custo             = v_v_custo,
    lucro             = v_base_cobranca - (v_base_cobranca * (v_imposto_percentual / 100)) - v_repasse_efetivo,
    -- is_freelance: só atualiza se explicitamente presente no payload;
    -- caso contrário preserva o valor atual (evita resetar na edição)
    is_freelance      = COALESCE((p_os_data->>'is_freelance')::boolean, is_freelance),
    updated_at        = NOW()
  WHERE id = p_os_id;

  -- Ciclos operacionais
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
    FROM jsonb_array_elements(p_operational_cycles) AS elem;
  END IF;

  -- Waypoints
  DELETE FROM public.os_waypoints WHERE ordem_servico_id = p_os_id;

  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' THEN
    WITH inserted_waypoints AS (
      INSERT INTO public.os_waypoints (
        ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data
      )
      SELECT
        p_os_id,
        row_number() OVER () - 1,
        COALESCE(elem->>'label', ''),
        NULLIF(elem->>'lat', '')::double precision,
        NULLIF(elem->>'lng', '')::double precision,
        COALESCE(elem->>'comment', ''),
        NULLIF(elem->>'itinerary_index', '')::integer,
        NULLIF(elem->>'hora', '')::time,
        NULLIF(elem->>'data', '')::date
      FROM jsonb_array_elements(p_waypoints) AS elem
      RETURNING id, position
    )
    INSERT INTO public.os_waypoint_passengers (waypoint_id, passageiro_id)
    SELECT iw.id, NULLIF(p_elem->>'solicitante_id', '')::uuid
    FROM inserted_waypoints iw,
         jsonb_array_elements(p_waypoints) WITH ORDINALITY AS wp(elem, idx)
    JOIN jsonb_array_elements(wp.elem->'passengers') AS p_elem ON true
    WHERE iw.position = (wp.idx - 1)::integer
      AND jsonb_array_length(COALESCE(wp.elem->'passengers', '[]'::jsonb)) > 0;
  END IF;

  -- Log de auditoria (fonte segura: JWT + user_roles)
  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (p_os_id, 'update', 'Dados de edição do atendimento', v_actor_name, v_actor_id, '{}'::jsonb);
END;
$$;
