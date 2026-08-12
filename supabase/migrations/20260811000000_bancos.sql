-- =============================================================================
-- Tabela: bancos
-- Bancos pré-cadastrados para vincular a contas de caixa.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bancos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  sigla TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#64748b',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bancos_nome ON public.bancos(nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bancos_sigla ON public.bancos(sigla);

ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bancos_read_authenticated" ON public.bancos;
CREATE POLICY "bancos_read_authenticated" ON public.bancos
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- Vínculo com contas de caixa
-- =============================================================================
ALTER TABLE public.caixa_contas
  ADD COLUMN IF NOT EXISTS banco_id UUID REFERENCES public.bancos(id) ON DELETE SET NULL;

-- Trigger updated_at para bancos
DROP TRIGGER IF EXISTS trg_bancos_updated_at ON public.bancos;
CREATE TRIGGER trg_bancos_updated_at
  BEFORE UPDATE ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.set_caixa_updated_at();

-- =============================================================================
-- Seed: 20 principais bancos brasileiros
-- =============================================================================
INSERT INTO public.bancos (nome, sigla, cor) VALUES
  ('Banco do Brasil', 'BB', '#003399'),
  ('Caixa Econômica Federal', 'CAIXA', '#0070A1'),
  ('Itaú Unibanco', 'ITAÚ', '#FF6F00'),
  ('Bradesco', 'BRADESCO', '#CC092F'),
  ('Santander', 'SANTANDER', '#EC0000'),
  ('Nubank', 'NUBANK', '#8A05BE'),
  ('Banco Inter', 'INTER', '#FF7A00'),
  ('Banco Safra', 'SAFRA', '#004A8F'),
  ('BTG Pactual', 'BTG', '#003D70'),
  ('C6 Bank', 'C6', '#242424'),
  ('Neon', 'NEON', '#00C2D6'),
  ('Banco Original', 'ORIGINAL', '#00A69C'),
  ('Banco Pan', 'PAN', '#0073A0'),
  ('Banco BMG', 'BMG', '#E0004D'),
  ('Banco Daycoval', 'DAYCOVAL', '#003C6E'),
  ('Banco Pine', 'PINE', '#1E3A5F'),
  ('Banco ABC Brasil', 'ABC', '#004A99'),
  ('Agibank', 'AGIBANK', '#F37021'),
  ('ModalMais', 'MODAL', '#6A1B9A'),
  ('Banrisul', 'BANRISUL', '#0A3C78')
ON CONFLICT (sigla) DO NOTHING;
