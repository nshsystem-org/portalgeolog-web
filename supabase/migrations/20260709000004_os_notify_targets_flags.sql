-- Migration: Flags para controlar destinatarios de notificacao automatica
-- na criacao/edicao de OS.
--
-- 3 flags independentes, controladas via pagina /portal/config:
--   os_notify_driver_enabled      → "Motorista Alocado" (template appointment_scheduling)
--   os_notify_passengers_enabled  → "Passageiros da Rota"
--   os_notify_solicitante_enabled → "Solicitante da Empresa"
--
-- Quando uma flag esta "false", o toggle correspondente no modal de
-- notificacoes da OS fica desativado (disabled) e nao pode ser ligado
-- pelo operador. Quando esta "true", o operador pode ligar/desligar
-- livremente no modal.

INSERT INTO public.app_settings (key, value, updated_at) VALUES
  ('os_notify_driver_enabled', 'true', now()),
  ('os_notify_passengers_enabled', 'false', now()),
  ('os_notify_solicitante_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;
