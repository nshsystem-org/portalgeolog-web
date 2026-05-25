-- Script seguro para adicionar colunas financeiras
-- Este script é idempotente (pode ser executado múltiplas vezes sem problemas)

-- 1. Adicionar colunas à tabela ordens_servico (se não existirem)
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS financeiro_faturado_em timestamptz,
  ADD COLUMN IF NOT EXISTS financeiro_recebido_em timestamptz;

-- 2. Criar índice para melhorar performance de queries financeiras
CREATE INDEX IF NOT EXISTS idx_ordens_servico_financeiro_dashboard
  ON public.ordens_servico (arquivado, status_financeiro, data, cliente_id, centro_custo_id, driver_id);

-- 3. Verificar se as colunas foram criadas
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ordens_servico'
  AND column_name IN ('financeiro_faturado_em', 'financeiro_recebido_em')
ORDER BY column_name;
