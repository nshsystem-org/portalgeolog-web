-- Tabela para rastrear versões do aplicativo
CREATE TABLE IF NOT EXISTS public.app_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  build_hash TEXT NOT NULL,
  deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deployed_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índice para buscar a versão mais recente rapidamente
CREATE INDEX IF NOT EXISTS app_versions_deployed_at_idx
  ON public.app_versions(deployed_at DESC);

-- Habilitar RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Realtime para disparar atualização automática em todos os usuários conectados
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_versions;

-- Leitura pública: a versão precisa estar disponível para o frontend comparar
CREATE POLICY "Anyone can read app_versions"
  ON public.app_versions FOR SELECT
  USING (true);

-- Inserção apenas via service role / backend autorizado
CREATE POLICY "Only admins can insert app_versions"
  ON public.app_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid()
      AND categoria = 'administrador'
    )
  );

-- Inserir versão inicial
INSERT INTO public.app_versions (version, build_hash, deployed_by, notes)
VALUES ('0.1.0', 'initial', 'system', 'Versão inicial do sistema de versionamento')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.app_versions IS 'Rastreamento de versões do aplicativo';
