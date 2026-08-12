-- Remove colunas email, genero e notificar da tabela passageiros.
-- Notificar passou a ser decisão operacional no cadastro da OS (automático/manual),
-- não mais um atributo do passageiro. E-mail e gênero não são mais coletados.

-- 1. Dropar índices que referenciam as colunas removidas
DROP INDEX IF EXISTS public.passageiros_email_unique_normalized;
DROP INDEX IF EXISTS public.idx_passageiros_email_trgm;

-- 2. Recriar a função RPC sem os parâmetros p_email, p_notificar, p_genero
-- Dropar a assinatura antiga (8 params) para evitar overload quebrado
DROP FUNCTION IF EXISTS public.update_passageiro_atomic(uuid, text, text, text, text, boolean, text, jsonb);

CREATE OR REPLACE FUNCTION public.update_passageiro_atomic(
  p_passageiro_id uuid,
  p_nome_completo text,
  p_celular text,
  p_cpf text,
  p_enderecos jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_end JSONB;
BEGIN
  UPDATE public.passageiros SET
    nome_completo = p_nome_completo,
    celular = p_celular,
    cpf = NULLIF(TRIM(p_cpf), '')
  WHERE id = p_passageiro_id;

  DELETE FROM public.passageiro_enderecos WHERE passageiro_id = p_passageiro_id;

  FOR v_end IN SELECT * FROM jsonb_array_elements(COALESCE(p_enderecos, '[]'::jsonb))
  LOOP
    INSERT INTO public.passageiro_enderecos (
      passageiro_id, rotulo, endereco_completo, referencia
    ) VALUES (
      p_passageiro_id,
      COALESCE(v_end->>'rotulo', 'Principal'),
      v_end->>'endereco_completo',
      v_end->>'referencia'
    );
  END LOOP;
END;
$function$;

-- 3. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.update_passageiro_atomic(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_passageiro_atomic(uuid, text, text, text, jsonb) TO service_role;

-- 4. Remover as colunas da tabela
ALTER TABLE public.passageiros
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS genero,
  DROP COLUMN IF EXISTS notificar;
