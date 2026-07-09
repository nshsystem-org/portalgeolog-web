-- Migration: Feature flags por fase para os-reminders
--
-- Adiciona 3 novos flags em app_settings para controle granular das fases
-- de lembrete do motorista:
--   os_reminders_12h_enabled          → fase 1 (lembrete 12h antes)
--   os_reminders_start_button_enabled → fase 2 (botão iniciar 1h antes)
--   os_reminders_delay_alert_enabled  → fases 4+5 (alertas de atraso T+5/T+30)
--
-- O flag global os_reminders_enabled (já existente) continua funcionando.
-- Se qualquer flag não existir, o código assume true (backward compatible).
-- Estes inserts garantem que os defaults ficam explícitos no banco.

INSERT INTO app_settings (key, value, updated_at)
VALUES
  ('os_reminders_12h_enabled', 'true', now()),
  ('os_reminders_start_button_enabled', 'true', now()),
  ('os_reminders_delay_alert_enabled', 'true', now())
ON CONFLICT (key) DO NOTHING;
