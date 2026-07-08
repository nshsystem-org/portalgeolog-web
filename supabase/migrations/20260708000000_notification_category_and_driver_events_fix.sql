-- =============================================================================
-- Migration: notification_category_and_driver_events_fix
-- Data: 2026-07-08
-- =============================================================================
-- Contexto:
-- 1) O sino de notificações mistura eventos de sistema (novo atendimento,
--    repasse, docagem, etc.) com eventos de movimentação de motorista
--    (visualizou detalhes, iniciou rota, finalizou rota, mensagem enviada).
--    Isso dificulta a leitura do sino. Este patch adiciona a coluna
--    `category` em app_notifications para que o frontend separe os dois
--    fluxos em locais diferentes (sino = sistema, novo botão = motoristas).
--
-- 2) Regressão encontrada: a migration 20260705000001 (e mantida em
--    20260707120000) reduziu a lista de tipos tratados por
--    handle_os_log_notification() para
--    ('update','status_change','archive','unarchive','driver_accept',
--     'driver_start','driver_finish','comment'), perdendo os tipos
--    'driver_notify' (mensagem enviada ao motorista), 'driver_delivered'
--    (mensagem entregue) e 'driver_delay' (motorista em atraso) que haviam
--    sido adicionados em 20260618000004 / 20260621000000. Esses eventos
--    pararam de gerar notificação silenciosamente. Este patch restaura os
--    três tipos, preservando todo o restante da função (fallback de avatar
--    de motorista, repasse em lote, etc.) exatamente como está em produção.
--
-- Estratégia de categorização: linhas antigas permanecem 'sistema' (default),
-- então o novo dropdown de motoristas começa vazio e só recebe eventos
-- criados a partir deste deploy (comportamento pedido explicitamente).
-- =============================================================================

-- 1. Coluna de categoria
ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'sistema';

ALTER TABLE public.app_notifications
  DROP CONSTRAINT IF EXISTS app_notifications_category_check;

ALTER TABLE public.app_notifications
  ADD CONSTRAINT app_notifications_category_check
  CHECK (category IN ('sistema', 'motorista'));

CREATE INDEX IF NOT EXISTS idx_app_notifications_category_created_at
  ON public.app_notifications (category, created_at DESC);

-- 2. Trigger corrigido: restaura driver_notify/driver_delivered/driver_delay
--    e passa a gravar a categoria de cada notificação.
CREATE OR REPLACE FUNCTION public.handle_os_log_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_protocolo text;
  v_cliente_id uuid;
  v_motorista_nome text;
  v_avatar_url text;
  v_changed_sections text;
  v_updates text;
  v_action text;
  v_cycle_index integer;
  v_cycle_label text;
  v_km_value text;
  v_minutes_late integer;
  v_title text;
  v_message text;
  v_notification_type text;
  v_category text := 'sistema';
  v_detail text;
  v_details text[] := '{}'::text[];
  v_change jsonb;
  v_driver_name text;
  v_repasse_os_count integer;
  v_periodo text;
  v_attach_os_id boolean := true;
BEGIN
  IF NEW.type NOT IN (
    'update',
    'status_change',
    'archive',
    'unarchive',
    'driver_accept',
    'driver_start',
    'driver_finish',
    'driver_notify',
    'driver_delivered',
    'driver_delay',
    'comment'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT protocolo, cliente_id, motorista
    INTO v_protocolo, v_cliente_id, v_motorista_nome
  FROM public.ordens_servico
  WHERE id = NEW.os_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.metadata ? 'cliente_id' THEN
    BEGIN
      v_cliente_id := nullif(NEW.metadata->>'cliente_id', '')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  SELECT avatar_url
    INTO v_avatar_url
  FROM public.user_roles
  WHERE id = NEW.actor_id;

  -- Fallback de avatar do motorista: motoristas (driver_accept / driver_start /
  -- driver_finish / driver_notify / driver_delivered / driver_delay) não
  -- possuem conta em auth.users / user_roles, então NEW.actor_id é NULL.
  IF v_avatar_url IS NULL AND NEW.actor_id IS NULL AND NEW.actor_name IS NOT NULL AND NEW.actor_name <> '' THEN
    SELECT d.avatar_url
      INTO v_avatar_url
    FROM public.drivers d
    WHERE lower(d.name) = lower(NEW.actor_name)
      AND d.avatar_url IS NOT NULL
      AND d.avatar_url <> ''
    LIMIT 1;

    IF v_avatar_url IS NULL AND length(NEW.actor_name) >= 3 THEN
      SELECT d.avatar_url
        INTO v_avatar_url
      FROM public.drivers d
      WHERE lower(d.name) LIKE lower(NEW.actor_name) || '%'
        AND d.avatar_url IS NOT NULL
        AND d.avatar_url <> ''
        AND (
          SELECT count(*) FROM public.drivers d2
          WHERE lower(d2.name) LIKE lower(NEW.actor_name) || '%'
        ) = 1
      LIMIT 1;
    END IF;
  END IF;

  IF NEW.metadata ? 'changed_sections' AND jsonb_typeof(NEW.metadata->'changed_sections') = 'array' THEN
    SELECT string_agg(section.value, ', ')
      INTO v_changed_sections
    FROM jsonb_array_elements_text(coalesce(NEW.metadata->'changed_sections', '[]'::jsonb)) AS section(value);
  END IF;

  IF NEW.metadata ? 'field_changes' AND jsonb_typeof(NEW.metadata->'field_changes') = 'array' THEN
    FOR v_change IN SELECT value FROM jsonb_array_elements(NEW.metadata->'field_changes') AS value
    LOOP
      IF v_change->>'action' = 'added' THEN
        v_detail := format('Adicionou %s%s',
          v_change->>'field',
          CASE WHEN v_change->>'to' IS NOT NULL AND v_change->>'to' <> '' THEN format(': %s', v_change->>'to') ELSE '' END
        );
      ELSIF v_change->>'action' = 'removed' THEN
        v_detail := format('Removeu %s%s',
          v_change->>'field',
          CASE WHEN v_change->>'from' IS NOT NULL AND v_change->>'from' <> '' THEN format(': %s', v_change->>'from') ELSE '' END
        );
      ELSE
        v_detail := format('%s: %s → %s',
          v_change->>'field',
          coalesce(nullif(v_change->>'from', ''), '—'),
          coalesce(nullif(v_change->>'to', ''), '—')
        );
      END IF;
      v_details := array_append(v_details, v_detail);
    END LOOP;
  END IF;

  IF NEW.metadata ? 'updates' AND jsonb_typeof(NEW.metadata->'updates') = 'object' THEN
    v_updates := nullif(
      concat_ws(
        ' | ',
        nullif(NEW.metadata->'updates'->>'operacional', ''),
        nullif(NEW.metadata->'updates'->>'financeiro', '')
      ),
      ''
    );
  END IF;

  IF NEW.metadata ? 'cycle_index' THEN
    BEGIN
      v_cycle_index := (NEW.metadata->>'cycle_index')::integer;
      v_cycle_label := format('no ciclo %s', v_cycle_index + 1);
    EXCEPTION
      WHEN OTHERS THEN
        v_cycle_label := NULL;
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

  IF NEW.metadata ? 'minutes_late' THEN
    BEGIN
      v_minutes_late := (NEW.metadata->>'minutes_late')::integer;
    EXCEPTION
      WHEN OTHERS THEN
        v_minutes_late := NULL;
    END;
  END IF;

  CASE NEW.type
    WHEN 'update' THEN
      v_title := 'Atendimento atualizado';
      IF array_length(v_details, 1) > 0 THEN
        v_message := format(
          'A OS %s foi atualizada por %s. %s',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          array_to_string(v_details, ' | ')
        );
        IF length(v_message) > 330 THEN
          v_message := substring(v_message from 1 for 330) || '...';
        END IF;
      ELSIF v_changed_sections IS NOT NULL THEN
        v_message := format(
          'A OS %s recebeu uma atualização de %s. Itens alterados: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          v_changed_sections
        );
      ELSE
        v_message := format(
          'A OS %s recebeu uma atualização de %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
      END IF;
      v_notification_type := 'info';
    WHEN 'status_change' THEN
      IF v_action = 'repasse_lote_pago' OR coalesce(NEW.metadata->>'lote', 'false') = 'true' THEN
        SELECT name
          INTO v_driver_name
        FROM public.drivers
        WHERE id = nullif(NEW.metadata->>'driver_id', '')::uuid;

        v_repasse_os_count := coalesce(jsonb_array_length(coalesce(NEW.metadata->'os_ids', '[]'::jsonb)), 0);

        IF NEW.metadata ? 'data_inicio' AND NEW.metadata ? 'data_fim' THEN
          v_periodo := format(' no período %s a %s', NEW.metadata->>'data_inicio', NEW.metadata->>'data_fim');
        END IF;

        v_title := 'Repasse em lote registrado';
        v_message := format(
          'O repasse em lote do motorista %s foi marcado como pago%s%s.',
          coalesce(v_driver_name, nullif(NEW.metadata->>'driver_id', ''), 'Sistema'),
          CASE WHEN v_repasse_os_count > 0 THEN format(' (%s OS)', v_repasse_os_count) ELSE '' END,
          coalesce(v_periodo, '')
        );
        v_notification_type := 'success';
        v_attach_os_id := false;
      ELSIF v_action = 'finish_all' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'Todos os ciclos da OS %s foram finalizados por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
        v_notification_type := 'warning';
      ELSIF v_action = 'finish_cycle' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s foi finalizado manualmente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END
        );
        v_notification_type := 'warning';
      ELSIF v_action = 'revert_to_pending' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s foi revertido para pendente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END
        );
        v_notification_type := 'warning';
      ELSIF v_action = 'revert_to_accept' THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s voltou para aceite por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END
        );
        v_notification_type := 'warning';
      ELSIF v_updates IS NOT NULL THEN
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'A OS %s foi atualizada por %s. Status: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          v_updates
        );
        v_notification_type := 'warning';
      ELSE
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'A OS %s teve o status atualizado por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
        v_notification_type := 'warning';
      END IF;
    WHEN 'archive' THEN
      v_title := 'Atendimento arquivado';
      v_message := format(
        'A OS %s foi arquivada por %s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Sistema')
      );
      v_notification_type := 'warning';
    WHEN 'unarchive' THEN
      v_title := 'Atendimento reaberto';
      v_message := format(
        'A OS %s foi reaberta por %s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Sistema')
      );
      v_notification_type := 'success';
    WHEN 'driver_accept' THEN
      v_title := 'Motorista visualizou os detalhes do atendimento';
      v_message := format(
        '%s visualizou os detalhes do atendimento%s.',
        coalesce(NEW.actor_name, 'Motorista'),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END
      );
      v_notification_type := 'info';
      v_category := 'motorista';
    WHEN 'driver_start' THEN
      v_title := 'Rota iniciada';
      v_message := format(
        'A OS %s iniciou a rota%s%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END,
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM inicial %s', v_km_value) ELSE '' END
      );
      v_notification_type := 'info';
      v_category := 'motorista';
    WHEN 'driver_finish' THEN
      v_title := 'Rota finalizada';
      v_message := format(
        'A OS %s finalizou a rota%s%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' (%s)', v_cycle_label) ELSE '' END,
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM final %s', v_km_value) ELSE '' END
      );
      v_notification_type := 'success';
      v_category := 'motorista';
    WHEN 'driver_notify' THEN
      -- Título inclui o nome do motorista para o frontend extrair via regex
      -- e exibir com ícone de caminhão no dropdown de motoristas.
      v_title := format('Mensagem enviada ao motorista %s', coalesce(v_motorista_nome, ''));
      v_message := format(
        '%s enviou uma mensagem ao motorista %s.',
        coalesce(NEW.actor_name, 'Sistema'),
        coalesce(v_motorista_nome, 'Motorista')
      );
      v_notification_type := 'success';
      v_category := 'motorista';
    WHEN 'driver_delivered' THEN
      v_title := 'Mensagem entregue ao motorista';
      v_message := format(
        'Motorista %s visualizou a mensagem.',
        coalesce(NEW.actor_name, 'Motorista')
      );
      v_notification_type := 'success';
      v_category := 'motorista';
    WHEN 'driver_delay' THEN
      v_title := 'Motorista em atraso';
      v_message := format(
        'A OS %s (motorista %s) está atrasada há %s minuto(s) e ainda não iniciou%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Motorista'),
        coalesce(v_minutes_late::text, '?'),
        CASE WHEN v_cycle_label IS NOT NULL THEN format(' o %s', v_cycle_label) ELSE '' END
      );
      v_notification_type := 'warning';
      v_category := 'motorista';
    WHEN 'comment' THEN
      v_title := 'Novo comentário no atendimento';
      v_message := format('A OS %s recebeu um novo comentário.', coalesce(v_protocolo, NEW.os_id::text));
      v_notification_type := 'info';
    ELSE
      RETURN NEW;
  END CASE;

  IF v_attach_os_id THEN
    v_message := v_message || format(' [OS_ID:%s]', NEW.os_id);
  END IF;

  INSERT INTO public.app_notifications (
    type,
    title,
    message,
    target_audience,
    empresa_id,
    created_by,
    created_by_name,
    created_by_avatar_url,
    category
  )
  VALUES (
    v_notification_type,
    v_title,
    v_message,
    'interno',
    v_cliente_id,
    NEW.actor_id,
    NEW.actor_name,
    v_avatar_url,
    v_category
  );

  RETURN NEW;
END;
$function$;
