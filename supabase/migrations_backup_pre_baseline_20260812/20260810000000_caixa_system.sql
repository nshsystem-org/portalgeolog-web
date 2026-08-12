-- =============================================================================
-- Migration: caixa_system
-- Data: 2026-08-10
-- =============================================================================
-- Sistema de fluxo de caixa com múltiplas contas, lançamentos manuais
-- (entradas/saídas) com categoria, forma de pagamento, vínculo a entidades
-- (cliente/parceiro/motorista/OS) e upload de comprovantes.
--
-- Lançamentos de origem 'os_recebimento' e 'os_repasse' são criados
-- automaticamente por triggers quando uma OS é marcada como recebida ou
-- quando o repasse ao motorista é marcado como pago.
--
-- Realtime ativo nas duas tabelas para atualização instantânea do frontend.
-- =============================================================================

-- =============================================================================
-- Tabela: caixa_contas
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.caixa_contas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'caixa' CHECK (tipo IN ('caixa','banco','pix','carteira')),
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_contas_ativa ON public.caixa_contas(ativa);

-- Garante apenas uma conta default ativa por vez
DROP INDEX IF EXISTS idx_caixa_contas_single_default;
CREATE UNIQUE INDEX idx_caixa_contas_single_default
  ON public.caixa_contas(is_default) WHERE is_default = TRUE;

-- =============================================================================
-- Tabela: caixa_lancamentos
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.caixa_lancamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES public.caixa_contas(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  descricao TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL DEFAULT 'outros',
  forma_pagamento TEXT NOT NULL DEFAULT 'outro' CHECK (forma_pagamento IN ('pix','dinheiro','cartao_credito','cartao_debito','transferencia','boleto','outro')),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  parceiro_id UUID,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','os_recebimento','os_repasse')),
  anexo_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_conta ON public.caixa_lancamentos(conta_id);
CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_data ON public.caixa_lancamentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_tipo ON public.caixa_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_origem ON public.caixa_lancamentos(origem);
CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_os ON public.caixa_lancamentos(os_id) WHERE os_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_cliente ON public.caixa_lancamentos(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_caixa_lancamentos_driver ON public.caixa_lancamentos(driver_id) WHERE driver_id IS NOT NULL;

-- Uma única entrada automática por OS/origem (evita duplicar ao re-marcar)
CREATE UNIQUE INDEX IF NOT EXISTS idx_caixa_lancamentos_os_origem_unique
  ON public.caixa_lancamentos(os_id, origem) WHERE origem IN ('os_recebimento','os_repasse');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_caixa_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_caixa_contas_updated_at ON public.caixa_contas;
CREATE TRIGGER trg_caixa_contas_updated_at
  BEFORE UPDATE ON public.caixa_contas
  FOR EACH ROW EXECUTE FUNCTION public.set_caixa_updated_at();

DROP TRIGGER IF EXISTS trg_caixa_lancamentos_updated_at ON public.caixa_lancamentos;
CREATE TRIGGER trg_caixa_lancamentos_updated_at
  BEFORE UPDATE ON public.caixa_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_caixa_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.caixa_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_lancamentos ENABLE ROW LEVEL SECURITY;

-- Contas: leitura para autenticados, escrita apenas service_role
DROP POLICY IF EXISTS "caixa_contas_read_authenticated" ON public.caixa_contas;
CREATE POLICY "caixa_contas_read_authenticated" ON public.caixa_contas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "caixa_contas_write_service" ON public.caixa_contas;
CREATE POLICY "caixa_contas_write_service" ON public.caixa_contas
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Lançamentos: leitura para autenticados, escrita apenas service_role
DROP POLICY IF EXISTS "caixa_lancamentos_read_authenticated" ON public.caixa_lancamentos;
CREATE POLICY "caixa_lancamentos_read_authenticated" ON public.caixa_lancamentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "caixa_lancamentos_write_service" ON public.caixa_lancamentos;
CREATE POLICY "caixa_lancamentos_write_service" ON public.caixa_lancamentos
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- Função: resolve a conta default (ou primeira ativa) para lançamentos auto
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_caixa_default_conta()
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_conta_id UUID;
BEGIN
  SELECT id INTO v_conta_id
  FROM public.caixa_contas
  WHERE is_default = TRUE AND ativa = TRUE
  LIMIT 1;

  IF v_conta_id IS NULL THEN
    SELECT id INTO v_conta_id
    FROM public.caixa_contas
    WHERE ativa = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_conta_id;
END;
$$;

-- =============================================================================
-- Trigger: espelhar recebimento de OS como entrada de caixa
-- =============================================================================
-- WHEN status_financeiro muda de 'Faturado' -> 'Recebido'
-- INSERT caixa_lancamento (entrada, origem=os_recebimento, valor=valor_bruto)
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
  -- Só dispara quando status_financeiro muda para 'Recebido'
  IF NEW.status_financeiro IS DISTINCT FROM OLD.status_financeiro
     AND NEW.status_financeiro = 'Recebido' THEN

    v_conta_id := public.resolve_caixa_default_conta();
    IF v_conta_id IS NULL THEN
      -- Sem conta ativa: ignora silenciosamente (admin pode criar conta depois)
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

DROP TRIGGER IF EXISTS trg_caixa_espelhar_recebimento ON public.ordens_servico;
CREATE TRIGGER trg_caixa_espelhar_recebimento
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.status_financeiro IS DISTINCT FROM OLD.status_financeiro)
  EXECUTE FUNCTION public.trigger_caixa_espelhar_recebimento();

-- =============================================================================
-- Trigger: espelhar repasse ao motorista como saída de caixa
-- =============================================================================
-- WHEN repasse_pago muda de false -> true
-- INSERT caixa_lancamento (saida, origem=os_repasse, valor=custo)
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
  -- Só dispara quando repasse_pago muda de false para true
  IF (NEW.repasse_pago IS TRUE) AND (OLD.repasse_pago IS NOT TRUE)
     AND NEW.repasse_pago IS DISTINCT FROM OLD.repasse_pago THEN

    v_conta_id := public.resolve_caixa_default_conta();
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

DROP TRIGGER IF EXISTS trg_caixa_espelhar_repasse ON public.ordens_servico;
CREATE TRIGGER trg_caixa_espelhar_repasse
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.repasse_pago IS DISTINCT FROM OLD.repasse_pago)
  EXECUTE FUNCTION public.trigger_caixa_espelhar_repasse();

-- =============================================================================
-- Realtime
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixa_contas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixa_lancamentos;
