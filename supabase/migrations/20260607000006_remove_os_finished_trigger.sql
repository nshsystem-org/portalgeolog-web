-- Remove redundant OS finished notification trigger from ordens_servico.
-- Finalization notifications are now generated from os_logs status_change events
-- to keep a single source of truth and avoid duplicate app_notifications rows.

DROP TRIGGER IF EXISTS notify_os_finished_trigger ON public.ordens_servico;
DROP FUNCTION IF EXISTS public.handle_os_finished_notification();
