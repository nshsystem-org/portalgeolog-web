-- =============================================================================
-- Migration: docagem
-- Data: 2026-06-20
-- =============================================================================
-- Cria tabelas dedicadas para a funcionalidade de "Docagem" (OS recorrente).
-- A docagem vive totalmente separada de ordens_servico: não há FKs, triggers
-- nem campos compartilhados entre docagem e OS. A integração com a tela de
-- OS é visual (cards no calendário e filtro) e, futuramente, a tela de
-- financeiro pode mostrar os lançamentos de docagem lado a lado com os das
-- OS sem alterar o schema financeiro existente.
-- =============================================================================

-- =============================================================================
-- 1. Tabela mãe de docagens
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.docagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  solicitante_id UUID REFERENCES public.solicitantes(id) ON DELETE SET NULL,
  motorista_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  endereco TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  dias_semana INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}'::INTEGER[],
  valor_diario NUMERIC(12,2) NOT NULL,
  custo_diario NUMERIC(12,2),
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'finalizada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.docagens IS 'OS recorrente (docagem) que se replica em vários dias.';

-- =============================================================================
-- 2. Tabela de instâncias diárias da docagem
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.docagem_instancias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docagem_id UUID NOT NULL REFERENCES public.docagens(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  endereco TEXT NOT NULL,
  motorista_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL,
  custo NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'finalizada', 'excluida')),
  finalizada_em TIMESTAMPTZ,
  finalizada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (docagem_id, data)
);

COMMENT ON TABLE public.docagem_instancias IS 'Cada dia expandido de uma docagem, com dados editáveis por dia.';

-- =============================================================================
-- 3. Tabela de lançamentos financeiros da docagem (própria, sem FK para OS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.docagem_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docagem_instancia_id UUID NOT NULL REFERENCES public.docagem_instancias(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  motorista_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL,
  custo NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto', 'realizado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.docagem_lancamentos IS 'Lançamentos financeiros gerados ao finalizar cada dia de docagem.';

-- =============================================================================
-- 4. Índices
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_docagens_cliente ON public.docagens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_docagens_status ON public.docagens(status);
CREATE INDEX IF NOT EXISTS idx_docagem_instancias_docagem_data ON public.docagem_instancias(docagem_id, data);
CREATE INDEX IF NOT EXISTS idx_docagem_instancias_status ON public.docagem_instancias(status);
CREATE INDEX IF NOT EXISTS idx_docagem_instancias_data ON public.docagem_instancias(data);
CREATE INDEX IF NOT EXISTS idx_docagem_lancamentos_instancia ON public.docagem_lancamentos(docagem_instancia_id);

-- =============================================================================
-- 5. RLS (padrão aberto para authenticated)
-- =============================================================================
ALTER TABLE public.docagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docagem_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docagem_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select docagens to authenticated" ON public.docagens;
CREATE POLICY "Allow select docagens to authenticated"
  ON public.docagens FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert docagens to authenticated" ON public.docagens;
CREATE POLICY "Allow insert docagens to authenticated"
  ON public.docagens FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update docagens to authenticated" ON public.docagens;
CREATE POLICY "Allow update docagens to authenticated"
  ON public.docagens FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete docagens to authenticated" ON public.docagens;
CREATE POLICY "Allow delete docagens to authenticated"
  ON public.docagens FOR DELETE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow select docagem_instancias to authenticated" ON public.docagem_instancias;
CREATE POLICY "Allow select docagem_instancias to authenticated"
  ON public.docagem_instancias FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert docagem_instancias to authenticated" ON public.docagem_instancias;
CREATE POLICY "Allow insert docagem_instancias to authenticated"
  ON public.docagem_instancias FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update docagem_instancias to authenticated" ON public.docagem_instancias;
CREATE POLICY "Allow update docagem_instancias to authenticated"
  ON public.docagem_instancias FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete docagem_instancias to authenticated" ON public.docagem_instancias;
CREATE POLICY "Allow delete docagem_instancias to authenticated"
  ON public.docagem_instancias FOR DELETE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow select docagem_lancamentos to authenticated" ON public.docagem_lancamentos;
CREATE POLICY "Allow select docagem_lancamentos to authenticated"
  ON public.docagem_lancamentos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert docagem_lancamentos to authenticated" ON public.docagem_lancamentos;
CREATE POLICY "Allow insert docagem_lancamentos to authenticated"
  ON public.docagem_lancamentos FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update docagem_lancamentos to authenticated" ON public.docagem_lancamentos;
CREATE POLICY "Allow update docagem_lancamentos to authenticated"
  ON public.docagem_lancamentos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete docagem_lancamentos to authenticated" ON public.docagem_lancamentos;
CREATE POLICY "Allow delete docagem_lancamentos to authenticated"
  ON public.docagem_lancamentos FOR DELETE
  TO authenticated USING (true);

-- =============================================================================
-- 6. Funções RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Criar docagem e expandir em instâncias diárias
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_docagem(
  p_cliente_id UUID,
  p_centro_custo_id UUID,
  p_solicitante_id UUID,
  p_motorista_id UUID,
  p_veiculo_id UUID,
  p_endereco TEXT,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_horario_inicio TIME,
  p_horario_fim TIME,
  p_dias_semana INTEGER[],
  p_valor_diario NUMERIC,
  p_custo_diario NUMERIC,
  p_observacao TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_docagem_id UUID;
  v_current_date DATE;
  v_dow INTEGER;
BEGIN
  -- Validações básicas
  IF p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Data de início não pode ser maior que data de fim.';
  END IF;

  IF p_valor_diario IS NULL OR p_valor_diario < 0 THEN
    RAISE EXCEPTION 'Valor diário inválido.';
  END IF;

  IF array_length(p_dias_semana, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um dia da semana.';
  END IF;

  -- Insere a docagem mãe
  INSERT INTO public.docagens (
    cliente_id,
    centro_custo_id,
    solicitante_id,
    motorista_id,
    veiculo_id,
    endereco,
    data_inicio,
    data_fim,
    horario_inicio,
    horario_fim,
    dias_semana,
    valor_diario,
    custo_diario,
    observacao,
    created_by
  )
  VALUES (
    p_cliente_id,
    p_centro_custo_id,
    p_solicitante_id,
    p_motorista_id,
    p_veiculo_id,
    p_endereco,
    p_data_inicio,
    p_data_fim,
    p_horario_inicio,
    p_horario_fim,
    p_dias_semana,
    p_valor_diario,
    p_custo_diario,
    p_observacao,
    auth.uid()
  )
  RETURNING id INTO v_docagem_id;

  -- Expande em instâncias diárias
  v_current_date := p_data_inicio;
  WHILE v_current_date <= p_data_fim LOOP
    v_dow := EXTRACT(ISODOW FROM v_current_date)::INTEGER;

    IF v_dow = ANY(p_dias_semana) THEN
      INSERT INTO public.docagem_instancias (
        docagem_id,
        data,
        horario_inicio,
        horario_fim,
        endereco,
        motorista_id,
        veiculo_id,
        valor,
        custo
      )
      VALUES (
        v_docagem_id,
        v_current_date,
        p_horario_inicio,
        p_horario_fim,
        p_endereco,
        p_motorista_id,
        p_veiculo_id,
        p_valor_diario,
        p_custo_diario
      )
      ON CONFLICT (docagem_id, data) DO NOTHING;
    END IF;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_docagem_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Finalizar um dia de docagem e gerar o lançamento financeiro
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalizar_docagem_dia(
  p_instancia_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_instancia public.docagem_instancias%ROWTYPE;
  v_lancamento_id UUID;
BEGIN
  SELECT * INTO v_instancia
  FROM public.docagem_instancias
  WHERE id = p_instancia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância de docagem não encontrada.';
  END IF;

  IF v_instancia.status = 'excluida' THEN
    RAISE EXCEPTION 'Não é possível finalizar uma instância excluída.';
  END IF;

  IF v_instancia.status = 'finalizada' THEN
    RAISE EXCEPTION 'Esta instância já foi finalizada.';
  END IF;

  UPDATE public.docagem_instancias
  SET status = 'finalizada',
      finalizada_em = now(),
      finalizada_por = auth.uid()
  WHERE id = p_instancia_id;

  INSERT INTO public.docagem_lancamentos (
    docagem_instancia_id,
    data,
    cliente_id,
    centro_custo_id,
    motorista_id,
    valor,
    custo,
    status
  )
  VALUES (
    v_instancia.id,
    v_instancia.data,
    (SELECT cliente_id FROM public.docagens WHERE id = v_instancia.docagem_id),
    (SELECT centro_custo_id FROM public.docagens WHERE id = v_instancia.docagem_id),
    v_instancia.motorista_id,
    v_instancia.valor,
    v_instancia.custo,
    'realizado'
  )
  RETURNING id INTO v_lancamento_id;

  RETURN v_lancamento_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Excluir (ou reativar) uma instância diária de docagem
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_status_docagem_instancia(
  p_instancia_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_instancia public.docagem_instancias%ROWTYPE;
BEGIN
  SELECT * INTO v_instancia
  FROM public.docagem_instancias
  WHERE id = p_instancia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instância de docagem não encontrada.';
  END IF;

  IF p_status NOT IN ('pendente', 'excluida') THEN
    RAISE EXCEPTION 'Status inválido para alteração manual.';
  END IF;

  -- Se estiver finalizada, não permite excluir
  IF v_instancia.status = 'finalizada' THEN
    RAISE EXCEPTION 'Não é possível alterar uma instância já finalizada.';
  END IF;

  UPDATE public.docagem_instancias
  SET status = p_status
  WHERE id = p_instancia_id;
END;
$$;
