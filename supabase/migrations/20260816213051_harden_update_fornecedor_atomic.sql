-- Impede que update_fornecedor_atomic (SECURITY DEFINER) ignore o RBAC
-- de categoria. Sem este check, qualquer authenticated com GRANT EXECUTE
-- poderia atualizar fornecedores (financeiro, gestor, etc.).

CREATE OR REPLACE FUNCTION public.update_fornecedor_atomic(
  p_fornecedor_id uuid,
  p_nome text,
  p_pessoa_tipo text,
  p_documento text,
  p_telefone text,
  p_email text,
  p_endereco text,
  p_cidade text,
  p_estado text,
  p_cep text,
  p_observacoes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.user_categoria() NOT IN ('administrador', 'operador') THEN
    RAISE EXCEPTION 'Sem permissão para atualizar fornecedor.';
  END IF;

  IF p_pessoa_tipo NOT IN ('fisica', 'juridica') THEN
    RAISE EXCEPTION 'Tipo de pessoa inválido.';
  END IF;

  UPDATE public.fornecedores
    SET nome            = btrim(p_nome),
        pessoa_tipo     = p_pessoa_tipo,
        documento       = nullif(btrim(coalesce(p_documento, '')), ''),
        telefone        = nullif(btrim(coalesce(p_telefone, '')), ''),
        email           = lower(nullif(btrim(coalesce(p_email, '')), '')),
        endereco        = nullif(btrim(coalesce(p_endereco, '')), ''),
        cidade          = nullif(btrim(coalesce(p_cidade, '')), ''),
        estado          = upper(nullif(btrim(coalesce(p_estado, '')), '')),
        cep             = nullif(btrim(coalesce(p_cep, '')), ''),
        observacoes     = nullif(btrim(coalesce(p_observacoes, '')), '')
  WHERE id = p_fornecedor_id;
END;
$$;
