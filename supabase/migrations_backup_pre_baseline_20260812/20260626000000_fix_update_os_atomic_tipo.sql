-- =============================================================================
-- Migration: fix_update_os_atomic_tipo
-- Data: 2026-06-26
-- =============================================================================
-- Objetivo: Corrigir o estrago deixado por 20260625000000_add_os_tipo_column.sql.
--
-- Contexto:
--   A migration 20260625000000 tentou recriar update_os_atomic com 4 parâmetros
--   (sem p_log_metadata), mas o Postgres trata assinaturas diferentes como
--   overloads distintos. Resultado: foram criadas DUAS funções update_os_atomic
--   em produção:
--     - OID 36583 (5 args, com p_log_metadata): a que o frontend realmente usa.
--       NÃO atualiza tipo/is_freelance no UPDATE.
--     - OID 37040 (4 args, sem p_log_metadata): órfã, nunca chamada, e com bug
--       `v_tipo := COALESCE(..., tipo)` onde `tipo` não é variável declarada
--       (quebraria em runtime se fosse invocada).
--
-- Correção (não-destrutiva para ordens_servico):
--   1. DROP do overload órfão de 4 args (seguro: nunca é referenciado).
--   2. CREATE OR REPLACE do overload de 5 args (o usado pelo frontend),
--      preservando TODA a lógica existente (log_metadata, derive_os_operational_status,
--      waypoints, ciclos) e adicionando apenas o tratamento correto de tipo:
--        - busca tipo atual da linha
--        - sobrescreve com p_os_data->>'tipo' se informado
--        - atualiza tipo e is_freelance no UPDATE
--
-- Segurança:
--   - Nenhum ALTER TABLE em ordens_servico.
--   - Nenhum DELETE/UPDATE em dados existentes.
--   - A coluna tipo e a constraint chk_ordens_servico_tipo já existem.
-- =============================================================================

-- ── 1. Remover o overload órfão e quebrado de 4 args ─────────────────────────
-- Assinatura exata: (uuid, jsonb, jsonb, jsonb) — sem p_log_metadata.
DROP FUNCTION IF EXISTS public.update_os_atomic(uuid, jsonb, jsonb, jsonb);

-- ── 2. Recriar o overload de 5 args com tratamento correto de tipo ───────────
-- Mantém a assinatura (uuid, jsonb, jsonb, jsonb, jsonb) para o frontend
-- continuar resolvendo para esta função. Preserva toda a lógica de log/notify.
CREATE OR REPLACE FUNCTION public.update_os_atomic(
  p_os_id uuid,
  p_os_data jsonb,
  p_waypoints jsonb,
  p_operational_cycles jsonb DEFAULT '[]'::jsonb,
  p_log_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_v_bruto numeric;
  v_v_custo numeric;
  v_no_show boolean;
  v_no_show_percentual numeric;
  v_no_show_fator numeric;
  v_hora_extra_text text;
  v_billed_minutes integer;
  v_hora_extra_cliente numeric;
  v_hora_extra_motorista numeric;
  v_base_cobranca numeric;
  v_repasse_efetivo numeric;
  v_imposto_percentual numeric;
  v_actor_id uuid;
  v_actor_name text;
  v_log_description text;
  v_changed_sections text;
  v_changed_fields text;
  v_new_status text;
  v_tipo text;
BEGIN
  -- Actor do JWT (fonte da verdade, imune a spoofing)
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  -- ── Construção da descrição do log a partir do metadata ──
  IF p_log_metadata IS NOT NULL
     AND jsonb_typeof(p_log_metadata) = 'object'
     AND p_log_metadata ? 'field_changes'
     AND jsonb_typeof(p_log_metadata->'field_changes') = 'array'
     AND jsonb_array_length(p_log_metadata->'field_changes') > 0
  THEN
    SELECT string_agg(v_item, ' | ')
      INTO v_changed_fields
    FROM (
      SELECT
        CASE
          WHEN COALESCE(fc_elem.fc->>'action', '') = 'added' THEN
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' adicionado'
          WHEN COALESCE(fc_elem.fc->>'action', '') = 'removed' THEN
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' removido'
          ELSE
            COALESCE(fc_elem.fc->>'field', 'Campo') || ' alterado'
        END AS v_item
      FROM (
        SELECT value::jsonb AS fc
        FROM jsonb_array_elements(p_log_metadata->'field_changes')
      ) fc_elem
    ) mapped
    WHERE v_item IS NOT NULL AND v_item <> '';
  END IF;

  IF p_log_metadata IS NOT NULL
     AND jsonb_typeof(p_log_metadata) = 'object'
     AND p_log_metadata ? 'changed_sections'
     AND jsonb_typeof(p_log_metadata->'changed_sections') = 'array'
  THEN
    SELECT string_agg(sec_elem.sec, ', ')
      INTO v_changed_sections
    FROM (
      SELECT value::text AS sec
      FROM jsonb_array_elements_text(p_log_metadata->'changed_sections')
    ) sec_elem;
  END IF;

  IF v_changed_fields IS NOT NULL AND v_changed_fields <> '' THEN
    v_log_description := 'Atualização: ' || v_changed_fields;
  ELSIF v_changed_sections IS NOT NULL AND v_changed_sections <> '' THEN
    v_log_description := 'Atualização em: ' || v_changed_sections;
  ELSE
    v_log_description := 'Dados de edição do atendimento';
  END IF;

  -- ── Cálculos financeiros (inalterados) ──
  v_v_bruto := COALESCE((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo := COALESCE((p_os_data->>'custo')::numeric, 0);
  v_no_show := COALESCE((p_os_data->>'no_show')::boolean, false);
  v_no_show_percentual :=
    CASE
      WHEN v_no_show THEN COALESCE(NULLIF(p_os_data->>'no_show_percentual', ''), '100')::numeric
      ELSE NULL
    END;
  v_no_show_fator := COALESCE(v_no_show_percentual, 100) / 100;

  v_hora_extra_text := COALESCE(p_os_data->>'hora_extra', '');
  v_billed_minutes := public.calc_hora_extra_billed_minutes(v_hora_extra_text);
  v_hora_extra_cliente := (v_billed_minutes::numeric / 60) * 50;
  v_hora_extra_motorista := (v_billed_minutes::numeric / 60) * 20;

  IF v_no_show THEN
    v_base_cobranca := (v_v_bruto + v_hora_extra_cliente) * v_no_show_fator;
    v_repasse_efetivo := (v_v_custo + v_hora_extra_motorista) * v_no_show_fator;
  ELSE
    v_base_cobranca := v_v_bruto + v_hora_extra_cliente;
    v_repasse_efetivo := v_v_custo + v_hora_extra_motorista;
  END IF;

  v_imposto_percentual := public.get_imposto_percentual_for_date(
    COALESCE(NULLIF(p_os_data->>'data', '')::date, CURRENT_DATE)
  );

  -- ── tipo: preserva o valor atual da linha; sobrescreve se vier no payload ──
  -- Busca explícita (evita o bug do `tipo` bare sem contexto de linha).
  SELECT tipo INTO v_tipo FROM public.ordens_servico WHERE id = p_os_id;
  v_tipo := COALESCE(NULLIF(p_os_data->>'tipo', ''), v_tipo);
  -- Garantia contra valor inválido (a constraint chk_ordens_servico_tipo
  -- já protege a tabela, mas isto evita erro 500 antes do UPDATE).
  IF v_tipo IS NULL OR v_tipo NOT IN ('os', 'freelance', 'rascunho') THEN
    v_tipo := 'os';
  END IF;

  -- ── UPDATE principal (agora com tipo + is_freelance sincronizados) ──
  UPDATE public.ordens_servico
  SET
    data              = (p_os_data->>'data')::date,
    hora              = NULLIF(p_os_data->>'hora', ''),
    hora_extra        = COALESCE(p_os_data->>'hora_extra', ''),
    no_show           = v_no_show,
    no_show_percentual = CASE WHEN v_no_show THEN COALESCE(v_no_show_percentual::smallint, 100) ELSE NULL END,
    os_number         = COALESCE(p_os_data->>'os_number', ''),
    cliente_id        = NULLIF(p_os_data->>'cliente_id', '')::uuid,
    solicitante       = COALESCE(p_os_data->>'solicitante', ''),
    solicitante_id    = NULLIF(p_os_data->>'solicitante_id', '')::uuid,
    centro_custo      = COALESCE(p_os_data->>'centro_custo', ''),
    centro_custo_id   = NULLIF(p_os_data->>'centro_custo_id', '')::uuid,
    motorista         = COALESCE(p_os_data->>'motorista', ''),
    driver_id         = NULLIF(p_os_data->>'driver_id', '')::uuid,
    veiculo_id        = NULLIF(p_os_data->>'veiculo_id', '')::uuid,
    valor_bruto       = v_v_bruto,
    obs_financeiras   = COALESCE(p_os_data->>'obs_financeiras', ''),
    imposto           = v_base_cobranca * (v_imposto_percentual / 100),
    custo             = v_v_custo,
    lucro             = v_base_cobranca - (v_base_cobranca * (v_imposto_percentual / 100)) - v_repasse_efetivo,
    tipo              = v_tipo,
    is_freelance      = (v_tipo = 'freelance'),
    updated_at        = NOW()
  WHERE id = p_os_id;

  -- ── Ciclos operacionais (inalterado) ──
  DELETE FROM public.os_operational_cycles WHERE ordem_servico_id = p_os_id;

  IF p_operational_cycles IS NOT NULL AND jsonb_typeof(p_operational_cycles) = 'array' THEN
    INSERT INTO public.os_operational_cycles (
      ordem_servico_id, itinerary_index, sequence_order, kind, ordinal, title, state,
      message_sent_at, accepted_at, started_at, finished_at, km_initial, km_final
    )
    SELECT
      p_os_id,
      COALESCE((elem->>'itineraryIndex')::integer, 0),
      COALESCE((elem->>'sequenceOrder')::integer, 0),
      COALESCE(elem->>'kind', 'itinerary'),
      COALESCE((elem->>'ordinal')::integer, 1),
      COALESCE(NULLIF(elem->>'title', ''), ''),
      COALESCE(elem->>'state', 'pending'),
      NULLIF(elem->>'messageSentAt', '')::timestamptz,
      NULLIF(elem->>'acceptedAt', '')::timestamptz,
      NULLIF(elem->>'startedAt', '')::timestamptz,
      NULLIF(elem->>'finishedAt', '')::timestamptz,
      NULLIF(elem->>'kmInitial', '')::integer,
      NULLIF(elem->>'kmFinal', '')::integer
    FROM jsonb_array_elements(p_operational_cycles) AS elem_row(elem);
  END IF;

  -- ── Recalcula status_operacional a partir dos ciclos (inalterado) ──
  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);
  UPDATE public.ordens_servico
  SET status_operacional = v_new_status, updated_at = NOW()
  WHERE id = p_os_id;

  -- ── Waypoints (inalterado) ──
  DELETE FROM public.os_waypoints WHERE ordem_servico_id = p_os_id;

  IF p_waypoints IS NOT NULL AND jsonb_typeof(p_waypoints) = 'array' THEN
    WITH inserted_waypoints AS (
      INSERT INTO public.os_waypoints (
        ordem_servico_id, position, label, lat, lng, comment, itinerary_index, hora, data
      )
      SELECT
        p_os_id,
        row_number() OVER () - 1,
        COALESCE(wp_row.elem->>'label', ''),
        NULLIF(wp_row.elem->>'lat', '')::double precision,
        NULLIF(wp_row.elem->>'lng', '')::double precision,
        COALESCE(wp_row.elem->>'comment', ''),
        NULLIF(wp_row.elem->>'itinerary_index', '')::integer,
        NULLIF(wp_row.elem->>'hora', '')::time,
        NULLIF(wp_row.elem->>'data', '')::date
      FROM jsonb_array_elements(p_waypoints) AS wp_row(elem)
      RETURNING id, position
    )
    INSERT INTO public.os_waypoint_passengers (waypoint_id, passageiro_id)
    SELECT iw.id, NULLIF(p_elem.pax->>'solicitante_id', '')::uuid
    FROM inserted_waypoints iw
    JOIN (
      SELECT
        (row_number() OVER () - 1)::integer AS pos,
        wp_row2.elem AS wp_elem
      FROM jsonb_array_elements(p_waypoints) AS wp_row2(elem)
    ) wp_pos ON iw.position = wp_pos.pos
    JOIN jsonb_array_elements(wp_pos.wp_elem->'passengers') AS p_elem(pax) ON true
    WHERE jsonb_array_length(COALESCE(wp_pos.wp_elem->'passengers', '[]'::jsonb)) > 0;
  END IF;

  -- ── Log de auditoria (inalterado) ──
  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (
    p_os_id,
    'update',
    v_log_description,
    v_actor_name,
    v_actor_id,
    COALESCE(p_log_metadata, '{}'::jsonb)
  );
END;
$$;
