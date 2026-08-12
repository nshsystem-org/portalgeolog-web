-- =============================================================================
-- Migration: restore_driver_avatar_in_log_notification
-- Data: 2026-06-30
-- =============================================================================
-- Corrige regressão: as migrations 20260628000000 e 20260628000001 reescreveram
-- o trigger handle_os_log_notification sem o fallback que buscava o avatar do
-- motorista na tabela public.drivers. Como os logs driver_accept/driver_start/
-- driver_finish são inseridos com actor_id = NULL (motoristas não têm conta em
-- auth.users/user_roles), o SELECT em user_roles retornava NULL e a notificação
-- no sino ficava sem a foto do motorista (caía no fallback de letra inicial).
--
-- Esta migration:
--   1. Restaura o fallback no trigger: quando actor_id IS NULL, busca avatar_url
--      em public.drivers por nome (case-insensitive).
--   2. Backfill de os_logs.actor_avatar_url para logs de motorista antigos.
--   3. Backfill de app_notifications.created_by_avatar_url para notificações
--      de motorista antigas (created_by IS NULL).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cycle_ordinal_to_pt(ordinal integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE ordinal
    WHEN 1 THEN 'Primeiro'
    WHEN 2 THEN 'Segundo'
    WHEN 3 THEN 'Terceiro'
    WHEN 4 THEN 'Quarto'
    WHEN 5 THEN 'Quinto'
    WHEN 6 THEN 'Sexto'
    WHEN 7 THEN 'Sétimo'
    WHEN 8 THEN 'Oitavo'
    WHEN 9 THEN 'Nono'
    WHEN 10 THEN 'Décimo'
    ELSE ordinal::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_os_log_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_protocolo text;
  v_cliente_id uuid;
  v_tipo text;
  v_avatar_url text;
  v_changed_sections text;
  v_updates text;
  v_action text;
  v_cycle_index integer;
  v_cycle_label text;
  v_cycle_kind text;
  v_cycle_ordinal integer;
  v_cycle_desc text;
  v_km_value text;
  v_title text;
  v_message text;
  v_notification_type text;
  v_changed_fields_list jsonb;
BEGIN
  IF NEW.type NOT IN (
    'update', 'status_change', 'archive', 'unarchive',
    'driver_accept', 'driver_start', 'driver_finish', 'driver_notify', 'comment'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT protocolo, cliente_id, tipo
    INTO v_protocolo, v_cliente_id, v_tipo
  FROM public.ordens_servico
  WHERE id = NEW.os_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Rascunho: não gera notificações de log (sino fica silencioso)
  IF v_tipo = 'rascunho' THEN
    RETURN NEW;
  END IF;

  -- Avatar do autor: primeiro em user_roles (operadores do sistema)
  SELECT avatar_url INTO v_avatar_url
  FROM public.user_roles WHERE id = NEW.actor_id;

  -- Fallback: quando actor_id é NULL (ações do motorista), busca avatar na
  -- tabela drivers por nome (case-insensitive). Motoristas não têm conta em
  -- auth.users/user_roles, então o SELECT anterior retorna NULL.
  IF v_avatar_url IS NULL AND NEW.actor_id IS NULL AND NEW.actor_name IS NOT NULL THEN
    SELECT avatar_url INTO v_avatar_url
    FROM public.drivers
    WHERE LOWER(name) = LOWER(NEW.actor_name)
    LIMIT 1;
  END IF;

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
      EXCEPTION WHEN OTHERS THEN v_cycle_index := NULL;
      END;
    END IF;

    IF v_cycle_index IS NOT NULL THEN
      v_cycle_label := format('no ciclo %s', v_cycle_index + 1);
      SELECT kind, ordinal INTO v_cycle_kind, v_cycle_ordinal
      FROM public.os_operational_cycles
      WHERE ordem_servico_id = NEW.os_id AND itinerary_index = v_cycle_index
      LIMIT 1;
      IF v_cycle_kind IS NOT NULL THEN
        v_cycle_desc := format('%s %s',
          public.cycle_ordinal_to_pt(COALESCE(v_cycle_ordinal, v_cycle_index + 1)),
          CASE WHEN v_cycle_kind = 'return' THEN 'Retorno' ELSE 'Itinerário' END
        );
      END IF;
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
      v_title := 'Motorista visualizou os detalhes do atendimento';
      v_message := format('%s visualizou os detalhes do atendimento%s.',
        COALESCE(NEW.actor_name, 'Motorista'),
        CASE WHEN v_cycle_desc IS NOT NULL THEN format(' (%s)', v_cycle_desc) ELSE '' END);
      v_notification_type := 'info';
    WHEN 'driver_start' THEN
      v_title := 'Rota iniciada';
      v_message := format('%s iniciou a rota do %s%s.',
        COALESCE(NEW.actor_name, 'Motorista'),
        COALESCE(v_cycle_desc, format('Ciclo %s', COALESCE(v_cycle_index + 1, 1))),
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM inicial %s', v_km_value) ELSE '' END);
      v_notification_type := 'info';
    WHEN 'driver_finish' THEN
      v_title := 'Rota finalizada';
      v_message := format('%s finalizou a rota do %s%s.',
        COALESCE(NEW.actor_name, 'Motorista'),
        COALESCE(v_cycle_desc, format('Ciclo %s', COALESCE(v_cycle_index + 1, 1))),
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM final %s', v_km_value) ELSE '' END);
      v_notification_type := 'success';
    WHEN 'driver_notify' THEN
      v_title := 'Mensagem enviada ao motorista';
      v_message := format('%s enviou uma mensagem de serviço para o motorista %s.',
        COALESCE(NEW.actor_name, 'Sistema'),
        COALESCE(NULLIF(NEW.metadata->>'motorista', ''), 'Motorista'));
      v_notification_type := 'success';
    WHEN 'comment' THEN
      v_title := 'Novo comentário no atendimento';
      v_message := format('A OS %s recebeu um novo comentário.', COALESCE(v_protocolo, NEW.os_id::text));
      v_notification_type := 'info';
    ELSE
      RETURN NEW;
  END CASE;

  IF NEW.type != 'driver_notify' THEN
    v_message := v_message || format(' [OS_ID:%s]', NEW.os_id);
  END IF;

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

-- =============================================================================
-- Backfill: os_logs.actor_avatar_url para logs de motorista antigos
-- (actor_id IS NULL e actor_avatar_url IS NULL) buscando em drivers por nome.
-- =============================================================================
UPDATE public.os_logs l
SET actor_avatar_url = d.avatar_url
FROM public.drivers d
WHERE l.actor_id IS NULL
  AND l.actor_avatar_url IS NULL
  AND d.avatar_url IS NOT NULL
  AND LOWER(d.name) = LOWER(l.actor_name);

-- =============================================================================
-- Backfill: app_notifications.created_by_avatar_url para notificações de
-- motorista antigas (created_by IS NULL e created_by_avatar_url IS NULL).
-- =============================================================================
UPDATE public.app_notifications n
SET created_by_avatar_url = d.avatar_url
FROM public.drivers d
WHERE n.created_by IS NULL
  AND n.created_by_avatar_url IS NULL
  AND n.created_by_name IS NOT NULL
  AND d.avatar_url IS NOT NULL
  AND LOWER(d.name) = LOWER(n.created_by_name);
