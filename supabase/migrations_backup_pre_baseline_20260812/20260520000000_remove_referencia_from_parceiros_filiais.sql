-- Migration: Remover coluna referencia da tabela parceiros_filiais
-- Description: Remover o campo referencia que não é mais utilizado no sistema

ALTER TABLE public.parceiros_filiais DROP COLUMN IF EXISTS referencia;
