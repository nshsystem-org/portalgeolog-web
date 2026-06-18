-- =============================================================================
-- Migration: update_os_atomic_log_metadata
-- Data: 2026-06-17
-- =============================================================================
-- Objetivo: Fazer o log de update da OS guardar um resumo especifico do que
--           mudou, para aparecer no modal "Logs de Atendimento" e alimentar
--           as notificacoes com dados estruturados.
-- =============================================================================
-- DROP explícito da assinatura antiga (4 params) para evitar sobrecargas
-- duplicadas. CREATE OR REPLACE com assinatura diferente cria uma nova
-- sobrecarga em vez de substituir, o que quebra o roteamento do PostgREST.
DROP FUNCTION IF EXISTS public.update_os_atomic(uuid, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.update_os_atomic(
  p_os_id uuid,
  p_os_data jsonb,
  p_waypoints jsonb,
  p_operational_cycles jsonb DEFAULT '[]'::jsonb,
  p_log_metadata jsonb DEFAULT '{}'::jsonb
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
  v_log_description text;
  v_changed_sections text;
  v_changed_fields text;
BEGIN
  -- Actor do JWT (fonte da verdade, imune a spoofing)
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  IF p_log_metadata ? 'field_changes'
     AND jsonb_typeof(p_log_metadata->'field_changes') = 'array' THEN
    SELECT string_agg(item, ' • ')
      INTO v_changed_fields
    FROM (
      SELECT
        CASE
          WHEN COALESCE(change->>'action', '') = 'added' THEN
            CASE
              WHEN COALESCE(change->>'to', '') <> '' THEN
                COALESCE(change->>'field', 'Campo') || ': ' || change->>'to' || ' adicionado'
              ELSE
                COALESCE(change->>'field', 'Campo') || ' adicionado'
            END
          WHEN COALESCE(change->>'action', '') = 'removed' THEN
            CASE
              WHEN COALESCE(change->>'from', '') <> '' THEN
                COALESCE(change->>'field', 'Campo') || ': ' || change->>'from' || ' removido'
              ELSE
                COALESCE(change->>'field', 'Campo') || ' removido'
            END
          WHEN COALESCE(change->>'from', '') <> '' AND COALESCE(change->>'to', '') <> '' THEN
            COALESCE(change->>'field', 'Campo') || ': ' || change->>'from' || ' → ' || change->>'to'
          WHEN COALESCE(change->>'to', '') <> '' THEN
            COALESCE(change->>'field', 'Campo') || ': ' || change->>'to'
          ELSE
            COALESCE(change->>'field', 'Campo') || ' alterado'
        END AS item
      FROM jsonb_array_elements(p_log_metadata->'field_changes') AS change
    ) items
    WHERE item IS NOT NULL AND item <> '';
  END IF;

  IF p_log_metadata ? 'changed_sections'
     AND jsonb_typeof(p_log_metadata->'changed_sections') = 'array' THEN
    SELECT string_agg(section.value, ', ')
      INTO v_changed_sections
    FROM jsonb_array_elements_text(COALESCE(p_log_metadata->'changed_sections', '[]'::jsonb)) AS section(value);
  END IF;

  IF v_changed_fields IS NOT NULL AND v_changed_fields <> '' THEN
    v_log_description := format('Atualização: %s', v_changed_fields);
  ELSIF v_changed_sections IS NOT NULL AND v_changed_sections <> '' THEN
    v_log_description := format('Atualização em: %s', v_changed_sections);
  ELSE
    v_log_description := 'Dados de edição do atendimento';
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
    updated_at        = NOW()
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
    FROM jsonb_array_elements(p_operational_cycles) AS elem;
  END IF;

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
$$;

GRANT EXECUTE ON FUNCTION public.update_os_atomic(uuid, jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_os_atomic(uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;
