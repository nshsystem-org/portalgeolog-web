-- Migration: Corrige derive_os_operational_status_from_cycles para tratar
-- ciclos "pending" como "Aguardando" quando há ciclos já concluídos.
--
-- Bug: Ao finalizar manualmente um ciclo (finish_cycle) com ciclos posteriores
-- ainda "pending", a função retornava "Pendente" porque o estado "pending" não
-- se encaixava em nenhuma das verificações (awaiting_*, completed, cancelled).
-- Isso fazia o status da OS reverter para "Pendente" mesmo com ciclos concluídos.
--
-- Correção: se há ciclos concluídos mas nem todos os ativos estão concluídos,
-- os ciclos "pending" restantes devem ser tratados como "Aguardando" (próximo
-- ciclo aguardando ativação). Só retorna "Pendente" se TODOS os ciclos ativos
-- estão "pending" (nenhum ciclo foi ativado ainda).

CREATE OR REPLACE FUNCTION public.derive_os_operational_status_from_cycles(
  p_os_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_has_in_progress BOOLEAN;
  v_has_waiting     BOOLEAN;
  v_active_total    INTEGER;
  v_completed_total INTEGER;
BEGIN
  SELECT
    COALESCE(BOOL_OR(state IN ('awaiting_finish', 'awaiting_km_finish')), false),
    COALESCE(BOOL_OR(state IN ('awaiting_accept', 'awaiting_start', 'awaiting_km_start')), false),
    COUNT(*) FILTER (WHERE state <> 'cancelled'),
    COUNT(*) FILTER (WHERE state = 'completed')
  INTO v_has_in_progress, v_has_waiting, v_active_total, v_completed_total
  FROM public.os_operational_cycles
  WHERE ordem_servico_id = p_os_id;

  IF v_has_in_progress THEN RETURN 'Em Rota';   END IF;
  IF v_has_waiting     THEN RETURN 'Aguardando'; END IF;
  IF v_active_total > 0 AND v_active_total = v_completed_total THEN RETURN 'Finalizado'; END IF;
  IF v_active_total = 0 THEN RETURN 'Cancelado'; END IF;

  -- Se há ciclos concluídos mas nem todos os ativos estão concluídos,
  -- os ciclos "pending" restantes estão aguardando ativação.
  IF v_completed_total > 0 THEN RETURN 'Aguardando'; END IF;

  RETURN 'Pendente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
