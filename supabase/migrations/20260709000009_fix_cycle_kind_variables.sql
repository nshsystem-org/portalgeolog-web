-- Migration: Corrige variaveis v_cycle_kind/v_cycle_ordinal no trigger handle_os_log_notification
--
-- Contexto:
--   A migration 20260709000008 alterou o INSERT em app_notifications para usar
--   v_cycle_kind/v_cycle_ordinal no metadata, mas:
--     1. NAO declarou as variaveis no DECLARE → erro "column v_cycle_kind does not exist"
--        em toda atualizacao/arquivamento de OS (09/07/2026, 9 ocorrencias 08:59-09:57 BRT)
--     2. NAO adicionou o SELECT INTO para popula-las → sempre NULL, badge de ciclo
--        no frontend (MotoristaNotifications) nunca renderiza
--
-- Correcao (2 partes, ambas idempotentes):
--   PARTE 1: Adiciona v_cycle_kind text; e v_cycle_ordinal integer; no DECLARE
--            (ja aplicado manualmente em producao em 09/07/2026 ~12:57 UTC)
--   PARTE 2: Adiciona SELECT kind, ordinal INTO ... FROM os_operational_cycles
--            usando o indice unico (ordem_servico_id, itinerary_index)
--
-- Justificativa da abordagem (Option A — enriquecimento no trigger):
--   - Segue o padrao existente: o trigger ja busca protocolo, cliente_id e
--     motorista da tabela canonica (ordens_servico) em vez de esperar do app
--   - Conforme AGENTS.md: "Toda logica de o que e para quem notificar deve
--     residir no banco de dados"
--   - Atende TODOS os caminhos de INSERT em os_logs (cron + frontend), nao
--     apenas os do os-reminders.ts
--   - Lookup O(1) via idx_os_operational_cycles_os_itinerary_index (unique)

DO $$
DECLARE
  v_funcdef text;
  v_newdef text;
BEGIN
  SELECT pg_get_functiondef('public.handle_os_log_notification()'::regprocedure)
    INTO v_funcdef;

  -- ===================================================================
  -- PARTE 1: Adiciona v_cycle_kind e v_cycle_ordinal no DECLARE
  -- ===================================================================
  -- Usa chr(10) para o newline (escape frágil causou falha anteriormente)
  IF v_funcdef NOT LIKE '%v_cycle_kind text;%v_cycle_ordinal integer;%v_km_value text;%' THEN
    v_newdef := replace(
      v_funcdef,
      'v_cycle_label text;' || chr(10) || '  v_km_value text;',
      'v_cycle_label text;' || chr(10) ||
      '  v_cycle_kind text;' || chr(10) ||
      '  v_cycle_ordinal integer;' || chr(10) ||
      '  v_km_value text;'
    );

    IF v_newdef = v_funcdef THEN
      RAISE EXCEPTION 'PARTE 1 falhou: padrao do DECLARE nao encontrado';
    END IF;

    v_funcdef := v_newdef;
    RAISE NOTICE 'PARTE 1: v_cycle_kind e v_cycle_ordinal declarados';
  ELSE
    RAISE NOTICE 'PARTE 1: variaveis ja estao declaradas (skip)';
  END IF;

  -- ===================================================================
  -- PARTE 2: Adiciona SELECT kind, ordinal INTO no corpo do trigger
  -- ===================================================================
  -- Insere logo apos o bloco que processa cycle_index, antes do bloco action.
  -- O cycle_index do os_logs.metadata mapeia para itinerary_index na tabela.
  IF v_funcdef NOT LIKE '%os_operational_cycles%' THEN
    v_newdef := replace(
      v_funcdef,
      '    END;' || chr(10) ||
      '  END IF;' || chr(10) || chr(10) ||
      '  IF NEW.metadata ? ''action'' THEN',
      '    END;' || chr(10) ||
      '  END IF;' || chr(10) || chr(10) ||
      '  -- Popula v_cycle_kind e v_cycle_ordinal a partir da tabela canonica' || chr(10) ||
      '  -- (segue o mesmo padrao do SELECT protocolo/cliente_id/motorista acima)' || chr(10) ||
      '  IF v_cycle_index IS NOT NULL THEN' || chr(10) ||
      '    SELECT kind, ordinal' || chr(10) ||
      '      INTO v_cycle_kind, v_cycle_ordinal' || chr(10) ||
      '    FROM public.os_operational_cycles' || chr(10) ||
      '    WHERE ordem_servico_id = NEW.os_id' || chr(10) ||
      '      AND itinerary_index = v_cycle_index;' || chr(10) ||
      '  END IF;' || chr(10) || chr(10) ||
      '  IF NEW.metadata ? ''action'' THEN'
    );

    IF v_newdef = v_funcdef THEN
      RAISE EXCEPTION 'PARTE 2 falhou: ponto de insercao nao encontrado';
    END IF;

    v_funcdef := v_newdef;
    RAISE NOTICE 'PARTE 2: SELECT INTO os_operational_cycles adicionado';
  ELSE
    RAISE NOTICE 'PARTE 2: lookup ja existe (skip)';
  END IF;

  EXECUTE v_funcdef;
  RAISE NOTICE 'Migration 20260709000009 aplicada com sucesso';
END $$;
