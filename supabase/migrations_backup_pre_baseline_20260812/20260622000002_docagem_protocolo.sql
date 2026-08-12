-- =============================================================================
-- Migration: docagem_protocolo
-- Data: 2026-06-22
-- =============================================================================
-- Adiciona coluna de protocolo às docagens (mesmo padrão das OS), gera
-- protocolos para docagens existentes e atualiza notificações para incluir
-- o protocolo e usar mensagem padronizada: "docagem do dia 24/06 foi resetada".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Adicionar coluna protocolo
-- ---------------------------------------------------------------------------
ALTER TABLE public.docagens
  ADD COLUMN IF NOT EXISTS protocolo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_docagens_protocolo
  ON public.docagens(protocolo)
  WHERE protocolo IS NOT NULL AND protocolo <> '';

-- ---------------------------------------------------------------------------
-- 2. Trigger para gerar protocolo automaticamente no insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_docagem_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  seq_val INTEGER;
  year_month TEXT;
BEGIN
  IF NEW.protocolo IS NULL OR NEW.protocolo = '' THEN
    seq_val := nextval('protocolo_seq');
    year_month := to_char(CURRENT_DATE, 'YYYYMM');
    NEW.protocolo := year_month || lpad(seq_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_docagem_protocolo ON public.docagens;
CREATE TRIGGER trg_generate_docagem_protocolo
  BEFORE INSERT ON public.docagens
  FOR EACH ROW
  WHEN (NEW.protocolo IS NULL OR NEW.protocolo = '')
  EXECUTE FUNCTION public.generate_docagem_protocolo();

-- ---------------------------------------------------------------------------
-- 3. Backfill: gerar protocolos para docagens existentes sem protocolo
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
  seq_val INTEGER;
  year_month TEXT;
BEGIN
  FOR rec IN
    SELECT id, created_at
    FROM public.docagens
    WHERE protocolo IS NULL OR protocolo = ''
    ORDER BY created_at
  LOOP
    seq_val := nextval('protocolo_seq');
    year_month := to_char(rec.created_at, 'YYYYMM');
    UPDATE public.docagens
    SET protocolo = year_month || lpad(seq_val::TEXT, 4, '0')
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Garantir que novas docagens usem o trigger (criar_docagem insere vazio)
-- ---------------------------------------------------------------------------
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
    created_by
  ) VALUES (
    '', -- trigger irá gerar
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

  v_current_date := p_data_inicio;
  WHILE v_current_date <= p_data_fim LOOP
    v_dow := EXTRACT(DOW FROM v_current_date)::INTEGER;
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

-- ---------------------------------------------------------------------------
-- 5. Atualizar funções de notificação para usar protocolo e nova mensagem
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_docagem_notification(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_empresa_id UUID,
  p_actor_id UUID,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_avatar_url TEXT;
BEGIN
  SELECT nome, avatar_url
    INTO v_actor_name, v_actor_avatar_url
  FROM public.user_roles
  WHERE id = p_actor_id;

  INSERT INTO public.app_notifications (
    type, title, message, target_audience, empresa_id,
    created_by, created_by_name, created_by_avatar_url, metadata
  )
  VALUES (
    p_type, p_title, p_message, 'interno', p_empresa_id,
    p_actor_id, COALESCE(v_actor_name, 'Sistema'), v_actor_avatar_url, p_metadata
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_docagem_created_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_cliente_nome TEXT;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;

  PERFORM public.insert_docagem_notification(
    'success',
    'Nova docagem',
    format('Docagem %s criada para %s.', COALESCE(NEW.protocolo, ''), COALESCE(v_cliente_nome, 'Cliente')),
    NEW.cliente_id,
    v_actor_id,
    jsonb_build_object(
      'docagem_id', NEW.id,
      'protocolo', NEW.protocolo,
      'cliente_id', NEW.cliente_id,
      'data_inicio', NEW.data_inicio,
      'data_fim', NEW.data_fim
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_docagem_cancelled_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_cliente_nome TEXT;
BEGIN
  IF NEW.status = 'cancelada' AND (OLD.status IS NULL OR OLD.status != 'cancelada') THEN
    v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
    SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;

    PERFORM public.insert_docagem_notification(
      'warning',
      'Docagem cancelada',
      format('Docagem %s de %s foi cancelada.', COALESCE(NEW.protocolo, ''), COALESCE(v_cliente_nome, 'Cliente')),
      NEW.cliente_id,
      v_actor_id,
      jsonb_build_object('docagem_id', NEW.id, 'protocolo', NEW.protocolo)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_docagem_instance_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_docagem public.docagens%ROWTYPE;
  v_cliente_nome TEXT;
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_acao TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;

  SELECT * INTO v_docagem
  FROM public.docagens
  WHERE id = NEW.docagem_id;

  SELECT nome INTO v_cliente_nome
  FROM public.clientes
  WHERE id = v_docagem.cliente_id;

  CASE NEW.status
    WHEN 'finalizada' THEN
      v_title := 'Dia de docagem finalizado';
      v_acao := 'finalizado';
      v_type := 'success';
    WHEN 'pendente' THEN
      IF OLD.status = 'finalizada' THEN
        v_title := 'Dia de docagem resetado';
        v_acao := 'resetado';
        v_type := 'warning';
      ELSE
        v_title := 'Dia de docagem reativado';
        v_acao := 'reativado';
        v_type := 'success';
      END IF;
    WHEN 'excluida' THEN
      v_title := 'Dia de docagem excluído';
      v_acao := 'excluído';
      v_type := 'warning';
    ELSE
      RETURN NEW;
  END CASE;

  v_message := format(
    'Docagem %s do dia %s foi %s.',
    COALESCE(v_docagem.protocolo, ''),
    NEW.data,
    v_acao
  );

  PERFORM public.insert_docagem_notification(
    v_type,
    v_title,
    v_message,
    v_docagem.cliente_id,
    v_actor_id,
    jsonb_build_object(
      'docagem_id', v_docagem.id,
      'instancia_id', NEW.id,
      'protocolo', v_docagem.protocolo,
      'data', NEW.data,
      'status', NEW.status,
      'status_anterior', OLD.status
    )
  );
  RETURN NEW;
END;
$$;
