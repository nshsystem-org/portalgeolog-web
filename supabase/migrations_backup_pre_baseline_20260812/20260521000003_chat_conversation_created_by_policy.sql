-- Garantir que a conversa seja criada pelo usuário autenticado

DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;

CREATE POLICY "Users can create conversations"
  ON public.chat_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );
