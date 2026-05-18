-- Corrige a função RPC de atualização de passageiro para tratar valores vazios como NULL.
-- Problema: índices únicos normalizados causavam erro 409 quando email/cpf vazios eram salvos como ''.
-- Solução: Salvar NULL quando email/cpf estiverem vazios, evitando conflito com índices únicos.

CREATE OR REPLACE FUNCTION update_passageiro_atomic(
  p_passageiro_id UUID,
  p_nome_completo TEXT,
  p_email TEXT,
  p_celular TEXT,
  p_cpf TEXT,
  p_notificar BOOLEAN,
  p_genero TEXT,
  p_enderecos JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_end JSONB;
BEGIN
  UPDATE public.passageiros SET
    nome_completo = p_nome_completo,
    email = NULLIF(TRIM(p_email), ''),
    celular = p_celular,
    cpf = NULLIF(TRIM(p_cpf), ''),
    notificar = COALESCE(p_notificar, false),
    genero = p_genero
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
$$;

GRANT EXECUTE ON FUNCTION update_passageiro_atomic(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_passageiro_atomic(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) TO service_role;
