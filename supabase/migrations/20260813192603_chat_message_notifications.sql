-- =============================================================================
-- Migration: chat_message_notifications
-- Data: 2026-08-13
-- =============================================================================
-- Gera notificações (app_notifications) para os participantes de uma conversa
-- quando uma nova mensagem de chat é inserida. O remetente não recebe
-- notificação (ele acabou de enviar). Cada destinatário recebe uma notificação
-- direcionada via target_user_id, com target_audience = 'all' para passar pelo
-- filtro de audience independentemente do tipo_usuario do destinatário.
--
-- O frontend (useNotifications) já renderiza toast + notificação desktop nativa
-- para novas entradas em app_notifications via Realtime. O metadata.kind =
-- 'chat_message' permite ao frontend identificar a origem, abrir a conversa
-- correta ao clicar, e suprimir a notificação quando o usuário já está com a
-- conversa aberta.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_chat_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_name TEXT;
  v_sender_avatar_url TEXT;
  v_conversation_title TEXT;
  v_conversation_type TEXT;
  v_recipient RECORD;
  v_message_preview TEXT;
  v_other_participant_name TEXT;
BEGIN
  -- Buscar dados do remetente
  SELECT nome, avatar_url
    INTO v_sender_name, v_sender_avatar_url
  FROM public.user_roles
  WHERE id = NEW.sender_id;

  -- Buscar tipo e título da conversa
  SELECT type, title
    INTO v_conversation_type, v_conversation_title
  FROM public.chat_conversations
  WHERE id = NEW.conversation_id;

  -- Truncar preview da mensagem (máx 120 chars)
  v_message_preview := left(NEW.content, 120);

  -- Inserir notificação para cada participante EXCETO o remetente
  FOR v_recipient IN
    SELECT cp.user_id
    FROM public.chat_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id != NEW.sender_id
  LOOP
    -- Para conversas diretas, incluir o nome do remetente na mensagem
    -- Para grupos, incluir o título do grupo
    IF v_conversation_type = 'group' THEN
      INSERT INTO public.app_notifications (
        type,
        title,
        message,
        target_audience,
        target_user_id,
        empresa_id,
        created_by,
        created_by_name,
        created_by_avatar_url,
        category,
        metadata
      )
      VALUES (
        'info',
        COALESCE(v_conversation_title, 'Grupo'),
        format('%s: %s', COALESCE(v_sender_name, 'Usuário'), v_message_preview),
        'all',
        v_recipient.user_id,
        NULL,
        NEW.sender_id,
        v_sender_name,
        v_sender_avatar_url,
        'sistema',
        jsonb_build_object(
          'kind', 'chat_message',
          'conversation_id', NEW.conversation_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'conversation_type', v_conversation_type
        )
      );
    ELSE
      INSERT INTO public.app_notifications (
        type,
        title,
        message,
        target_audience,
        target_user_id,
        empresa_id,
        created_by,
        created_by_name,
        created_by_avatar_url,
        category,
        metadata
      )
      VALUES (
        'info',
        'Nova mensagem',
        format('%s: %s', COALESCE(v_sender_name, 'Usuário'), v_message_preview),
        'all',
        v_recipient.user_id,
        NULL,
        NEW.sender_id,
        v_sender_name,
        v_sender_avatar_url,
        'sistema',
        jsonb_build_object(
          'kind', 'chat_message',
          'conversation_id', NEW.conversation_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'conversation_type', v_conversation_type
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_chat_message_trigger ON public.chat_messages;
CREATE TRIGGER notify_chat_message_trigger
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.message_type != 'system')
  EXECUTE FUNCTION public.handle_chat_message_notification();
