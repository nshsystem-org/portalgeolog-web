-- =============================================================================
-- Migration: fix_os_log_notification_trigger
-- Data: 2026-06-18
-- =============================================================================
-- Corrige "operator does not exist: text ->> unknown" em ambas as funções.
-- Causa: em PL/pgSQL, alias de jsonb_array_elements usado com ->> é resolvido
-- como TEXT. Solução: subquery explícita com value::jsonb.
-- Também remove o hotfix de disable do trigger e recria-o corretamente.
-- =============================================================================

DROP TRIGGER IF EXISTS notify_os_log_insert_trigger ON public.os_logs;

CREATE OR REPLACE FUNCTION public.handle_os_log_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_protocolo text;
  v_cliente_id uuid;
  v_avatar_url text;
  v_changed_sections text;
  v_updates text;
  v_action text;
  v_cycle_index integer;
  v_cycle_label text;
  v_km_value text;
  v_title text;
  v_message text;
  v_notification_type text;
  v_changed_fields_list jsonb;
BEGIN
  IF NEW.type NOT IN (
    'update', 'status_change', 'archive', 'unarchive',
    'driver_accept', 'driver_start', 'driver_finish', 'comment'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT protocolo, cliente_id
    INTO v_protocolo, v_cliente_id
  FROM public.ordens_servico
  WHERE id = NEW.os_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT avatar_url INTO v_avatar_url
  FROM public.user_roles WHERE id = NEW.actor_id;

  IF NEW.metadata IS NOT NULL AND jsonb_typeof(NEW.metadata) = 'object' THEN

    IF NEW.metadata ? 'changed_sections'
       AND jsonb_typeof(NEW.metadata->'changed_sections') = 'array' THEN
      SELECT string_agg(sec_elem.sec, ', ')
        INTO v_changed_sections
      FROM (
        SELECT value::text AS sec
        FROM jsonb_array_elements_text(COALESCE(NEW.metadata->'changed_sections', '[]'::jsonb))
      ) sec_elem;
    END IF;

    IF NEW.metadata ? 'updates'
       AND jsonb_typeof(NEW.metadata->'updates') = 'object' THEN
      v_updates := NULLIF(
        concat_ws(' | ',
          NULLIF((NEW.metadata->'updates'->>'operacional'), ''),
          NULLIF((NEW.metadata->'updates'->>'financeiro'), '')
        ), ''
      );
    END IF;

    IF NEW.metadata ? 'cycle_index' THEN
      BEGIN
        v_cycle_index := (NEW.metadata->>'cycle_index')::integer;
        v_cycle_label := format('no ciclo %s', v_cycle_index + 1);
      EXCEPTION WHEN OTHERS THEN v_cycle_label := NULL;
      END;
    END IF;

    IF NEW.metadata ? 'action' THEN
      v_action := NEW.metadata->>'action';
    END IF;

    IF NEW.metadata ? 'km_initial' THEN
      v_km_value := NEW.metadata->>'km_initial';
    ELSIF NEW.metadata ? 'km_final' THEN
      v_km_value := NEW.metadata->>'km_final';
    END IF;

    IF NEW.type = 'update'
       AND NEW.metadata ? 'field_changes'
       AND jsonb_typeof(NEW.metadata->'field_changes') = 'array'
       AND jsonb_array_length(NEW.metadata->'field_changes') > 0
    THEN
      SELECT COALESCE(jsonb_agg(label_val ORDER BY sort_order), '[]'::jsonb)
        INTO v_changed_fields_list
      FROM (
        SELECT label_val, MIN(sort_order) AS sort_order
        FROM (
          SELECT
            CASE
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) IN ('código os', 'os') THEN 'Código OS'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) IN ('solicitante responsável', 'solicitante vinculado', 'solicitante') THEN 'Solicitante'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'centro de custo' THEN 'Centro de Custo'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) IN ('motorista alocado', 'motorista vinculado', 'motorista') THEN 'Motorista'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'veículo de uso' THEN 'Veículo'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'valor bruto (r$)' THEN 'Valor'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'custo motorista (r$)' THEN 'Custo com Motorista'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'hora extra' THEN 'Hora Extra'
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'observações financeiras' THEN 'Observações Financeiras'
              ELSE NULL
            END AS label_val,
            CASE
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) IN ('código os', 'os') THEN 1
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) IN ('solicitante responsável', 'solicitante vinculado', 'solicitante') THEN 2
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'centro de custo' THEN 3
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) IN ('motorista alocado', 'motorista vinculado', 'motorista') THEN 4
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'veículo de uso' THEN 5
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'valor bruto (r$)' THEN 6
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'custo motorista (r$)' THEN 7
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'hora extra' THEN 8
              WHEN lower(COALESCE(fc_elem.fc->>'field', '')) = 'observações financeiras' THEN 9
              ELSE 100
            END AS sort_order
          FROM (
            SELECT value::jsonb AS fc
            FROM jsonb_array_elements(COALESCE(NEW.metadata->'field_changes', '[]'::jsonb))
          ) fc_elem
        ) mapped
        WHERE label_val IS NOT NULL
        GROUP BY label_val
      ) labels;
    END IF;

  END IF;

  CASE NEW.type
    WHEN 'update' THEN
      v_title := 'Atendimento atualizado';
      IF COALESCE(jsonb_array_length(v_changed_fields_list), 0) > 0 THEN
        v_message := format('Protocolo #%s Atualizações realizadas:',
          COALESCE(v_protocolo, NEW.os_id::text));
      ELSIF v_changed_sections IS NOT NULL THEN
        v_message := format('A OS %s recebeu uma atualização de %s. Itens alterados: %s.',
          COALESCE(v_protocolo, NEW.os_id::text),
          COALESCE(NEW.actor_name, 'Sistema'), v_changed_sections);
      ELSE
        v_message := format('A OS %s recebeu uma atualização de %s.',
          COALESCE(v_protocolo, NEW.os_id::text), COALESCE(NEW.actor_name, 'Sistema'));
      END IF;
      v_notification_type := 'info';
    WHEN 'status_change' THEN
      v_title := 'Status do atendimento atualizado';
      IF v_action = 'finish_all'
         OR COALESCE(v_updates, '') LIKE '%Finalizado%'
         OR (NEW.metadata IS NOT NULL AND NEW.metadata ? 'status_operacional'
             AND NEW.metadata->>'status_operacional' = 'Finalizado') THEN
        v_title := 'Atendimento finalizado';
        v_message := format('A OS %s foi finalizada com sucesso.', COALESCE(v_protocolo, NEW.os_id::text));
        v_notification_type := 'success';
      ELSIF v_action = 'revert_to_pending' THEN
        v_message := format('A OS %s retornou para status Pendente.', COALESCE(v_protocolo, NEW.os_id::text));
        v_notification_type := 'warning';
      ELSIF v_action = 'revert_to_accept' THEN
        v_message := format('A OS %s retornou para status Aceite.', COALESCE(v_protocolo, NEW.os_id::text));
        v_notification_type := 'warning';
      ELSIF v_updates IS NOT NULL THEN
        v_message := format('A OS %s teve o status atualizado: %s.',
          COALESCE(v_protocolo, NEW.os_id::text), v_updates);
        v_notification_type := 'warning';
      ELSE
        v_message := format('A OS %s teve o status atualizado.', COALESCE(v_protocolo, NEW.os_id::text));
        v_notification_type := 'warning';
      END IF;
    WHEN 'archive' THEN
      v_title := 'Atendimento arquivado';
      v_message := format('A OS %s foi arquivada com sucesso.', COALESCE(v_protocolo, NEW.os_id::text));
      v_notification_type := 'warning';
    WHEN 'unarchive' THEN
      v_title := 'Atendimento reaberto';
      v_message := format('A OS %s foi reaberta com sucesso.', COALESCE(v_protocolo, NEW.os_id::text));
      v_notification_type := 'success';
    WHEN 'driver_accept' THEN
      v_title := 'Motorista confirmou o atendimento';
      v_message := format('A OS %s foi aceita por %s%s.',
        COALESCE(v_protocolo, NEW.os_id::text),
        COALESCE(NEW.actor_name, 'Sistema'),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END);
      v_notification_type := 'info';
    WHEN 'driver_start' THEN
      v_title := 'Rota iniciada';
      v_message := format('A OS %s iniciou a rota%s%s.',
        COALESCE(v_protocolo, NEW.os_id::text),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END,
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM inicial %s', v_km_value) ELSE '' END);
      v_notification_type := 'info';
    WHEN 'driver_finish' THEN
      v_title := 'Rota finalizada';
      v_message := format('A OS %s finalizou a rota%s%s.',
        COALESCE(v_protocolo, NEW.os_id::text),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END,
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM final %s', v_km_value) ELSE '' END);
      v_notification_type := 'success';
    WHEN 'comment' THEN
      v_title := 'Novo comentário no atendimento';
      v_message := format('A OS %s recebeu um novo comentário.', COALESCE(v_protocolo, NEW.os_id::text));
      v_notification_type := 'info';
    ELSE
      RETURN NEW;
  END CASE;

  v_message := v_message || format(' [OS_ID:%s]', NEW.os_id);

  INSERT INTO public.app_notifications (
    type, title, message, target_audience, empresa_id,
    created_by, created_by_name, created_by_avatar_url, metadata
  )
  VALUES (
    v_notification_type, v_title, v_message, 'interno', v_cliente_id,
    NEW.actor_id, NEW.actor_name, v_avatar_url,
    jsonb_build_object('changed_fields_list', COALESCE(v_changed_fields_list, '[]'::jsonb))
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_os_log_insert_trigger
  AFTER INSERT ON public.os_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_os_log_notification();
