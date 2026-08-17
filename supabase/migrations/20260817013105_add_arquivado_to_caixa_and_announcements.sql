-- Soft-delete para lançamentos de caixa e avisos do sistema.
-- Recalcula saldo de caixa ignorando lançamentos arquivados.

ALTER TABLE public.caixa_lancamentos
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_arquivado
  ON public.caixa_lancamentos (arquivado)
  WHERE arquivado = false;

ALTER TABLE public.system_announcements
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_system_announcements_arquivado
  ON public.system_announcements (arquivado)
  WHERE arquivado = false;

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
  FROM public.caixa_lancamentos
  WHERE conta_id = p_conta_id
    AND arquivado = false;

  UPDATE public.caixa_contas
  SET saldo_atual = v_saldo_inicial + v_delta
  WHERE id = p_conta_id;
END;
$$;
