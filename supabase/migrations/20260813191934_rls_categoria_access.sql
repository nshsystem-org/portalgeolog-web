-- RLS por categoria: restringe escrita nas tabelas operacionais
-- Financeiro pode LER (para joins/lookups no faturamento) mas não escrever
-- Operador e administrador mantêm acesso total
--
-- Tabelas afetadas: ordens_servico, drivers, veiculos, passageiros,
-- clientes, parceiros_servico, parceiros_contatos, parceiros_filiais

-- Helper: retorna a categoria do usuário atual
CREATE OR REPLACE FUNCTION public.user_categoria()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT categoria FROM public.user_roles WHERE id = auth.uid();
$$;

-- Conceder permissão de execução para authenticated
GRANT EXECUTE ON FUNCTION public.user_categoria() TO authenticated;

-- ============================================================
-- ordens_servico: substituir policy permissiva por categoria
-- ============================================================

-- DROP policy antiga (ALL para authenticated = true)
DROP POLICY IF EXISTS ordens_servico_auth_all ON public.ordens_servico;

-- SELECT: administrador, operador e financeiro (financeiro precisa para joins)
CREATE POLICY ordens_servico_select_by_categoria
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

-- INSERT/UPDATE/DELETE: apenas administrador e operador
CREATE POLICY ordens_servico_write_by_categoria
  ON public.ordens_servico FOR ALL TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

-- ============================================================
-- drivers: substituir policy permissiva por categoria
-- ============================================================

DROP POLICY IF EXISTS drivers_auth_all ON public.drivers;

CREATE POLICY drivers_select_by_categoria
  ON public.drivers FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

CREATE POLICY drivers_write_by_categoria
  ON public.drivers FOR ALL TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

-- ============================================================
-- passageiros: substituir policy permissiva por categoria
-- ============================================================

DROP POLICY IF EXISTS passageiros_auth_all ON public.passageiros;

CREATE POLICY passageiros_select_by_categoria
  ON public.passageiros FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

CREATE POLICY passageiros_write_by_categoria
  ON public.passageiros FOR ALL TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

-- ============================================================
-- clientes: substituir policy permissiva por categoria
-- ============================================================

DROP POLICY IF EXISTS clientes_auth_all ON public.clientes;

CREATE POLICY clientes_select_by_categoria
  ON public.clientes FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

CREATE POLICY clientes_write_by_categoria
  ON public.clientes FOR ALL TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

-- ============================================================
-- veiculos: substituir policies permissivas por categoria
-- ============================================================

DROP POLICY IF EXISTS veiculos_select_all ON public.veiculos;
DROP POLICY IF EXISTS veiculos_insert_authenticated ON public.veiculos;
DROP POLICY IF EXISTS veiculos_update_authenticated ON public.veiculos;
DROP POLICY IF EXISTS veiculos_delete_authenticated ON public.veiculos;

CREATE POLICY veiculos_select_by_categoria
  ON public.veiculos FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

CREATE POLICY veiculos_insert_by_categoria
  ON public.veiculos FOR INSERT TO authenticated
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY veiculos_update_by_categoria
  ON public.veiculos FOR UPDATE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY veiculos_delete_by_categoria
  ON public.veiculos FOR DELETE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'));

-- ============================================================
-- parceiros_servico: substituir policies permissivas por categoria
-- ============================================================

DROP POLICY IF EXISTS parceiros_select_all ON public.parceiros_servico;
DROP POLICY IF EXISTS parceiros_insert_authenticated ON public.parceiros_servico;
DROP POLICY IF EXISTS parceiros_update_authenticated ON public.parceiros_servico;
DROP POLICY IF EXISTS parceiros_delete_authenticated ON public.parceiros_servico;

CREATE POLICY parceiros_select_by_categoria
  ON public.parceiros_servico FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

CREATE POLICY parceiros_insert_by_categoria
  ON public.parceiros_servico FOR INSERT TO authenticated
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY parceiros_update_by_categoria
  ON public.parceiros_servico FOR UPDATE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY parceiros_delete_by_categoria
  ON public.parceiros_servico FOR DELETE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'));

-- ============================================================
-- parceiros_contatos: substituir policies permissivas por categoria
-- ============================================================

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.parceiros_contatos;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON public.parceiros_contatos;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON public.parceiros_contatos;
DROP POLICY IF EXISTS "Enable delete for all authenticated users" ON public.parceiros_contatos;

CREATE POLICY parceiros_contatos_select_by_categoria
  ON public.parceiros_contatos FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

CREATE POLICY parceiros_contatos_insert_by_categoria
  ON public.parceiros_contatos FOR INSERT TO authenticated
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY parceiros_contatos_update_by_categoria
  ON public.parceiros_contatos FOR UPDATE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY parceiros_contatos_delete_by_categoria
  ON public.parceiros_contatos FOR DELETE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'));

-- ============================================================
-- parceiros_filiais: substituir policies permissivas por categoria
-- ============================================================

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.parceiros_filiais;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON public.parceiros_filiais;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON public.parceiros_filiais;
DROP POLICY IF EXISTS "Enable delete for all authenticated users" ON public.parceiros_filiais;

CREATE POLICY parceiros_filiais_select_by_categoria
  ON public.parceiros_filiais FOR SELECT TO authenticated
  USING (
    public.user_categoria() IN ('administrador', 'operador', 'financeiro')
  );

CREATE POLICY parceiros_filiais_insert_by_categoria
  ON public.parceiros_filiais FOR INSERT TO authenticated
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY parceiros_filiais_update_by_categoria
  ON public.parceiros_filiais FOR UPDATE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'))
  WITH CHECK (public.user_categoria() IN ('administrador', 'operador'));

CREATE POLICY parceiros_filiais_delete_by_categoria
  ON public.parceiros_filiais FOR DELETE TO authenticated
  USING (public.user_categoria() IN ('administrador', 'operador'));
