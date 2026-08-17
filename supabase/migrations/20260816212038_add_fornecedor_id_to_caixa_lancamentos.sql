-- Adiciona coluna fornecedor_id em caixa_lancamentos para vincular
-- lançamentos de saída (categoria "fornecedores") a um fornecedor cadastrado.
-- FK com ON DELETE SET NULL (não bloqueia arquivamento do fornecedor).

alter table public.caixa_lancamentos
  add column if not exists fornecedor_id uuid
  references public.fornecedores(id) on delete set null;

create index if not exists caixa_lancamentos_fornecedor_id_idx
  on public.caixa_lancamentos (fornecedor_id);
