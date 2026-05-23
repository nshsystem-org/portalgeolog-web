-- Adicionar políticas RLS à tabela user_roles para permitir leitura para o chat
-- Isso permite que usuários autenticados possam ver outros usuários para iniciar conversas

-- Verificar se RLS está habilitado
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários autenticados leiam outros usuários (para chat)
-- Todos os campos necessários para o chat: id, nome, avatar_url
DROP POLICY IF EXISTS "Authenticated users can read user_roles for chat" ON public.user_roles;
CREATE POLICY "Authenticated users can read user_roles for chat"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir que usuários leiam seu próprio registro (já existe, mas garantindo)
DROP POLICY IF EXISTS "Users can read own user_role" ON public.user_roles;
CREATE POLICY "Users can read own user_role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Service role tem acesso total
DROP POLICY IF EXISTS "Service role full access on user_roles" ON public.user_roles;
CREATE POLICY "Service role full access on user_roles"
  ON public.user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
