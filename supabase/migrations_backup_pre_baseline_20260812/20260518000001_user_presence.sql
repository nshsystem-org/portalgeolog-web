-- Tabela de presença online dos usuários do portal
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.user_roles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_presence IS 'Rastreamento de presença online dos usuários do portal';
COMMENT ON COLUMN public.user_presence.status IS 'online ou offline';
COMMENT ON COLUMN public.user_presence.last_seen_at IS 'Último heartbeat recebido';
COMMENT ON COLUMN public.user_presence.last_activity_at IS 'Última ação significativa do usuário';

-- Políticas RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ver a presença de todos (para listagem)
CREATE POLICY IF NOT EXISTS "Authenticated users can view all presence"
  ON public.user_presence
  FOR SELECT
  TO authenticated
  USING (true);

-- Cada usuário pode atualizar apenas sua própria presença
CREATE POLICY IF NOT EXISTS "Users can update own presence"
  ON public.user_presence
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role pode tudo (para server-side operations)
CREATE POLICY IF NOT EXISTS "Service role full access on presence"
  ON public.user_presence
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Realtime habilitado para atualizações de status em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
