-- Adiciona coluna is_active em user_roles para permitir desativação real de
-- usuários pela tela /portal/config/acessos, em vez do toggle "Ativo" que
-- hoje é apenas decorativo (não persiste nada).
alter table public.user_roles
  add column if not exists is_active boolean not null default true;

comment on column public.user_roles.is_active is
  'Quando false, o usuário é considerado desativado: perde acesso a todas as páginas (ver hasPageAccess) e é deslogado automaticamente pelo listener realtime do AuthContext.';
