-- =============================================================================
-- Migration: os_cycle_reminders
-- Data: 2026-06-21
-- =============================================================================
-- Adiciona tabela de controle de lembretes de ciclos operacionais e estende
-- o trigger de notificacoes para o tipo 'driver_delay' (atraso do motorista).
--
-- Objetivo: permitir envio de lembretes pré-horario e pos-atraso para motoristas
-- sem duplicar mensagens e notificar internos quando houver atraso critico.
-- =============================================================================

-- 1. Tabela de controle de lembretes enviados
CREATE TABLE IF NOT EXISTS public.os_cycle_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.os_operational_cycles(id) ON DELETE CASCADE,
  reminder_kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (cycle_id, reminder_kind)
);

COMMENT ON TABLE public.os_cycle_reminders IS
  'Controle de lembretes enviados por ciclo operacional (pre_start, post_start_5, post_start_30).';

CREATE INDEX IF NOT EXISTS idx_os_cycle_reminders_cycle_id
  ON public.os_cycle_reminders (cycle_id);

-- 2. Adiciona 'driver_delay' aos tipos validos de os_logs
ALTER TABLE public.os_logs DROP CONSTRAINT IF EXISTS os_logs_type_check;
ALTER TABLE public.os_logs ADD CONSTRAINT os_logs_type_check
  CHECK (type = ANY (ARRAY[
    'create'::text, 'update'::text, 'status_change'::text, 'archive'::text,
    'unarchive'::text, 'driver_accept'::text, 'driver_start'::text,
    'driver_finish'::text, 'driver_notify'::text, 'driver_delivered'::text,
    'passenger_notify'::text, 'passenger_confirm'::text, 'comment'::text,
    'driver_delay'::text
  ]));

-- 3. Estende o trigger de notificacao para driver_delay
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
  v_cycle_kind text;
  v_cycle_ordinal integer;
  v_cycle_desc text;
  v_km_value text;
  v_title text;
  v_message text;
  v_notification_type text;
  v_changed_fields_list jsonb;
  v_minutes_late integer;
  v_driver_id uuid;
  v_motorista_nome text;
  v_notif_metadata jsonb;
BEGIN
  IF NEW.type NOT IN (
    'update', 'status_change', 'archive', 'unarchive',
    'driver_accept', 'driver_start', 'driver_finish', 'driver_notify', 'driver_delivered', 'comment',
    'driver_delay'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT protocolo, cliente_id, driver_id, motorista
    INTO v_protocolo, v_cliente_id, v_driver_id, v_motorista_nome
  FROM public.ordens_servico
  WHERE id = NEW.os_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- 1. Tenta buscar avatar em user_roles (para internos)
  SELECT avatar_url INTO v_avatar_url
  FROM public.user_roles WHERE id = NEW.actor_id;

  -- 2. Se nao encontrou e ha driver_id, busca avatar na tabela drivers
  IF v_avatar_url IS NULL AND v_driver_id IS NOT NULL THEN
    SELECT avatar_url INTO v_avatar_url
    FROM public.drivers WHERE id = v_driver_id;
  ELSIF v_avatar_url IS NULL AND NEW.actor_id IS NULL THEN
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

    -- cycle_index (suporta tanto cycle_index quanto cycleIndex)
    IF NEW.metadata ? 'cycle_index' THEN
      BEGIN
        v_cycle_index := (NEW.metadata->>'cycle_index')::integer;
      EXCEPTION WHEN OTHERS THEN v_cycle_index := NULL;
      END;
    ELSIF NEW.metadata ? 'cycleIndex' THEN
      BEGIN
        v_cycle_index := (NEW.metadata->>'cycleIndex')::integer;
      EXCEPTION WHEN OTHERS THEN v_cycle_index := NULL;
      END;
    END IF;

    IF v_cycle_index IS NOT NULL THEN
      v_cycle_label := format('no ciclo %s', v_cycle_index + 1);
      -- Buscar kind e ordinal do ciclo na tabela os_operational_cycles
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
    ELSIF NEW.metadata ? 'kmInitial' THEN
      v_km_value := NEW.metadata->>'kmInitial';
    ELSIF NEW.metadata ? 'km_final' THEN
      v_km_value := NEW.metadata->>'km_final';
    ELSIF NEW.metadata ? 'kmFinal' THEN
      v_km_value := NEW.metadata->>'kmFinal';
    END IF;

    IF NEW.metadata ? 'minutes_late' THEN
      BEGIN
        v_minutes_late := (NEW.metadata->>'minutes_late')::integer;
      EXCEPTION WHEN OTHERS THEN v_minutes_late := NULL;
      END;
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

  v_notif_metadata := jsonb_build_object('changed_fields_list', COALESCE(v_changed_fields_list, '[]'::jsonb));
  IF v_cycle_kind IS NOT NULL THEN
    v_notif_metadata := v_notif_metadata || jsonb_build_object('cycle_kind', v_cycle_kind, 'cycle_ordinal', COALESCE(v_cycle_ordinal, v_cycle_index + 1));
  END IF;
  IF v_protocolo IS NOT NULL THEN
    v_notif_metadata := v_notif_metadata || jsonb_build_object('protocolo', v_protocolo);
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
      v_message := format('%s visualizou os detalhes do atendimento%s. [OS_ID:%s]',
        COALESCE(NEW.actor_name, 'Motorista'),
        CASE WHEN v_cycle_desc IS NOT NULL THEN format(' (%s)', v_cycle_desc) ELSE '' END,
        NEW.os_id);
      v_notification_type := 'info';
    WHEN 'driver_start' THEN
      v_title := 'Rota iniciada';
      v_message := format('%s iniciou a rota do %s%s. [OS_ID:%s]',
        COALESCE(NEW.actor_name, 'Motorista'),
        COALESCE(v_cycle_desc, format('Ciclo %s', COALESCE(v_cycle_index + 1, 1))),
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM inicial %s', v_km_value) ELSE '' END,
        NEW.os_id);
      v_notification_type := 'info';
    WHEN 'driver_finish' THEN
      v_title := 'Rota finalizada';
      v_message := format('%s finalizou a rota do %s%s. [OS_ID:%s]',
        COALESCE(NEW.actor_name, 'Motorista'),
        COALESCE(v_cycle_desc, format('Ciclo %s', COALESCE(v_cycle_index + 1, 1))),
        CASE WHEN v_km_value IS NOT NULL THEN format(' com KM final %s', v_km_value) ELSE '' END,
        NEW.os_id);
      v_notification_type := 'success';
    WHEN 'driver_notify' THEN
      -- Título inclui o nome do motorista para o frontend extrair via regex
      -- e exibir com ícone de caminhão no sino de notificações
      v_title := format('Mensagem enviada ao motorista %s', COALESCE(v_motorista_nome, ''));
      v_message := format('%s enviou uma mensagem ao motorista %s. [OS_ID:%s]',
        COALESCE(NEW.actor_name, 'Sistema'),
        COALESCE(v_motorista_nome, 'Motorista'),
        NEW.os_id);
      v_notification_type := 'success';
    WHEN 'driver_delivered' THEN
      v_title := 'Mensagem entregue ao motorista';
      v_message := format('Motorista %s visualizou a mensagem. [OS_ID:%s]',
        COALESCE(NEW.actor_name, 'Motorista'), NEW.os_id);
      v_notification_type := 'success';
    WHEN 'driver_delay' THEN
      v_title := 'Motorista em atraso';
      v_message := format('A OS %s (motorista %s) está atrasada há %s minuto(s) e ainda não iniciou%s. [OS_ID:%s]',
        COALESCE(v_protocolo, NEW.os_id::text),
        COALESCE(NEW.actor_name, 'Motorista'),
        COALESCE(v_minutes_late::text, '?'),
        CASE WHEN v_cycle_desc IS NOT NULL THEN format(' o %s', v_cycle_desc) ELSE '' END,
        NEW.os_id);
      v_notification_type := 'warning';
    WHEN 'comment' THEN
      v_title := 'Novo comentário no atendimento';
      v_message := format('A OS %s recebeu um novo comentário.', COALESCE(v_protocolo, NEW.os_id::text));
      v_notification_type := 'info';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.app_notifications (
    type, title, message, target_audience, empresa_id,
    created_by, created_by_name, created_by_avatar_url, metadata
  )
  VALUES (
    v_notification_type, v_title, v_message, 'interno', v_cliente_id,
    NEW.actor_id, NEW.actor_name, v_avatar_url,
    v_notif_metadata
  );

  RETURN NEW;
END;
$$;

-- Recria o trigger com o nome padrão do projeto (notify_os_log_insert_trigger)
-- IMPORTANTE: não criar um segundo nome de trigger para evitar duplicatas
DROP TRIGGER IF EXISTS os_log_notification_trigger ON public.os_logs;
DROP TRIGGER IF EXISTS notify_os_log_insert_trigger ON public.os_logs;
CREATE TRIGGER notify_os_log_insert_trigger
  AFTER INSERT ON public.os_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_os_log_notification();

-- 4. RPC para buscar ciclos que precisam de lembrete
CREATE OR REPLACE FUNCTION public.get_os_cycles_for_reminders(
  p_active_states text[]
)
RETURNS TABLE (
  cycle_id uuid,
  os_id uuid,
  protocolo text,
  os_number text,
  motorista text,
  driver_id uuid,
  driver_phone text,
  cycle_index integer,
  cycle_title text,
  cycle_state text,
  message_sent_at timestamptz,
  started_at timestamptz,
  waypoint_data date,
  waypoint_hora text,
  os_data date,
  os_hora text,
  cliente_id uuid
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH ranked_waypoints AS (
    SELECT
      w.ordem_servico_id,
      w.itinerary_index,
      w.data AS wp_data,
      w.hora AS wp_hora,
      ROW_NUMBER() OVER (
        PARTITION BY w.ordem_servico_id, w.itinerary_index
        ORDER BY w.position
      ) AS rn
    FROM public.os_waypoints w
    WHERE w.data IS NOT NULL AND w.hora IS NOT NULL
  )
  -- Convert time -> text para evitar mismatch de tipo
  SELECT
    c.id AS cycle_id,
    o.id AS os_id,
    o.protocolo,
    o.os_number,
    o.motorista,
    o.driver_id,
    d.phone AS driver_phone,
    c.itinerary_index AS cycle_index,
    c.title AS cycle_title,
    c.state AS cycle_state,
    c.message_sent_at,
    c.started_at,
    rw.wp_data AS waypoint_data,
    rw.wp_hora AS waypoint_hora,
    o.data AS os_data,
    o.hora AS os_hora,
    o.cliente_id
  FROM public.os_operational_cycles c
  JOIN public.ordens_servico o ON o.id = c.ordem_servico_id
  LEFT JOIN public.drivers d ON d.id = o.driver_id
  LEFT JOIN ranked_waypoints rw
    ON rw.ordem_servico_id = c.ordem_servico_id
    AND rw.itinerary_index = c.itinerary_index
    AND rw.rn = 1
  WHERE o.arquivado = false
    AND o.status_operacional NOT IN ('Cancelado', 'Finalizado')
    AND c.state = ANY (p_active_states)
    AND c.message_sent_at IS NOT NULL
    AND c.started_at IS NULL
  ORDER BY o.protocolo, c.sequence_order;
END;
$$;
