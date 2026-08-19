-- =============================================================================
-- Migration: fix_docagem_domingo_isodow
-- Data: 2026-08-19
-- =============================================================================
-- Bug: criar_docagem() usava EXTRACT(DOW FROM ...) (domingo = 0), mas o
-- frontend envia o valor 7 para "Dom" (convenção ISODOW: segunda=1 ... domingo=7,
-- ver src/app/portal/os/page.tsx). Como 0 nunca é enviado no array
-- p_dias_semana, nenhuma instância de domingo era criada quando o usuário
-- selecionava esse dia.
--
-- A migration original (20260620000001_docagem.sql) já usava ISODOW
-- corretamente; migrations posteriores (20260622000002 e 20260624000000)
-- recriaram a função para outros fins e reintroduziram DOW por engano.
--
-- Esta migration restaura ISODOW nas duas sobrecargas de criar_docagem e
-- faz o backfill das instâncias de domingo que ficaram faltando em docagens
-- já criadas.
-- =============================================================================

-- Sobrecarga sem observação financeira (mantida por compatibilidade)
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
  IF p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Data de início não pode ser maior que data de fim.';
  END IF;

  IF p_valor_diario IS NULL OR p_valor_diario < 0 THEN
    RAISE EXCEPTION 'Valor diário inválido.';
  END IF;

  IF array_length(p_dias_semana, 1) IS NULL THEN
    RAISE EXCEPTION 'Pelo menos um dia da semana deve ser selecionado.';
  END IF;

  INSERT INTO public.docagens (
    protocolo, cliente_id, centro_custo_id, solicitante_id, motorista_id, veiculo_id,
    endereco, data_inicio, data_fim, horario_inicio, horario_fim, dias_semana,
    valor_diario, custo_diario, observacao, created_by
  ) VALUES (
    '', p_cliente_id, p_centro_custo_id, p_solicitante_id, p_motorista_id, p_veiculo_id,
    p_endereco, p_data_inicio, p_data_fim, p_horario_inicio, p_horario_fim, p_dias_semana,
    p_valor_diario, p_custo_diario, p_observacao, auth.uid()
  )
  RETURNING id INTO v_docagem_id;

  v_current_date := p_data_inicio;
  WHILE v_current_date <= p_data_fim LOOP
    v_dow := EXTRACT(ISODOW FROM v_current_date)::INTEGER;
    IF v_dow = ANY(p_dias_semana) THEN
      INSERT INTO public.docagem_instancias (
        docagem_id, data, horario_inicio, horario_fim, endereco,
        motorista_id, veiculo_id, valor, custo
      )
      VALUES (
        v_docagem_id, v_current_date, p_horario_inicio, p_horario_fim, p_endereco,
        p_motorista_id, p_veiculo_id, p_valor_diario, p_custo_diario
      )
      ON CONFLICT (docagem_id, data) DO NOTHING;
    END IF;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_docagem_id;
END;
$$;

-- Sobrecarga com observação financeira (usada atualmente pelo frontend)
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
  p_observacao TEXT,
  p_observacao_financeira TEXT DEFAULT NULL
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
  IF p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Data de início não pode ser maior que data de fim.';
  END IF;

  IF p_valor_diario IS NULL OR p_valor_diario < 0 THEN
    RAISE EXCEPTION 'Valor diário inválido.';
  END IF;

  IF array_length(p_dias_semana, 1) IS NULL THEN
    RAISE EXCEPTION 'Pelo menos um dia da semana deve ser selecionado.';
  END IF;

  INSERT INTO public.docagens (
    protocolo,
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
    observacao_financeira,
    created_by
  ) VALUES (
    '',
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
    p_observacao_financeira,
    auth.uid()
  )
  RETURNING id INTO v_docagem_id;

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
        custo,
        observacao_financeira
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
        p_custo_diario,
        p_observacao_financeira
      )
      ON CONFLICT (docagem_id, data) DO NOTHING;
    END IF;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_docagem_id;
END;
$$;

-- =============================================================================
-- Backfill: cria as instâncias de domingo que ficaram faltando em docagens
-- já existentes que selecionaram domingo (7) em dias_semana.
-- =============================================================================
INSERT INTO public.docagem_instancias (
  docagem_id, data, horario_inicio, horario_fim, endereco,
  motorista_id, veiculo_id, valor, custo, observacao_financeira
)
SELECT
  d.id,
  gs.dia::date,
  d.horario_inicio,
  d.horario_fim,
  d.endereco,
  d.motorista_id,
  d.veiculo_id,
  d.valor_diario,
  d.custo_diario,
  d.observacao_financeira
FROM public.docagens d
CROSS JOIN LATERAL generate_series(d.data_inicio, d.data_fim, interval '1 day') AS gs(dia)
WHERE 7 = ANY(d.dias_semana)
  AND d.status <> 'cancelada'
  AND EXTRACT(ISODOW FROM gs.dia) = 7
ON CONFLICT (docagem_id, data) DO NOTHING;
