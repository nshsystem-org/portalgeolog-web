-- Migration: Simplifica mensagem de notificacao de atraso do motorista
--
-- Problema: A mensagem de driver_delay repetia o nome do motorista e incluia
-- informacoes ja mostradas em outros elementos do frontend (OS no meta, ciclo
-- na badge), resultando em:
--   "ACACIO LUIZ A OS 2026072394 (motorista ACACIO LUIZ VIEIRA) esta atrasada
--    ha 39 minuto(s) e ainda nao iniciou no ciclo 1."
--
-- Correcao: Mensagem fica apenas com o tempo de atraso. O frontend renderiza:
--   "ACACIO LUIZ · Atendimento com 39 min de atraso · <badge ciclo>"
-- O numero da OS continua aparecendo na linha de meta e o click continua
-- funcionando via [OS_ID:xxx] anexado ao final da mensagem.

DO $$
DECLARE
  v_funcdef text;
  v_newdef text;
BEGIN
  SELECT pg_get_functiondef('public.handle_os_log_notification()'::regprocedure)
    INTO v_funcdef;

  -- Idempotente: so altera se a mensagem antiga ainda estiver presente
  IF v_funcdef LIKE '%A OS %s (motorista %s) está atrasada%' THEN
    v_newdef := replace(
      v_funcdef,
      'WHEN ''driver_delay'' THEN
      v_title := ''Motorista em atraso'';
      v_message := format(
        ''A OS %s (motorista %s) está atrasada há %s minuto(s) e ainda não iniciou%s.'',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, ''Motorista''),
        coalesce(v_minutes_late::text, ''?''),
        CASE WHEN v_cycle_label IS NOT NULL THEN format('' o %s'', v_cycle_label) ELSE '''' END
      );
      v_notification_type := ''warning'';
      v_category := ''motorista'';',
      'WHEN ''driver_delay'' THEN
      v_title := ''Motorista em atraso'';
      v_message := format(
        ''Atendimento com %s min de atraso.'',
        coalesce(v_minutes_late::text, ''?'')
      );
      v_notification_type := ''warning'';
      v_category := ''motorista'';'
    );

    IF v_newdef = v_funcdef THEN
      RAISE EXCEPTION 'Replace do driver_delay falhou';
    END IF;

    EXECUTE v_newdef;
    RAISE NOTICE 'Mensagem de driver_delay simplificada com sucesso';
  ELSE
    RAISE NOTICE 'driver_delay ja esta simplificado';
  END IF;
END $$;
