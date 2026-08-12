-- Remove a coluna cpf da tabela passageiros.
-- CPF deixou de ser coletado para passageiros (continua válido para motoristas).

-- 1. Dropar constraint e índices que referenciam a coluna cpf
ALTER TABLE public.passageiros DROP CONSTRAINT IF EXISTS passageiros_cpf_unique;
DROP INDEX IF EXISTS public.passageiros_cpf_unique_normalized;
DROP INDEX IF EXISTS public.idx_passageiros_cpf_trgm;

-- 2. Recriar a função RPC sem o parâmetro p_cpf
DROP FUNCTION IF EXISTS public.update_passageiro_atomic(uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.update_passageiro_atomic(
  p_passageiro_id uuid,
  p_nome_completo text,
  p_celular text,
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
    celular = p_celular
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
GRANT EXECUTE ON FUNCTION public.update_passageiro_atomic(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_passageiro_atomic(uuid, text, text, jsonb) TO service_role;

-- 4. Remover a coluna da tabela
ALTER TABLE public.passageiros DROP COLUMN IF EXISTS cpf;
