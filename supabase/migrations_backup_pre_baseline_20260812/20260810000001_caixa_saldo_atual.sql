-- =============================================================================
-- Migration: caixa_saldo_atual
-- Data: 2026-08-10
-- =============================================================================
-- Materializa o saldo de cada conta em uma coluna saldo_atual para evitar
-- scan completo de caixa_lancamentos a cada consulta de stats.
-- Trigger recalcula saldo_atual a cada INSERT/UPDATE/DELETE em lancamentos.
-- =============================================================================

-- 1. Adiciona coluna saldo_atual
ALTER TABLE public.caixa_contas
  ADD COLUMN IF NOT EXISTS saldo_atual NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 2. Backfill: calcula saldo_atual = saldo_inicial + sum(entradas) - sum(saidas)
UPDATE public.caixa_contas c
SET saldo_atual = COALESCE(
  c.saldo_inicial, 0
) + COALESCE((
  SELECT SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE -l.valor END)
  FROM public.caixa_lancamentos l
  WHERE l.conta_id = c.id
), 0);

-- 3. Funcao para recalcular o saldo de uma conta a partir de lancamentos
CREATE OR REPLACE FUNCTION public.recalc_caixa_saldo(p_conta_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_saldo_inicial NUMERIC;
  v_delta NUMERIC;
BEGIN
  SELECT COALESCE(saldo_inicial, 0) INTO v_saldo_inicial
  FROM public.caixa_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0)
  INTO v_delta
  FROM public.caixa_lancamentos WHERE conta_id = p_conta_id;

  UPDATE public.caixa_contas
  SET saldo_atual = v_saldo_inicial + v_delta
  WHERE id = p_conta_id;
END;
$$;

-- 4. Trigger: recalcular saldo a cada mudanca em lancamentos
CREATE OR REPLACE FUNCTION public.trigger_caixa_recalc_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_old_conta UUID;
  v_new_conta UUID;
BEGIN
  v_old_conta := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.conta_id END;
  v_new_conta := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.conta_id END;

  -- Se a conta mudou (UPDATE) ou lancamento foi inserido/deletado, recalcula ambas
  IF v_old_conta IS NOT NULL AND v_old_conta IS DISTINCT FROM v_new_conta THEN
    PERFORM public.recalc_caixa_saldo(v_old_conta);
  END IF;
  IF v_new_conta IS NOT NULL THEN
    PERFORM public.recalc_caixa_saldo(v_new_conta);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_caixa_lancamentos_saldo ON public.caixa_lancamentos;
CREATE TRIGGER trg_caixa_lancamentos_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.caixa_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_caixa_recalc_saldo();

-- 5. Tambem recalcula quando o saldo_inicial de uma conta muda
CREATE OR REPLACE FUNCTION public.trigger_caixa_contas_saldo_init()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.saldo_inicial IS DISTINCT FROM OLD.saldo_inicial THEN
    PERFORM public.recalc_caixa_saldo(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_caixa_contas_saldo_init ON public.caixa_contas;
CREATE TRIGGER trg_caixa_contas_saldo_init
  AFTER UPDATE OF saldo_inicial ON public.caixa_contas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_caixa_contas_saldo_init();
