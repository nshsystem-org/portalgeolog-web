-- A migration 20260819023953 adicionou 'diretoria' ao CHECK de user_roles.categoria,
-- mas nenhuma politica RLS foi atualizada para incluir essa categoria. Como resultado,
-- usuarios com categoria 'diretoria' (ex.: Luciana Barcelos) tinham acesso de pagina
-- liberado (via permissions.ts BASE_ACCESS), mas nao viam nenhuma linha nas tabelas
-- operacionais por causa do RLS, que so contemplava administrador/operador/financeiro.
--
-- Conforme a matriz documentada em src/lib/permissions.ts, 'diretoria' tem paridade
-- total (nao overridable) com 'administrador' em: ordens_servico, motoristas (drivers),
-- veiculos, passageiros, clientes, parcerias (parceiros_*), fornecedores, financeiro
-- (caixa_categorias/caixa_formas_pagamento) e caixa.

-- ordens_servico
alter policy ordens_servico_select_by_categoria on public.ordens_servico
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy ordens_servico_write_by_categoria on public.ordens_servico
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- clientes
alter policy clientes_select_by_categoria on public.clientes
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy clientes_write_by_categoria on public.clientes
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- drivers (motoristas)
alter policy drivers_select_by_categoria on public.drivers
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy drivers_write_by_categoria on public.drivers
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- veiculos
alter policy veiculos_select_by_categoria on public.veiculos
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy veiculos_insert_by_categoria on public.veiculos
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy veiculos_update_by_categoria on public.veiculos
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy veiculos_delete_by_categoria on public.veiculos
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- passageiros
alter policy passageiros_select_by_categoria on public.passageiros
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy passageiros_write_by_categoria on public.passageiros
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- fornecedores
alter policy fornecedores_select_by_categoria on public.fornecedores
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy fornecedores_insert_by_categoria on public.fornecedores
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy fornecedores_update_by_categoria on public.fornecedores
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy fornecedores_delete_by_categoria on public.fornecedores
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- parceiros_servico
alter policy parceiros_select_by_categoria on public.parceiros_servico
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy parceiros_insert_by_categoria on public.parceiros_servico
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy parceiros_update_by_categoria on public.parceiros_servico
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy parceiros_delete_by_categoria on public.parceiros_servico
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- parceiros_contatos
alter policy parceiros_contatos_select_by_categoria on public.parceiros_contatos
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy parceiros_contatos_insert_by_categoria on public.parceiros_contatos
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy parceiros_contatos_update_by_categoria on public.parceiros_contatos
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy parceiros_contatos_delete_by_categoria on public.parceiros_contatos
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- parceiros_filiais
alter policy parceiros_filiais_select_by_categoria on public.parceiros_filiais
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy parceiros_filiais_insert_by_categoria on public.parceiros_filiais
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy parceiros_filiais_update_by_categoria on public.parceiros_filiais
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy parceiros_filiais_delete_by_categoria on public.parceiros_filiais
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- caixa_categorias
alter policy caixa_categorias_select on public.caixa_categorias
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy caixa_categorias_insert on public.caixa_categorias
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy caixa_categorias_update on public.caixa_categorias
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy caixa_categorias_delete on public.caixa_categorias
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

-- caixa_formas_pagamento
alter policy caixa_formas_select on public.caixa_formas_pagamento
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador', 'financeiro']));

alter policy caixa_formas_insert on public.caixa_formas_pagamento
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy caixa_formas_update on public.caixa_formas_pagamento
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']))
  with check (user_categoria() = any (array['administrador', 'diretoria', 'operador']));

alter policy caixa_formas_delete on public.caixa_formas_pagamento
  using (user_categoria() = any (array['administrador', 'diretoria', 'operador']));
