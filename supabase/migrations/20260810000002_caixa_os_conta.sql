-- =============================================================================
-- Migration: caixa_os_conta
-- Data: 2026-08-10
-- =============================================================================
-- Adiciona coluna caixa_conta_id em ordens_servico para permitir que cada OS
-- direcione seus lancamentos de caixa (recebimento/repasse) para uma conta
-- especifica. Quando NULL, o trigger usa a conta default.
-- =============================================================================

-- 1. Adiciona coluna na OS (nullable, FK com ON DELETE SET NULL)
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS caixa_conta_id UUID
  REFERENCES public.caixa_contas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_os_caixa_conta
  ON public.ordens_servico(caixa_conta_id) WHERE caixa_conta_id IS NOT NULL;

-- 2. Atualiza trigger de recebimento para usar conta da OS quando definida
CREATE OR REPLACE FUNCTION public.trigger_caixa_espelhar_recebimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conta_id UUID;
  v_valor NUMERIC;
BEGIN
  -- So dispara quando status_financeiro muda para 'Recebido'
  IF NEW.status_financeiro IS DISTINCT FROM OLD.status_financeiro
     AND NEW.status_financeiro = 'Recebido' THEN

    -- Usa a conta definida na OS, senao cai na default
    v_conta_id := COALESCE(NEW.caixa_conta_id, public.resolve_caixa_default_conta());
    IF v_conta_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_valor := COALESCE(NEW.valor_bruto, 0);
    IF v_valor <= 0 THEN RETURN NEW; END IF;

    INSERT INTO public.caixa_lancamentos (
      conta_id, tipo, valor, data, descricao, categoria,
      forma_pagamento, cliente_id, os_id, origem
    ) VALUES (
      v_conta_id,
      'entrada',
      v_valor,
      COALESCE((NEW.financeiro_recebido_em AT TIME ZONE 'America/Sao_Paulo')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
      COALESCE('Recebimento OS ' || NEW.protocolo, 'Recebimento de OS'),
      'recebimento_cliente',
      'outro',
      NEW.cliente_id,
      NEW.id,
      'os_recebimento'
    )
    ON CONFLICT (os_id, origem) WHERE origem IN ('os_recebimento','os_repasse') DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Atualiza trigger de repasse para usar conta da OS quando definida
CREATE OR REPLACE FUNCTION public.trigger_caixa_espelhar_repasse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conta_id UUID;
  v_valor NUMERIC;
BEGIN
  -- So dispara quando repasse_pago muda de false para true
  IF (NEW.repasse_pago IS TRUE) AND (OLD.repasse_pago IS NOT TRUE)
     AND NEW.repasse_pago IS DISTINCT FROM OLD.repasse_pago THEN

    -- Usa a conta definida na OS, senao cai na default
    v_conta_id := COALESCE(NEW.caixa_conta_id, public.resolve_caixa_default_conta());
    IF v_conta_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_valor := COALESCE(NEW.custo, 0);
    IF v_valor <= 0 THEN RETURN NEW; END IF;

    INSERT INTO public.caixa_lancamentos (
      conta_id, tipo, valor, data, descricao, categoria,
      forma_pagamento, driver_id, os_id, origem
    ) VALUES (
      v_conta_id,
      'saida',
      v_valor,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,
      COALESCE('Repasse motorista OS ' || NEW.protocolo, 'Repasse ao motorista'),
      'repasse_motorista',
      'outro',
      NEW.driver_id,
      NEW.id,
      'os_repasse'
    )
    ON CONFLICT (os_id, origem) WHERE origem IN ('os_recebimento','os_repasse') DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers nao precisam ser recriados (DROP+CREATE) pois as funcoes foram
-- substituidas com CREATE OR REPLACE e os triggers existentes apontam para elas.
