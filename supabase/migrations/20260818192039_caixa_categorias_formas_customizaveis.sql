-- Tabelas para categorias e formas de pagamento personalizáveis do Caixa
-- Permite que administradores/operators criem e gerenciem suas próprias categorias/formas

-- ============================================================
-- 1) caixa_categorias
-- ============================================================

CREATE TABLE IF NOT EXISTS public.caixa_categorias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome character varying(100) NOT NULL,
  slug character varying(100) NOT NULL,
  tipo character varying(10) NOT NULL DEFAULT 'saida'
    CHECK (tipo IN ('entrada', 'saida', 'ambos')),
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique normalizado em (slug, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS caixa_categorias_slug_tipo_unique
  ON public.caixa_categorias (lower(btrim(slug)), tipo)
  WHERE btrim(slug) <> '';

-- Unique normalizado em (nome, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS caixa_categorias_nome_tipo_unique
  ON public.caixa_categorias (lower(btrim(nome)), tipo)
  WHERE btrim(nome) <> '';

CREATE INDEX IF NOT EXISTS caixa_categorias_tipo_idx
  ON public.caixa_categorias USING btree (tipo);

CREATE INDEX IF NOT EXISTS caixa_categorias_ativo_idx
  ON public.caixa_categorias USING btree (ativo);

ALTER TABLE public.caixa_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caixa_categorias_select ON public.caixa_categorias;
CREATE POLICY caixa_categorias_select
  ON public.caixa_categorias FOR SELECT TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador', 'financeiro'));

DROP POLICY IF EXISTS caixa_categorias_insert ON public.caixa_categorias;
CREATE POLICY caixa_categorias_insert
  ON public.caixa_categorias FOR INSERT TO authenticated
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

DROP POLICY IF EXISTS caixa_categorias_update ON public.caixa_categorias;
CREATE POLICY caixa_categorias_update
  ON public.caixa_categorias FOR UPDATE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

DROP POLICY IF EXISTS caixa_categorias_delete ON public.caixa_categorias;
CREATE POLICY caixa_categorias_delete
  ON public.caixa_categorias FOR DELETE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caixa_categorias TO authenticated;

-- ============================================================
-- 2) caixa_formas_pagamento
-- ============================================================

CREATE TABLE IF NOT EXISTS public.caixa_formas_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome character varying(100) NOT NULL,
  slug character varying(100) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS caixa_formas_slug_unique
  ON public.caixa_formas_pagamento (lower(btrim(slug)))
  WHERE btrim(slug) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS caixa_formas_nome_unique
  ON public.caixa_formas_pagamento (lower(btrim(nome)))
  WHERE btrim(nome) <> '';

CREATE INDEX IF NOT EXISTS caixa_formas_ativo_idx
  ON public.caixa_formas_pagamento USING btree (ativo);

ALTER TABLE public.caixa_formas_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caixa_formas_select ON public.caixa_formas_pagamento;
CREATE POLICY caixa_formas_select
  ON public.caixa_formas_pagamento FOR SELECT TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador', 'financeiro'));

DROP POLICY IF EXISTS caixa_formas_insert ON public.caixa_formas_pagamento;
CREATE POLICY caixa_formas_insert
  ON public.caixa_formas_pagamento FOR INSERT TO authenticated
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

DROP POLICY IF EXISTS caixa_formas_update ON public.caixa_formas_pagamento;
CREATE POLICY caixa_formas_update
  ON public.caixa_formas_pagamento FOR UPDATE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

DROP POLICY IF EXISTS caixa_formas_delete ON public.caixa_formas_pagamento;
CREATE POLICY caixa_formas_delete
  ON public.caixa_formas_pagamento FOR DELETE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caixa_formas_pagamento TO authenticated;

-- ============================================================
-- 3) Seed: categorias existentes (hardcoded)
-- ============================================================

INSERT INTO public.caixa_categorias (nome, slug, tipo, ordem) VALUES
  ('Recebimento de Cliente', 'recebimento_cliente', 'entrada', 1),
  ('Repasse Recebido', 'repasse_recebido', 'entrada', 2),
  ('Estorno', 'estorno', 'entrada', 3),
  ('Rendimento / Juros', 'rendimento', 'entrada', 4),
  ('Empréstimo / Aporte', 'emprestimo', 'entrada', 5),
  ('Outros', 'outros', 'entrada', 6),
  ('Repasse a Motorista', 'repasse_motorista', 'saida', 1),
  ('Combustível', 'combustivel', 'saida', 2),
  ('Manutenção', 'manutencao', 'saida', 3),
  ('Aluguel', 'aluguel', 'saida', 4),
  ('Salários / Pró-labore', 'salarios', 'saida', 5),
  ('Impostos', 'impostos', 'saida', 6),
  ('Fornecedores', 'fornecedores', 'saida', 7),
  ('Despesas Fixas', 'despesas_fixas', 'saida', 8),
  ('Despesas Variáveis', 'despesas_variaveis', 'saida', 9),
  ('Investimento', 'investimento', 'saida', 10),
  ('Outros', 'outros', 'saida', 11)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4) Seed: formas de pagamento existentes (hardcoded)
-- ============================================================

INSERT INTO public.caixa_formas_pagamento (nome, slug, ordem) VALUES
  ('Pix', 'pix', 1),
  ('Dinheiro', 'dinheiro', 2),
  ('Cartão de Crédito', 'cartao_credito', 3),
  ('Cartão de Débito', 'cartao_debito', 4),
  ('Transferência', 'transferencia', 5),
  ('Boleto', 'boleto', 6),
  ('Outro', 'outro', 7)
ON CONFLICT DO NOTHING;

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixa_categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixa_formas_pagamento;
