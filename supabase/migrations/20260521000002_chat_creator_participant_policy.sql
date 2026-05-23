-- Permitir que o criador da conversa insira participantes no chat
-- Necessário para criar conversas diretas/grupos e adicionar o destinatário logo na criação

DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.chat_participants;

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
