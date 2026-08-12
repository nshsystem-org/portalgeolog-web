-- Migration: Atualizar função update_parceiro_atomic para remover referencia
-- Description: Atualizar a função RPC para não utilizar mais a coluna referencia

CREATE OR REPLACE FUNCTION update_parceiro_atomic(
  p_parceiro_id UUID,
  p_nome TEXT,
  p_pessoa_tipo TEXT,
  p_documento TEXT,
  p_razao_social_ou_nome_completo TEXT,
  p_contatos JSONB,
  p_filiais JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contato JSONB;
  v_filial JSONB;
BEGIN
  UPDATE public.parceiros_servico SET
    nome = p_nome,
    pessoa_tipo = p_pessoa_tipo,
    documento = p_documento,
    razao_social_ou_nome_completo = p_razao_social_ou_nome_completo,
    updated_at = NOW()
  WHERE id = p_parceiro_id;

  DELETE FROM public.parceiros_contatos WHERE parceiro_id = p_parceiro_id;
  DELETE FROM public.parceiros_filiais WHERE parceiro_id = p_parceiro_id;

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    INSERT INTO public.parceiros_contatos (
      parceiro_id, setor, celular, email, responsavel
    ) VALUES (
      p_parceiro_id,
      v_contato->>'setor',
      v_contato->>'celular',
      v_contato->>'email',
      v_contato->>'responsavel'
    );
  END LOOP;

  FOR v_filial IN SELECT * FROM jsonb_array_elements(p_filiais)
  LOOP
    INSERT INTO public.parceiros_filiais (
      parceiro_id, rotulo, endereco_completo
    ) VALUES (
      p_parceiro_id,
      v_filial->>'rotulo',
      v_filial->>'endereco_completo'
    );
  END LOOP;
END;
$$;
