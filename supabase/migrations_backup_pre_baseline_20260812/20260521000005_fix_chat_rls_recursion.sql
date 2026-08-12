-- Corrige a recursão infinita nas policies do chat
-- A política anterior de chat_participants consultava a própria tabela,
-- o que fazia o Postgres entrar em loop ao carregar conversas/mensagens.

CREATE OR REPLACE FUNCTION public.is_chat_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.chat_conversations;
CREATE POLICY "Users can view conversations they participate in"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_chat_conversation_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.chat_participants;
CREATE POLICY "Users can view participants in their conversations"
  ON public.chat_participants
  FOR SELECT
  TO authenticated
  USING (
    public.is_chat_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can add participants to conversations they created" ON public.chat_participants;
CREATE POLICY "Users can add participants to conversations they created"
  ON public.chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_participants.conversation_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_chat_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages in their conversations"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_chat_conversation_member(conversation_id, auth.uid())
  );
