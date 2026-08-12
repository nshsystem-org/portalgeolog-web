-- Sistema de Chat Instantâneo
-- Migração para criar tabelas de conversas, mensagens e participantes

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  title text, -- Opcional, usado para grupos
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_conversations IS 'Conversas do sistema de chat';
COMMENT ON COLUMN public.chat_conversations.type IS 'Tipo: direct (1-1) ou group';
COMMENT ON COLUMN public.chat_conversations.title IS 'Título da conversa (obrigatório para grupos)';
COMMENT ON COLUMN public.chat_conversations.created_by IS 'Usuário que criou a conversa';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by 
  ON public.chat_conversations(created_by) 
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at 
  ON public.chat_conversations(updated_at DESC);

-- Tabela de participantes das conversas
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz, -- Última mensagem lida pelo participante
  is_admin boolean NOT NULL DEFAULT false, -- Para grupos
  UNIQUE(conversation_id, user_id)
);

COMMENT ON TABLE public.chat_participants IS 'Participantes das conversas';
COMMENT ON COLUMN public.chat_participants.last_read_at IS 'Timestamp da última mensagem lida';
COMMENT ON COLUMN public.chat_participants.is_admin IS 'Se o participante é admin da conversa (grupos)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation_id 
  ON public.chat_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id 
  ON public.chat_participants(user_id);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_edited boolean NOT NULL DEFAULT false,
  reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL -- Para responder mensagens
);

COMMENT ON TABLE public.chat_messages IS 'Mensagens do chat';
COMMENT ON COLUMN public.chat_messages.message_type IS 'Tipo: text, image, file, system';
COMMENT ON COLUMN public.chat_messages.is_edited IS 'Se a mensagem foi editada';
COMMENT ON COLUMN public.chat_messages.reply_to_id IS 'ID da mensagem sendo respondida (thread)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id 
  ON public.chat_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id 
  ON public.chat_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
  ON public.chat_messages(created_at DESC);

-- Trigger para atualizar updated_at das conversas
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_conversations 
  SET updated_at = now() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_updated_at
  AFTER INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

-- Row Level Security (RLS)

-- chat_conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver conversas onde são participantes
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.chat_conversations;
CREATE POLICY "Users can view conversations they participate in"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.conversation_id = chat_conversations.id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Usuários podem criar conversas
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;
CREATE POLICY "Users can create conversations"
  ON public.chat_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- chat_participants
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver participantes de conversas onde participam
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.chat_participants;
CREATE POLICY "Users can view participants in their conversations"
  ON public.chat_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.conversation_id = chat_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- Usuários podem adicionar participantes (apenas se já forem participantes)
DROP POLICY IF EXISTS "Users can add participants to their conversations" ON public.chat_participants;
CREATE POLICY "Users can add participants to their conversations"
  ON public.chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE conversation_id = chat_participants.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Usuários podem atualizar seu próprio last_read_at
DROP POLICY IF EXISTS "Users can update their own participant data" ON public.chat_participants;
CREATE POLICY "Users can update their own participant data"
  ON public.chat_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver mensagens de conversas onde participam
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.conversation_id = chat_messages.conversation_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Usuários podem enviar mensagens em conversas onde participam
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages in their conversations"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.conversation_id = chat_messages.conversation_id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Usuários podem editar suas próprias mensagens
DROP POLICY IF EXISTS "Users can edit their own messages" ON public.chat_messages;
CREATE POLICY "Users can edit their own messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Service role tem acesso total
DROP POLICY IF EXISTS "Service role full access on conversations" ON public.chat_conversations;
CREATE POLICY "Service role full access on conversations"
  ON public.chat_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on participants" ON public.chat_participants;
CREATE POLICY "Service role full access on participants"
  ON public.chat_participants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on messages" ON public.chat_messages;
CREATE POLICY "Service role full access on messages"
  ON public.chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Supabase Realtime para mensagens em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
