-- Remove a tabela passageiro_enderecos e o parâmetro p_enderecos da RPC.
-- Passageiros não possuem mais endereços próprios; o endereço fica no contexto da OS/waypoint.

-- 1. Recriar a função RPC sem o parâmetro p_enderecos
DROP FUNCTION IF EXISTS public.update_passageiro_atomic(uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.update_passageiro_atomic(
  p_passageiro_id uuid,
  p_nome_completo text,
  p_celular text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.passageiros SET
    nome_completo = p_nome_completo,
    celular = p_celular
  WHERE id = p_passageiro_id;
END;
$function$;

-- 2. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.update_passageiro_atomic(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_passageiro_atomic(uuid, text, text) TO service_role;

-- 3. Dropar a tabela passageiro_enderecos
DROP TABLE IF EXISTS public.passageiro_enderecos CASCADE;
