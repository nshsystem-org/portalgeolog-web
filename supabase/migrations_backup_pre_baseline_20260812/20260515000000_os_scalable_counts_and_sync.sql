-- Migration: OS scalable counts, status sync and optimized queries
-- Purpose: Enable server-side COUNT/CALENDAR/ACTIVE checks without loading all OS rows

-- 1. Helper function to compute operational status from driver_operation_cycles
CREATE OR REPLACE FUNCTION compute_operational_status(cycles jsonb)
RETURNS text AS $$
DECLARE
  has_awaiting_finish boolean := false;
  has_awaiting_accept   boolean := false;
  active_count          int     := 0;
  completed_count       int     := 0;
  c                     jsonb;
BEGIN
  IF cycles IS NULL OR jsonb_array_length(cycles) = 0 THEN
    RETURN 'Pendente';
  END IF;

  FOR c IN SELECT * FROM jsonb_array_elements(cycles)
  LOOP
    IF (c->>'state') IN ('awaiting_finish', 'awaiting_km_finish') THEN
      has_awaiting_finish := true;
    ELSIF (c->>'state') IN ('awaiting_accept', 'awaiting_start', 'awaiting_km_start') THEN
      has_awaiting_accept := true;
    END IF;

    IF (c->>'state') != 'cancelled' THEN
      active_count := active_count + 1;
      IF (c->>'state') = 'completed' THEN
        completed_count := completed_count + 1;
      END IF;
    END IF;
  END LOOP;

  IF has_awaiting_finish THEN RETURN 'Em Rota'; END IF;
  IF has_awaiting_accept   THEN RETURN 'Aguardando'; END IF;
  IF active_count > 0 AND active_count = completed_count THEN RETURN 'Finalizado'; END IF;
  IF active_count = 0 THEN RETURN 'Cancelado'; END IF;
  RETURN 'Pendente';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Trigger to keep status_operacional in sync with driver_operation_cycles
CREATE OR REPLACE FUNCTION trg_sync_status_operacional()
RETURNS trigger AS $$
BEGIN
  NEW.status_operacional := compute_operational_status(NEW.driver_operation_cycles);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_status_operacional_trigger ON ordens_servico;
CREATE TRIGGER sync_status_operacional_trigger
  BEFORE INSERT OR UPDATE OF driver_operation_cycles ON ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_status_operacional();

-- 3. Backfill existing rows so the column matches the cycles
UPDATE ordens_servico
SET status_operacional = compute_operational_status(driver_operation_cycles)
WHERE driver_operation_cycles IS NOT NULL;

-- 4. Index for fast COUNT queries by status + arquivado
CREATE INDEX IF NOT EXISTS idx_ordens_servico_arquivado_status
  ON ordens_servico USING btree (arquivado, status_operacional);

-- 5. RPC: COUNT grouped by status (for dashboard cards)
CREATE OR REPLACE FUNCTION get_os_status_counts()
RETURNS TABLE(status text, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT o.status_operacional, COUNT(*)::bigint
  FROM ordens_servico o
  WHERE o.arquivado = false
  GROUP BY o.status_operacional;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Lightweight calendar events in a date range
CREATE OR REPLACE FUNCTION get_os_calendar_events(
  p_from date,
  p_to   date
)
RETURNS TABLE(
  id               uuid,
  protocolo        text,
  data             date,
  hora             text,
  status_operacional text,
  cliente_id       uuid,
  motorista        text,
  driver_id        uuid,
  veiculo_id       uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.protocolo,
    o.data,
    o.hora,
    o.status_operacional,
    o.cliente_id,
    o.motorista,
    o.driver_id,
    o.veiculo_id
  FROM ordens_servico o
  WHERE o.arquivado = false
    AND o.data BETWEEN p_from AND p_to
  ORDER BY o.data, o.hora;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Check if driver+vehicle already have an active (non-finalized/non-cancelled) OS
CREATE OR REPLACE FUNCTION check_active_os_for_driver_vehicle(
  p_driver_id     uuid,
  p_vehicle_id    uuid,
  p_exclude_os_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ordens_servico o
    WHERE o.arquivado = false
      AND o.driver_id = p_driver_id
      AND o.veiculo_id = p_vehicle_id
      AND o.status_operacional NOT IN ('Finalizado', 'Cancelado')
      AND (p_exclude_os_id IS NULL OR o.id != p_exclude_os_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
