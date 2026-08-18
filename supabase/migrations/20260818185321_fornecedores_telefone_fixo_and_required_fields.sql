-- 1) Adicionar coluna telefone_fixo (telefone existente passa a ser "celular")
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS telefone_fixo character varying(20);

-- 2) Adicionar CHECK: documento obrigatório (sempre, independente do tipo)
ALTER TABLE public.fornecedores
  DROP CONSTRAINT IF EXISTS fornecedores_documento_required;
ALTER TABLE public.fornecedores
  ADD CONSTRAINT fornecedores_documento_required
  CHECK (btrim(coalesce(documento, '')) <> '');

-- 3) Atualizar search_index para incluir telefone_fixo
CREATE OR REPLACE FUNCTION public.fornecedores_search_index_tg()
RETURNS trigger AS $$
BEGIN
  NEW.search_index := lower(
    coalesce(NEW.nome, '') || ' ' ||
    coalesce(NEW.documento, '') || ' ' ||
    coalesce(NEW.telefone, '') || ' ' ||
    coalesce(NEW.telefone_fixo, '') || ' ' ||
    coalesce(NEW.email, '') || ' ' ||
    coalesce(NEW.cidade, '') || ' ' ||
    coalesce(NEW.estado, '')
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Atualizar update_fornecedor_atomic para incluir telefone_fixo
--    e validar nome + documento obrigatórios
CREATE OR REPLACE FUNCTION public.update_fornecedor_atomic(
  p_fornecedor_id uuid,
  p_nome text,
  p_pessoa_tipo text,
  p_documento text,
  p_telefone text,
  p_telefone_fixo text,
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

  IF btrim(coalesce(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome/Razão social é obrigatório.';
  END IF;

  IF btrim(coalesce(p_documento, '')) = '' THEN
    RAISE EXCEPTION 'Documento (CNPJ/CPF) é obrigatório.';
  END IF;

  UPDATE public.fornecedores
    SET nome            = btrim(p_nome),
        pessoa_tipo     = p_pessoa_tipo,
        documento       = nullif(btrim(coalesce(p_documento, '')), ''),
        telefone        = nullif(btrim(coalesce(p_telefone, '')), ''),
        telefone_fixo   = nullif(btrim(coalesce(p_telefone_fixo, '')), ''),
        email           = lower(nullif(btrim(coalesce(p_email, '')), '')),
        endereco        = nullif(btrim(coalesce(p_endereco, '')), ''),
        cidade          = nullif(btrim(coalesce(p_cidade, '')), ''),
        estado          = upper(nullif(btrim(coalesce(p_estado, '')), '')),
        cep             = nullif(btrim(coalesce(p_cep, '')), ''),
        observacoes     = nullif(btrim(coalesce(p_observacoes, '')), '')
  WHERE id = p_fornecedor_id;
END;
$$;

-- Revogar e conceder execução com a nova assinatura
REVOKE EXECUTE ON FUNCTION public.update_fornecedor_atomic(uuid, text, text, text, text, text, text, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_fornecedor_atomic(uuid, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
