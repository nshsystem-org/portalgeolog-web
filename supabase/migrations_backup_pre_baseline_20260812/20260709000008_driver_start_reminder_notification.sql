-- Migration: Adiciona notificacao para T-60min (botao INICIAR) + corrige metadata de cycle_kind/cycle_ordinal
--
-- 1. Adiciona 'driver_start_reminder' aos tipos tratados pelo trigger
-- 2. CASE: titulo "Lembrete de Iniciar Rota enviado", mensagem simples, categoria motorista
-- 3. Corrige INSERT: usa v_cycle_kind/v_cycle_ordinal (variaveis calculadas pelo trigger)
--    em vez de NEW.metadata->>'cycle_kind' (que e NULL pois o log so envia cycle_index)

DO $$
DECLARE
  v_funcdef text;
  v_newdef text;
BEGIN
  SELECT pg_get_functiondef('public.handle_os_log_notification()'::regprocedure)
    INTO v_funcdef;

  -- 1. Adiciona 'driver_start_reminder' na lista de tipos permitidos
  IF v_funcdef NOT LIKE '%driver_start_reminder%' THEN
    v_newdef := replace(
      v_funcdef,
      '''driver_edit_ack''
  ) THEN',
      '''driver_edit_ack'',
    ''driver_start_reminder''
  ) THEN'
    );
    v_funcdef := v_newdef;
  END IF;

  -- 2. Adiciona CASE para driver_start_reminder antes do ELSE
  IF v_funcdef NOT LIKE '%WHEN ''driver_start_reminder''%' THEN
    v_newdef := replace(
      v_funcdef,
      'WHEN ''driver_edit_ack'' THEN
      v_title := ''Motorista confirmou alteração'';
      v_message := ''confirmou estar ciente da alteração do atendimento'';
      v_notification_type := ''success'';
      v_category := ''motorista'';',
      'WHEN ''driver_edit_ack'' THEN
      v_title := ''Motorista confirmou alteração'';
      v_message := ''confirmou estar ciente da alteração do atendimento'';
      v_notification_type := ''success'';
      v_category := ''motorista'';
    WHEN ''driver_start_reminder'' THEN
      v_title := ''Lembrete de Iniciar Rota enviado'';
      v_message := ''Lembrete de iniciar rota enviado'';
      v_notification_type := ''info'';
      v_category := ''motorista'';'
    );
    v_funcdef := v_newdef;
  END IF;

  -- 3. Corrige INSERT: usa v_cycle_kind/v_cycle_ordinal em vez de NEW.metadata
  IF v_funcdef LIKE '%nullif(NEW.metadata->>''cycle_kind''%' THEN
    v_newdef := replace(
      v_funcdef,
      '''cycle_kind'', nullif(NEW.metadata->>''cycle_kind'', ''''),
      ''cycle_ordinal'', nullif(NEW.metadata->>''cycle_ordinal'', '''')',
      '''cycle_kind'', nullif(v_cycle_kind, ''''),
      ''cycle_ordinal'', nullif(v_cycle_ordinal::text, '''')'
    );
    v_funcdef := v_newdef;
  END IF;

  EXECUTE v_funcdef;
  RAISE NOTICE 'Trigger atualizado com driver_start_reminder + fix metadata';
END $$;
