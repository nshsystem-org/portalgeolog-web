-- Corrigir política RLS de chat_participants para evitar recursão infinita
-- A política anterior verificava se o usuário era participante, o que causava recursão

DROP POLICY IF EXISTS "Users can add participants to conversations they created" ON public.chat_participants;

-- Política simplificada: permite inserir participantes se o usuário é o criador da conversa
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
    OR chat_participants.user_id = auth.uid()
  );

-- Política para atualizar próprio registro (já existe, garantindo)
DROP POLICY IF EXISTS "Users can update their own participant data" ON public.chat_participants;
CREATE POLICY "Users can update their own participant data"
  ON public.chat_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
