-- Tabela para rastrear quais anúncios o usuário dispensou
CREATE TABLE IF NOT EXISTS public.announcement_dismissals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.system_announcements(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_user ON public.announcement_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_announcement ON public.announcement_dismissals(announcement_id);

-- RLS Policies
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seus próprios dismissals
CREATE POLICY "Users can read own dismissals"
  ON public.announcement_dismissals FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

-- Usuários podem inserir seus próprios dismissals
CREATE POLICY "Users can insert own dismissals"
  ON public.announcement_dismissals FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- Usuários podem deletar seus próprios dismissals
CREATE POLICY "Users can delete own dismissals"
  ON public.announcement_dismissals FOR DELETE
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());
