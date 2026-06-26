-- Migration: corrige CHECK constraints de status para aceitar 'Rascunho'
-- Bug: insert_os_atomic com tipo='rascunho' gravava status_financeiro='Rascunho'
-- mas a CHECK constraint só permitia 'Pendente' e 'Faturado', causando erro 23514.
-- Aproveita para alinhar status_operacional (adiciona 'Andamento') e
-- status_financeiro (adiciona 'Recebido' e 'Pago') com o tipo OSStatus do TypeScript.

ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_status_financeiro_check;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_status_financeiro_check
  CHECK (status_financeiro = ANY (ARRAY['Pendente'::text, 'Faturado'::text, 'Recebido'::text, 'Pago'::text, 'Rascunho'::text]));

ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_status_operacional_check;
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_status_operacional_check
  CHECK (status_operacional = ANY (ARRAY['Pendente'::text, 'Aguardando'::text, 'Em Rota'::text, 'Andamento'::text, 'Finalizado'::text, 'Cancelado'::text, 'Rascunho'::text]));
