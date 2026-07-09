-- Migration: Feature flag para notificações de edição de OS
--
-- Adiciona flag para controlar se motoristas são notificados via WhatsApp
-- quando uma OS é editada (mudança de horário, endereço, ou troca de motorista).
--
-- Se o flag não existir, o código assume true (backward compatible).

INSERT INTO app_settings (key, value, updated_at)
VALUES
  ('os_edit_notify_enabled', 'true', now())
ON CONFLICT (key) DO NOTHING;
