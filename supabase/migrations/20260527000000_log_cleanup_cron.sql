-- Migration: Auto-delete logs older than 90 days via pg_cron
-- ============================================================================
-- This migration creates a maintenance job that runs daily at 03:00 UTC to
-- delete frontend_error_logs older than 90 days, keeping the table lean.
-- ============================================================================

-- 1. Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the cleanup function (idempotent)
CREATE OR REPLACE FUNCTION delete_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.frontend_error_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Optional: log cleanup action to the table itself (last entry)
  IF deleted_count > 0 THEN
    INSERT INTO public.frontend_error_logs (
      user_id,
      error_level,
      component,
      function_name,
      error_message,
      error_details,
      url,
      user_agent
    ) VALUES (
      NULL,
      'info',
      'LogCleanup',
      'delete_old_logs',
      format('Limpeza automática: %s logs apagados (mais de 90 dias)', deleted_count),
      jsonb_build_object('deleted_count', deleted_count, 'retention_days', 90, 'ran_at', NOW()),
      'cron://pg_cron',
      'pg_cron/1.0'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION delete_old_logs() IS
  'Deletes frontend_error_logs older than 90 days and logs the cleanup count.';

-- 3. Schedule the daily cleanup job via pg_cron (idempotent)
--    Runs every day at 03:00 UTC (low-traffic hour)
DO $$
BEGIN
  -- Try to unschedule if already exists (ignore error if job doesn't exist)
  BEGIN
    PERFORM cron.unschedule('cleanup-old-logs');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;

  PERFORM cron.schedule(
    'cleanup-old-logs',      -- job name
    '0 3 * * *',            -- cron expression: 03:00 daily
    'SELECT delete_old_logs();'
  );
END $$;

-- 4. Add table comment documenting retention policy
COMMENT ON TABLE public.frontend_error_logs IS
  'Frontend log entries. Retention: 90 days (auto-deleted by pg_cron job).';
