-- Migration: Adiciona tipo driver_edit_ack ao trigger de notificações
--
-- Quando o motorista clica "ESTOU CIENTE" no template alteracao_viagem_motorista,
-- o webhook insere um log com type='driver_edit_ack'. Esta migration adiciona
-- esse tipo à função handle_os_log_notification() para que a notificação apareça
-- no sino dos internos (categoria: motorista, tipo: success).
--
-- Abordagem: replace cirúrgico na definição da função existente, preservando
-- toda a lógica atual e adicionando apenas o novo tipo.

DO $$
DECLARE
  v_funcdef text;
  v_newdef text;
BEGIN
  SELECT pg_get_functiondef('public.handle_os_log_notification()'::regprocedure)
    INTO v_funcdef;

  -- Idempotente: se já tem o tipo, skip
  IF v_funcdef LIKE '%driver_edit_ack%' THEN
    RAISE NOTICE 'Tipo driver_edit_ack já existe — skip';
    RETURN;
  END IF;

  -- 1. Adiciona 'driver_edit_ack' à lista NOT IN
  v_newdef := replace(
    v_funcdef,
    '''comment''
  ) THEN',
    '''comment'',
    ''driver_edit_ack''
  ) THEN'
  );

  -- 2. Adiciona o CASE WHEN para driver_edit_ack antes do ELSE
  v_newdef := replace(
    v_newdef,
    'ELSE
      RETURN NEW;',
    'WHEN ''driver_edit_ack'' THEN
      v_title := ''Motorista confirmou alteração'';
      v_message := format(
        ''%s confirmou estar ciente da alteração do atendimento %s.'',
        COALESCE(NEW.actor_name, ''Motorista''),
        COALESCE(v_protocolo, NEW.os_id::text)
      );
      v_notification_type := ''success'';
      v_category := ''motorista'';
    ELSE
      RETURN NEW;'
  );

  IF v_newdef = v_funcdef THEN
    RAISE EXCEPTION 'Replace falhou — string não encontrada na função';
  END IF;

  EXECUTE v_newdef;
  RAISE NOTICE 'Tipo driver_edit_ack adicionado com sucesso';
END $$;
