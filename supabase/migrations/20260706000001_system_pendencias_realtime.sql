-- =============================================================================
-- system_pendencias: tabela dedicada para pendências do sistema
-- =============================================================================
-- Arquitetura:
--   1. Triggers em ordens_servico atualizam system_pendencias em tempo real
--      quando uma OS é criada/atualizada/excluída
--   2. pg_cron roda reconcile_all_pendencias() a cada 15 min para pegar
--      OS que envelheceram (data passou mas ninguém editou)
--   3. Supabase Realtime ativo na tabela → dropdown atualiza instantâneo
--   4. Cron do Cloudflare (2h) insere notificação pendencia_alert com counts
-- =============================================================================

-- Tabela
CREATE TABLE IF NOT EXISTS public.system_pendencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('os', 'docagem')),
  source_id UUID NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('sem_valor', 'atrasada', 'rascunho', 'docagem')),
  protocolo TEXT NOT NULL DEFAULT '',
  os_number TEXT NOT NULL DEFAULT '',
  cliente_nome TEXT NOT NULL DEFAULT 'Cliente não informado',
  data TEXT NOT NULL DEFAULT '',
  user_id UUID, -- só para rascunhos (pendência pessoal)
  age_days INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_system_pendencias_source ON public.system_pendencias(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_system_pendencias_motivo ON public.system_pendencias(motivo);
CREATE INDEX IF NOT EXISTS idx_system_pendencias_user ON public.system_pendencias(user_id) WHERE user_id IS NOT NULL;

-- Unique constraint: uma pendência por (source_type, source_id, motivo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_pendencias_unique
  ON public.system_pendencias(source_type, source_id, motivo);

-- =============================================================================
-- RLS: todos podem ler, só service_role pode escrever
-- =============================================================================
ALTER TABLE public.system_pendencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_pendencias_read_all" ON public.system_pendencias;
CREATE POLICY "system_pendencias_read_all" ON public.system_pendencias
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "system_pendencias_write_service" ON public.system_pendencias;
CREATE POLICY "system_pendencias_write_service" ON public.system_pendencias
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- Função auxiliar: calcula pendências de UMA OS e atualiza system_pendencias
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recompute_os_pendencias(os_row public.ordens_servico)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_ms BIGINT := extract(epoch from now()) * 1000;
  v_data_date DATE;
  v_is_sem_valor BOOLEAN := false;
  v_is_atrasada BOOLEAN := false;
  v_cliente_nome TEXT;
  v_age_days INT;
  v_motivo TEXT;
BEGIN
  -- Remove pendências existentes desta OS
  DELETE FROM public.system_pendencias
  WHERE source_type = 'os' AND source_id = os_row.id;

  -- Ignora arquivadas
  IF os_row.arquivado THEN RETURN; END IF;

  -- Busca nome do cliente
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = os_row.cliente_id;
  v_cliente_nome := COALESCE(v_cliente_nome, 'Cliente não informado');

  -- Parse data
  v_data_date := NULL;
  IF os_row.data IS NOT NULL THEN
    v_data_date := os_row.data;
  END IF;

  -- Rascunhos: só conta se for antigo (>= 1 dia) e do próprio usuário
  IF os_row.tipo = 'rascunho' THEN
    IF os_row.created_at IS NOT NULL THEN
      v_age_days := extract(epoch from (now() - os_row.created_at))::int / 86400;
      IF v_age_days >= 1 THEN
        INSERT INTO public.system_pendencias (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, user_id, age_days)
        VALUES ('os', os_row.id, 'rascunho', COALESCE(os_row.protocolo, ''), COALESCE(os_row.os_number, ''), v_cliente_nome, COALESCE(os_row.data::text, ''), os_row.created_by, v_age_days)
        ON CONFLICT (source_type, source_id, motivo) DO NOTHING;
      END IF;
    END IF;
    RETURN;
  END IF;

  -- sem_valor: finalizada sem valor bruto e/ou custo
  IF os_row.status_operacional = 'Finalizado' THEN
    IF (os_row.valor_bruto IS NULL OR os_row.valor_bruto = 0
        OR os_row.custo IS NULL OR os_row.custo = 0) THEN
      v_is_sem_valor := true;
    END IF;
  END IF;

  -- atrasada: data < hoje e status não é Finalizado/Cancelado
  IF v_data_date IS NOT NULL AND v_data_date < v_today THEN
    IF os_row.status_operacional NOT IN ('Finalizado', 'Cancelado') THEN
      v_is_atrasada := true;
    END IF;
  END IF;

  -- atrasada hoje: data = hoje + Pendente/Aguardando + hora já passou
  IF v_data_date IS NOT NULL AND v_data_date = v_today
     AND os_row.status_operacional IN ('Pendente', 'Aguardando')
     AND os_row.hora IS NOT NULL THEN
    BEGIN
      IF extract(epoch from (now() AT TIME ZONE 'America/Sao_Paulo'))::bigint
         >= extract(epoch from ((os_row.data::text || 'T' || os_row.hora || ':00')::timestamp AT TIME ZONE 'America/Sao_Paulo'))::bigint THEN
        v_is_atrasada := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Insere pendências
  IF v_is_sem_valor THEN
    INSERT INTO public.system_pendencias (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data)
    VALUES ('os', os_row.id, 'sem_valor', COALESCE(os_row.protocolo, ''), COALESCE(os_row.os_number, ''), v_cliente_nome, COALESCE(os_row.data::text, ''))
    ON CONFLICT (source_type, source_id, motivo) DO NOTHING;
  END IF;

  IF v_is_atrasada THEN
    INSERT INTO public.system_pendencias (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data)
    VALUES ('os', os_row.id, 'atrasada', COALESCE(os_row.protocolo, ''), COALESCE(os_row.os_number, ''), v_cliente_nome, COALESCE(os_row.data::text, ''))
    ON CONFLICT (source_type, source_id, motivo) DO NOTHING;
  END IF;
END;
$$;

-- =============================================================================
-- Função: recalcula pendências de uma docagem_instancia
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recompute_docagem_pendencias(doc_row public.docagem_instancias)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_cliente_nome TEXT;
  v_protocolo TEXT;
  v_age_days INT;
  v_docagem RECORD;
BEGIN
  -- Remove pendências existentes desta docagem
  DELETE FROM public.system_pendencias
  WHERE source_type = 'docagem' AND source_id = doc_row.id;

  -- Só pendências com data no passado e status pendente/andamento
  IF doc_row.data IS NULL OR doc_row.data >= v_today THEN RETURN; END IF;
  IF doc_row.status NOT IN ('pendente', 'andamento') THEN RETURN; END IF;

  -- Busca protocolo e cliente da docagem pai
  SELECT protocolo, cliente_id INTO v_protocolo, v_docagem.cliente_id
  FROM public.docagens WHERE id = doc_row.docagem_id;

  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = v_docagem.cliente_id;
  v_cliente_nome := COALESCE(v_cliente_nome, 'Cliente não informado');
  v_protocolo := COALESCE(v_protocolo, '');

  v_age_days := (v_today - doc_row.data)::int;

  INSERT INTO public.system_pendencias (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, age_days)
  VALUES ('docagem', doc_row.id, 'docagem', v_protocolo, '', v_cliente_nome, doc_row.data::text, v_age_days)
  ON CONFLICT (source_type, source_id, motivo) DO NOTHING;
END;
$$;

-- =============================================================================
-- Trigger function para ordens_servico (INSERT/UPDATE/DELETE)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trigger_os_pendencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.system_pendencias WHERE source_type = 'os' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    PERFORM public.recompute_os_pendencias(NEW);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_pendencias_insert ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_pendencias_update ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_pendencias_delete ON public.ordens_servico;

CREATE TRIGGER trg_os_pendencias_insert
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.trigger_os_pendencias();

CREATE TRIGGER trg_os_pendencias_update
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.trigger_os_pendencias();

CREATE TRIGGER trg_os_pendencias_delete
  AFTER DELETE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.trigger_os_pendencias();

-- =============================================================================
-- Trigger function para docagem_instancias (INSERT/UPDATE/DELETE)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trigger_docagem_pendencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.system_pendencias WHERE source_type = 'docagem' AND source_id = OLD.id;
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    PERFORM public.recompute_docagem_pendencias(NEW);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_docagem_pendencias_insert ON public.docagem_instancias;
DROP TRIGGER IF EXISTS trg_docagem_pendencias_update ON public.docagem_instancias;
DROP TRIGGER IF EXISTS trg_docagem_pendencias_delete ON public.docagem_instancias;

CREATE TRIGGER trg_docagem_pendencias_insert
  AFTER INSERT ON public.docagem_instancias
  FOR EACH ROW EXECUTE FUNCTION public.trigger_docagem_pendencias();

CREATE TRIGGER trg_docagem_pendencias_update
  AFTER UPDATE ON public.docagem_instancias
  FOR EACH ROW EXECUTE FUNCTION public.trigger_docagem_pendencias();

CREATE TRIGGER trg_docagem_pendencias_delete
  AFTER DELETE ON public.docagem_instancias
  FOR EACH ROW EXECUTE FUNCTION public.trigger_docagem_pendencias();

-- =============================================================================
-- Função de reconciliação completa (chamada pelo pg_cron a cada 15 min)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reconcile_all_pendencias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_os public.ordens_servico;
  v_doc public.docagem_instancias;
  v_cliente_nome TEXT;
  v_protocolo TEXT;
  v_age_days INT;
  v_doc_cliente_id UUID;
BEGIN
  -- Reconcilia OS: remove todas e reinicia
  DELETE FROM public.system_pendencias WHERE source_type = 'os';

  -- Reprocessa todas as OS não arquivadas
  FOR v_os IN SELECT * FROM public.ordens_servico WHERE arquivado = false LOOP
    PERFORM public.recompute_os_pendencias(v_os);
  END LOOP;

  -- Reconcilia docagens: remove todas e reinicia
  DELETE FROM public.system_pendencias WHERE source_type = 'docagem';

  FOR v_doc IN SELECT * FROM public.docagem_instancias
               WHERE data < v_today AND status IN ('pendente', 'andamento') LOOP
    PERFORM public.recompute_docagem_pendencias(v_doc);
  END LOOP;
END;
$$;

-- =============================================================================
-- pg_cron: reconciliação a cada 15 minutos
-- =============================================================================
SELECT cron.schedule(
  'reconcile-pendencias',
  '*/15 * * * *',
  $$SELECT public.reconcile_all_pendencias();$$
);

-- =============================================================================
-- Ativar Realtime na tabela system_pendencias
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_pendencias;

-- =============================================================================
-- População inicial
-- =============================================================================
SELECT public.reconcile_all_pendencias();
