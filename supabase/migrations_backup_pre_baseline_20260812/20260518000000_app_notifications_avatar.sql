-- Add created_by_avatar_url to app_notifications for circular avatar display
alter table public.app_notifications
  add column if not exists created_by_avatar_url text;

comment on column public.app_notifications.created_by_avatar_url
  is 'URL do avatar do usuário que gerou a notificação, para exibição rápida.';
