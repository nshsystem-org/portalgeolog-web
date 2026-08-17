-- Tabela de Fornecedores (cadastro completo, simplificado em relação a parceiros)
-- Segue o padrão de parceiros_servico: RLS por categoria, search_index gerado,
-- unique normalizado em nome e documento, arquivamento soft-delete.
--
-- Acesso:
--   SELECT  -> administrador, operador, financeiro
--   WRITE   -> administrador, operador

CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome character varying(255) NOT NULL,
  pessoa_tipo character varying(10) NOT NULL DEFAULT 'juridica'
    CHECK (pessoa_tipo IN ('fisica', 'juridica')),
  documento character varying(20),
  telefone character varying(20),
  email character varying(255),
  endereco text,
  cidade character varying(100),
  estado character varying(2),
  cep character varying(10),
  observacoes text,
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'inativo')),
  arquivado boolean NOT NULL DEFAULT false,
  search_index text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- search_index é gerado pela trigger abaixo (PostgreSQL não permite
-- referenciar colunas em DEFAULT expression).

-- Atualizar search_index e updated_at em INSERT/UPDATE via trigger
CREATE OR REPLACE FUNCTION public.fornecedores_search_index_tg()
RETURNS trigger AS $$
BEGIN
  NEW.search_index := lower(
    coalesce(NEW.nome, '') || ' ' ||
    coalesce(NEW.documento, '') || ' ' ||
    coalesce(NEW.telefone, '') || ' ' ||
    coalesce(NEW.email, '') || ' ' ||
    coalesce(NEW.cidade, '') || ' ' ||
    coalesce(NEW.estado, '')
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fornecedores_search_index_tg ON public.fornecedores;
CREATE TRIGGER fornecedores_search_index_tg
  BEFORE INSERT OR UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.fornecedores_search_index_tg();

-- Índices
CREATE INDEX IF NOT EXISTS fornecedores_search_idx
  ON public.fornecedores USING gin (to_tsvector('portuguese'::regconfig, search_index));

CREATE INDEX IF NOT EXISTS fornecedores_status_idx
  ON public.fornecedores USING btree (status);

CREATE INDEX IF NOT EXISTS fornecedores_arquivado_idx
  ON public.fornecedores USING btree (arquivado);

-- Unique normalizado em nome (ignora vazio e maiúsculas/whitespace)
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_nome_unique_normalized
  ON public.fornecedores (lower(btrim(nome)))
  WHERE btrim(nome) <> '';

-- Unique normalizado em documento (apenas dígitos, ignora vazio)
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_documento_unique_normalized
  ON public.fornecedores (regexp_replace(coalesce(documento, ''), '\D', '', 'g'))
  WHERE regexp_replace(coalesce(documento, ''), '\D', '', 'g') <> '';

-- ============================================================
-- RLS por categoria (mesmo padrão de parceiros_servico)
-- ============================================================

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fornecedores_select_by_categoria ON public.fornecedores;
CREATE POLICY fornecedores_select_by_categoria
  ON public.fornecedores FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

DROP POLICY IF EXISTS fornecedores_insert_by_categoria ON public.fornecedores;
CREATE POLICY fornecedores_insert_by_categoria
  ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

DROP POLICY IF EXISTS fornecedores_update_by_categoria ON public.fornecedores;
CREATE POLICY fornecedores_update_by_categoria
  ON public.fornecedores FOR UPDATE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

DROP POLICY IF EXISTS fornecedores_delete_by_categoria ON public.fornecedores;
CREATE POLICY fornecedores_delete_by_categoria
  ON public.fornecedores FOR DELETE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'));

-- Grants explícitos (defensivo)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;

-- ============================================================
-- Função atômica de upsert/update (espelha update_parceiro_atomic)
-- ============================================================

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

GRANT EXECUTE ON FUNCTION public.update_fornecedor_atomic(uuid, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.fornecedores;
