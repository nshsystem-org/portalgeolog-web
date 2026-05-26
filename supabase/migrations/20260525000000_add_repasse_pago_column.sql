-- Adicionar coluna repasse_pago para rastrear pagamentos de repasse
-- Esta coluna indica se o repasse ao motorista/parceiro já foi pago

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS repasse_pago BOOLEAN DEFAULT FALSE;

-- Criar índice para melhorar performance de queries de repasse
CREATE INDEX IF NOT EXISTS idx_ordens_servico_repasse_pago
  ON public.ordens_servico (repasse_pago) WHERE repasse_pago = TRUE;

-- Verificar se a coluna foi criada
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ordens_servico'
  AND column_name = 'repasse_pago';
