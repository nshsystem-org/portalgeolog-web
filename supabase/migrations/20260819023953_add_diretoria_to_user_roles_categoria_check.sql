-- Atualiza a constraint de categoria em user_roles para incluir 'diretoria'
alter table public.user_roles
  drop constraint if exists user_roles_categoria_check;

alter table public.user_roles
  add constraint user_roles_categoria_check
  check (categoria in ('administrador', 'diretoria', 'gestor', 'financeiro', 'operador', 'jovem aprendiz'));
