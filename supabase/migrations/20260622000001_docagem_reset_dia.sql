-- =============================================================================
-- Migration: docagem_reset_dia
-- Data: 2026-06-22
-- =============================================================================
-- Adiciona RPC para resetar uma instância de docagem de 'finalizada' para
-- 'pendente', limpando os campos de finalização e removendo o lançamento
-- financeiro gerado automaticamente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resetar_docagem_dia(
  p_instancia_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_instancia public.docagem_instancias%ROWTYPE;
BEGIN
  SELECT * INTO v_instancia
  FROM public.docagem_instancias
  WHERE id = p_instancia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância de docagem não encontrada.';
  END IF;

  IF v_instancia.status != 'finalizada' THEN
    RAISE EXCEPTION 'Apenas instâncias finalizadas podem ser resetadas.';
  END IF;

  -- Remove o lançamento financeiro gerado na finalização
  DELETE FROM public.docagem_lancamentos
  WHERE docagem_instancia_id = p_instancia_id;

  -- Volta o status para pendente e limpa os campos de finalização
  UPDATE public.docagem_instancias
  SET status = 'pendente',
      finalizada_em = NULL,
      finalizada_por = NULL
  WHERE id = p_instancia_id;
END;
$$;
