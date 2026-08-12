-- Add created_by columns to app_notifications
alter table public.app_notifications
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists created_by_name text;

create index if not exists idx_app_notifications_created_by
  on public.app_notifications(created_by)
  where created_by is not null;

comment on column public.app_notifications.created_by is 'ID do usuário que gerou a notificação.';
comment on column public.app_notifications.created_by_name is 'Nome do usuário que gerou a notificação, para exibição rápida.';
