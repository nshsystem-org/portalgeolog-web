-- Migration: Corrige 2 bugs
--
-- Bug 1: CHECK constraint de os_logs.type nao incluia 'driver_edit_ack'
--   → insert do webhook falhava silenciosamente quando motorista clicava
--     "ESTOU CIENTE" no template alteracao_viagem_motorista
--
-- Bug 2: (corrigido no codigo) waypointsChanged comparava hora/data dos
--   waypoints, causando falso positivo de "endereço mudou" quando só o
--   horário da OS mudava. Agora compara apenas o label (endereço).

-- Adiciona driver_edit_ack ao CHECK constraint
ALTER TABLE public.os_logs DROP CONSTRAINT IF EXISTS os_logs_type_check;
ALTER TABLE public.os_logs ADD CONSTRAINT os_logs_type_check
CHECK ((type = ANY (ARRAY[
  'create'::text, 'update'::text, 'status_change'::text,
  'archive'::text, 'unarchive'::text,
  'driver_accept'::text, 'driver_start'::text, 'driver_finish'::text,
  'driver_notify'::text, 'driver_delivered'::text,
  'passenger_notify'::text, 'passenger_confirm'::text,
  'comment'::text, 'driver_delay'::text,
  'driver_edit_ack'::text
])));
