-- Migration: Corrige notificacao de driver_accept para nao repetir nome
-- e adiciona metadata com cycle_kind/cycle_ordinal no INSERT da notificacao
--
-- Problema: O frontend ja mostra o nome do motorista (formatShortName) em bold.
-- O trigger repetia o nome completo na mensagem, resultando em:
--   "ACACIO LUIZ  ACACIO LUIZ VIEIRA visualizou os detalhes do atendimento (no ciclo 1)."
--
-- Correcao:
-- 1. driver_accept: mensagem agora e apenas "visualizou os detalhes do atendimento"
-- 2. INSERT adiciona metadata com cycle_kind e cycle_ordinal para o frontend
--    renderizar o span bonito de itinerario/retorno

DO $$
DECLARE
  v_funcdef text;
  v_newdef text;
BEGIN
  SELECT pg_get_functiondef('public.handle_os_log_notification()'::regprocedure)
    INTO v_funcdef;

  -- Idempotente
  IF v_funcdef LIKE '%visualizou os detalhes do atendimento'';%
     AND v_funcdef NOT LIKE '%s visualizou os detalhes%' THEN
    RAISE NOTICE 'driver_accept ja corrigido — verificando metadata';
  ELSE
    -- Corrige driver_accept: remove nome repetido
    v_newdef := replace(
      v_funcdef,
      'WHEN ''driver_accept'' THEN
      v_title := ''Motorista visualizou os detalhes do atendimento'';
      v_message := format(
        ''%s visualizou os detalhes do atendimento%s.'',
        coalesce(NEW.actor_name, ''Motorista''),
        CASE WHEN v_cycle_label IS NOT NULL THEN format('' (%s)'', v_cycle_label) ELSE '''' END
      );',
      'WHEN ''driver_accept'' THEN
      v_title := ''Motorista visualizou os detalhes do atendimento'';
      v_message := ''visualizou os detalhes do atendimento'';'
    );
    v_funcdef := v_newdef;
  END IF;

  -- Adiciona metadata no INSERT se ainda nao tem
  IF v_funcdef NOT LIKE '%cycle_kind%'' THEN
    v_newdef := replace(
      v_funcdef,
      'INSERT INTO public.app_notifications (
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
    ''interno'',
    v_cliente_id,
    NEW.actor_id,
    NEW.actor_name,
    v_avatar_url,
    v_category
  );',
      'INSERT INTO public.app_notifications (
    type,
    title,
    message,
    target_audience,
    empresa_id,
    created_by,
    created_by_name,
    created_by_avatar_url,
    category,
    metadata
  )
  VALUES (
    v_notification_type,
    v_title,
    v_message,
    ''interno'',
    v_cliente_id,
    NEW.actor_id,
    NEW.actor_name,
    v_avatar_url,
    v_category,
    jsonb_build_object(
      ''os_id'', NEW.os_id,
      ''log_type'', NEW.type,
      ''actor_name'', NEW.actor_name,
      ''protocolo'', v_protocolo,
      ''cycle_kind'', nullif(NEW.metadata->>''cycle_kind'', ''''),
      ''cycle_ordinal'', nullif(NEW.metadata->>''cycle_ordinal'', '''')
    )
  );'
    );

    IF v_newdef = v_funcdef THEN
      RAISE EXCEPTION 'Replace do INSERT falhou';
    END IF;

    EXECUTE v_newdef;
    RAISE NOTICE 'Metadata adicionado ao INSERT com sucesso';
  ELSE
    EXECUTE v_funcdef;
    RAISE NOTICE 'Metadata ja existe — apenas aplicando driver_accept fix';
  END IF;
END $$;
