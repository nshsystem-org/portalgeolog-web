-- Tabela de avisos do sistema
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_announcements_active ON public.system_announcements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_system_announcements_expires ON public.system_announcements(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_announcements_updated_at
  BEFORE UPDATE ON public.system_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- Políticas para leitura (todos usuários autenticados podem ler avisos ativos)
CREATE POLICY "Authenticated users can read active announcements"
  ON public.system_announcements FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Políticas para escrita (apenas administradores podem criar/editar)
CREATE POLICY "Administrators can insert announcements"
  ON public.system_announcements FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.categoria = 'administrador'
    )
  );

CREATE POLICY "Administrators can update announcements"
  ON public.system_announcements FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.categoria = 'administrador'
    )
  );

CREATE POLICY "Administrators can delete announcements"
  ON public.system_announcements FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.categoria = 'administrador'
    )
  );

-- Adicionar à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_announcements;
