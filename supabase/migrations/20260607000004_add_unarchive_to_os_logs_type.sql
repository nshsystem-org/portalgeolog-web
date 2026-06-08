-- Add 'unarchive' to os_logs type check constraint
-- The type 'unarchive' was missing from the os_logs_type_check constraint,
-- causing unarchive log inserts to fail silently.

ALTER TABLE public.os_logs DROP CONSTRAINT IF EXISTS os_logs_type_check;
ALTER TABLE public.os_logs ADD CONSTRAINT os_logs_type_check CHECK (type = ANY (ARRAY['create'::text, 'update'::text, 'status_change'::text, 'archive'::text, 'unarchive'::text, 'driver_accept'::text, 'driver_start'::text, 'driver_finish'::text, 'passenger_notify'::text, 'passenger_confirm'::text, 'comment'::text]));
