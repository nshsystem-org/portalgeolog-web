-- Drop legacy driver_operation_cycles from ordens_servico.
-- Keep ordens_servico otherwise intact.

DROP TRIGGER IF EXISTS sync_status_operacional_trigger ON public.ordens_servico;
DROP FUNCTION IF EXISTS public.trg_sync_status_operacional();
DROP FUNCTION IF EXISTS public.compute_operational_status(jsonb);
DROP TRIGGER IF EXISTS sync_ordens_servico_operational_cycles_trigger ON public.os_operational_cycles;
DROP FUNCTION IF EXISTS public.sync_ordens_servico_operational_cycles();

ALTER TABLE public.ordens_servico
  DROP COLUMN IF EXISTS driver_operation_cycles,
  DROP COLUMN IF EXISTS current_driver_cycle_index;
