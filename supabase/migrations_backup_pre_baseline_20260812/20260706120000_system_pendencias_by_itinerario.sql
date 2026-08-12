-- =============================================================================
-- system_pendencias: pendências "atrasada" agora são por itinerário
-- =============================================================================
-- Antes: 1 linha por OS baseada em os.data (data principal).
-- Agora: 1 linha por itinerary_index atrasado, usando a data+hora do primeiro
-- waypoint de cada grupo. Alinha o sino/topbar com o calendário (filtro
-- Pendências usa displayDateTime por itinerário).
--
-- sem_valor, rascunho e docagem continuam OS-level (itinerary_index = 0).
-- Apenas "atrasada" é multi-linha quando a OS tem múltiplos itinerários.
--
-- itinerary_index NULL => 0 (igual ao frontend: itineraryIndex ?? 0).
-- itinerary_index negativo (-1 = retorno, etc.) => itinerários válidos.
-- =============================================================================

-- 1. Adiciona coluna itinerary_index (default 0 para retrocompat)
ALTER TABLE public.system_pendencias
  ADD COLUMN IF NOT EXISTS itinerary_index INT NOT NULL DEFAULT 0;

-- 2. Recria unique constraint incluindo itinerary_index
DROP INDEX IF EXISTS public.idx_system_pendencias_unique;
CREATE UNIQUE INDEX idx_system_pendencias_unique
  ON public.system_pendencias(source_type, source_id, motivo, itinerary_index);

-- 3. Índice auxiliar para itinerários de retorno/multi
CREATE INDEX IF NOT EXISTS idx_system_pendencias_itin
  ON public.system_pendencias(source_id, itinerary_index)
  WHERE itinerary_index != 0;

-- =============================================================================
-- Reescreve recompute_os_pendencias: itera itinerários via os_waypoints
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recompute_os_pendencias(os_row public.ordens_servico)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_now_ts TIMESTAMP := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_cliente_nome TEXT;
  v_age_days INT;
  v_itin RECORD;
  v_itin_date DATE;
  v_itin_dt TIMESTAMP;
  v_is_atrasada BOOLEAN;
  v_has_itineraries BOOLEAN := false;
  v_os_hora_time TIME;
BEGIN
  DELETE FROM public.system_pendencias
  WHERE source_type = 'os' AND source_id = os_row.id;

  IF os_row.arquivado THEN RETURN; END IF;

  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = os_row.cliente_id;
  v_cliente_nome := COALESCE(v_cliente_nome, 'Cliente não informado');

  -- Parse os_row.hora (text) → TIME, tolerando string vazia
  v_os_hora_time := NULL;
  IF os_row.hora IS NOT NULL AND os_row.hora != '' AND os_row.hora ~ '^[0-9]{1,2}:[0-9]{2}' THEN
    BEGIN
      v_os_hora_time := os_row.hora::time;
    EXCEPTION WHEN OTHERS THEN
      v_os_hora_time := NULL;
    END;
  END IF;

  -- Rascunho: pendência pessoal, OS-level (itinerary_index = 0)
  IF os_row.tipo = 'rascunho' THEN
    IF os_row.created_at IS NOT NULL THEN
      v_age_days := extract(epoch from (now() - os_row.created_at))::int / 86400;
      IF v_age_days >= 1 THEN
        INSERT INTO public.system_pendencias
          (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, user_id, age_days, itinerary_index)
        VALUES
          ('os', os_row.id, 'rascunho', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''),
           v_cliente_nome, COALESCE(os_row.data::text,''), os_row.created_by, v_age_days, 0)
        ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
      END IF;
    END IF;
    RETURN;
  END IF;

  -- sem_valor: OS-level (finalizada sem valor bruto e/ou custo)
  IF os_row.status_operacional = 'Finalizado' THEN
    IF (os_row.valor_bruto IS NULL OR os_row.valor_bruto = 0
        OR os_row.custo IS NULL OR os_row.custo = 0) THEN
      INSERT INTO public.system_pendencias
        (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, itinerary_index)
      VALUES
        ('os', os_row.id, 'sem_valor', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''),
         v_cliente_nome, COALESCE(os_row.data::text,''), 0)
      ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
    END IF;
  END IF;

  -- atrasada: por itinerário — 1 linha por itinerary_index com atraso.
  -- COALESCE(itinerary_index, 0): NULL é tratado como 0, igual ao frontend.
  -- Índices negativos (-1 = retorno) são itinerários válidos.
  FOR v_itin IN
    SELECT DISTINCT ON (COALESCE(w.itinerary_index, 0))
      COALESCE(w.itinerary_index, 0)   AS itinerary_index,
      COALESCE(w.data, os_row.data)    AS itin_data,
      COALESCE(w.hora, v_os_hora_time) AS itin_hora
    FROM public.os_waypoints w
    WHERE w.ordem_servico_id = os_row.id
    ORDER BY COALESCE(w.itinerary_index, 0) ASC, w.position ASC
  LOOP
    v_has_itineraries := true;
    v_itin_date := v_itin.itin_data;
    IF v_itin_date IS NULL THEN CONTINUE; END IF;

    v_is_atrasada := false;

    -- Data passada: qualquer status não-finalizado/cancelado é atrasado
    IF v_itin_date < v_today THEN
      IF os_row.status_operacional NOT IN ('Finalizado', 'Cancelado') THEN
        v_is_atrasada := true;
      END IF;

    -- Data hoje: só Pendente/Aguardando com horário já passado
    ELSIF v_itin_date = v_today THEN
      IF os_row.status_operacional IN ('Pendente', 'Aguardando') THEN
        IF v_itin.itin_hora IS NOT NULL THEN
          BEGIN
            v_itin_dt := (v_itin_date::text || ' ' || v_itin.itin_hora::text)::timestamp;
            IF v_now_ts >= v_itin_dt THEN
              v_is_atrasada := true;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_is_atrasada := true;
          END;
        ELSE
          -- Sem hora definida: assume atrasado (conservador)
          v_is_atrasada := true;
        END IF;
      END IF;
    END IF;
    -- Data futura: nunca atrasado

    IF v_is_atrasada THEN
      INSERT INTO public.system_pendencias
        (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, itinerary_index)
      VALUES
        ('os', os_row.id, 'atrasada', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''),
         v_cliente_nome, v_itin_date::text, v_itin.itinerary_index)
      ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
    END IF;
  END LOOP;

  -- Fallback: OS sem waypoints — usa os_row.data + hora (itinerary_index = 0)
  IF NOT v_has_itineraries AND os_row.data IS NOT NULL THEN
    v_is_atrasada := false;

    IF os_row.data < v_today THEN
      IF os_row.status_operacional NOT IN ('Finalizado', 'Cancelado') THEN
        v_is_atrasada := true;
      END IF;
    ELSIF os_row.data = v_today THEN
      IF os_row.status_operacional IN ('Pendente', 'Aguardando') THEN
        IF v_os_hora_time IS NOT NULL THEN
          BEGIN
            v_itin_dt := (os_row.data::text || ' ' || v_os_hora_time::text)::timestamp;
            IF v_now_ts >= v_itin_dt THEN
              v_is_atrasada := true;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_is_atrasada := true;
          END;
        ELSE
          v_is_atrasada := true;
        END IF;
      END IF;
    END IF;

    IF v_is_atrasada THEN
      INSERT INTO public.system_pendencias
        (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, itinerary_index)
      VALUES
        ('os', os_row.id, 'atrasada', COALESCE(os_row.protocolo,''), COALESCE(os_row.os_number,''),
         v_cliente_nome, os_row.data::text, 0)
      ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
    END IF;
  END IF;
END;
$$;

-- =============================================================================
-- Atualiza recompute_docagem_pendencias: ON CONFLICT agora inclui itinerary_index
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
  v_doc_cliente_id UUID;
BEGIN
  DELETE FROM public.system_pendencias
  WHERE source_type = 'docagem' AND source_id = doc_row.id;

  IF doc_row.data IS NULL OR doc_row.data >= v_today THEN RETURN; END IF;
  IF doc_row.status NOT IN ('pendente', 'andamento') THEN RETURN; END IF;

  SELECT protocolo, cliente_id INTO v_protocolo, v_doc_cliente_id
  FROM public.docagens WHERE id = doc_row.docagem_id;

  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = v_doc_cliente_id;
  v_cliente_nome := COALESCE(v_cliente_nome, 'Cliente não informado');
  v_protocolo := COALESCE(v_protocolo, '');
  v_age_days := (v_today - doc_row.data)::int;

  INSERT INTO public.system_pendencias
    (source_type, source_id, motivo, protocolo, os_number, cliente_nome, data, age_days, itinerary_index)
  VALUES
    ('docagem', doc_row.id, 'docagem', v_protocolo, '', v_cliente_nome, doc_row.data::text, v_age_days, 0)
  ON CONFLICT (source_type, source_id, motivo, itinerary_index) DO NOTHING;
END;
$$;

-- =============================================================================
-- Trigger em os_waypoints: qualquer mudança em data/hora recalcula a OS pai
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trigger_waypoint_pendencias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_os public.ordens_servico;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    SELECT * INTO v_os FROM public.ordens_servico WHERE id = OLD.ordem_servico_id;
    IF v_os.id IS NOT NULL THEN PERFORM public.recompute_os_pendencias(v_os); END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    SELECT * INTO v_os FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;
    IF v_os.id IS NOT NULL THEN PERFORM public.recompute_os_pendencias(v_os); END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_waypoint_pendencias_insert ON public.os_waypoints;
DROP TRIGGER IF EXISTS trg_waypoint_pendencias_update ON public.os_waypoints;
DROP TRIGGER IF EXISTS trg_waypoint_pendencias_delete ON public.os_waypoints;

CREATE TRIGGER trg_waypoint_pendencias_insert
  AFTER INSERT ON public.os_waypoints
  FOR EACH ROW EXECUTE FUNCTION public.trigger_waypoint_pendencias();

CREATE TRIGGER trg_waypoint_pendencias_update
  AFTER UPDATE ON public.os_waypoints
  FOR EACH ROW EXECUTE FUNCTION public.trigger_waypoint_pendencias();

CREATE TRIGGER trg_waypoint_pendencias_delete
  AFTER DELETE ON public.os_waypoints
  FOR EACH ROW EXECUTE FUNCTION public.trigger_waypoint_pendencias();

-- =============================================================================
-- Repopula com a nova lógica por itinerário
-- =============================================================================
SELECT public.reconcile_all_pendencias();
