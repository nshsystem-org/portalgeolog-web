-- Migration: Adiciona app_settings na publicacao Realtime do Supabase
-- Necessario para que mudancas nas flags de notificacao (os_notify_*)
-- sejam refletidas em tempo real no modal de OS e na pagina de config.

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
