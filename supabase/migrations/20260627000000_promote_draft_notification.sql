-- =============================================================================
-- Migration: promote_draft_notification
-- Data: 2026-06-27
-- =============================================================================
-- Ao promover um rascunho para OS real:
--   - Valida campos obrigatórios (data, cliente, solicitante, motorista, veículo)
--   - Gera a notificação "Novo atendimento - OS cadastrada com sucesso." no sino
-- =============================================================================

CREATE OR REPLACE FUNCTION public.promote_draft_to_os(
  p_os_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_actor_avatar_url text;
  v_new_status text;
  v_tipo text;
  v_cliente_id uuid;
  v_protocolo text;
  v_data text;
  v_solicitante_id text;
  v_driver_id text;
  v_veiculo_id text;
  v_missing text[];
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );
  v_actor_avatar_url := (
    SELECT avatar_url FROM public.user_roles WHERE id = v_actor_id
  );

  SELECT tipo, cliente_id, protocolo, data, solicitante_id, driver_id, veiculo_id
    INTO v_tipo, v_cliente_id, v_protocolo, v_data, v_solicitante_id, v_driver_id, v_veiculo_id
  FROM public.ordens_servico
  WHERE id = p_os_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS % não encontrada', p_os_id;
  END IF;

  IF v_tipo <> 'rascunho' THEN
    RAISE EXCEPTION 'OS % não é um rascunho (tipo atual: %)', p_os_id, v_tipo;
  END IF;

  -- Validar campos obrigatórios antes de promover
  v_missing := ARRAY[]::text[];
  IF COALESCE(v_data, '') = '' THEN
    v_missing := array_append(v_missing, 'Data');
  END IF;
  IF COALESCE(v_cliente_id::text, '') = '' THEN
    v_missing := array_append(v_missing, 'Empresa');
  END IF;
  IF COALESCE(v_solicitante_id, '') = '' THEN
    v_missing := array_append(v_missing, 'Solicitante Responsável');
  END IF;
  IF COALESCE(v_driver_id, '') = '' THEN
    v_missing := array_append(v_missing, 'Motorista Alocado');
  END IF;
  IF COALESCE(v_veiculo_id, '') = '' THEN
    v_missing := array_append(v_missing, 'Veículo de Uso');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Campos obrigatórios faltando: %', array_to_string(v_missing, ', ');
  END IF;

  -- Derivar status dos ciclos (ou Pendente se não houver ciclos)
  v_new_status := public.derive_os_operational_status_from_cycles(p_os_id);

  -- Promover
  UPDATE public.ordens_servico
  SET
    tipo              = 'os',
    is_freelance      = false,
    status_operacional = v_new_status,
    status_financeiro = 'Pendente',
    updated_at        = NOW()
  WHERE id = p_os_id;

  -- Log de promoção
  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (p_os_id, 'create', 'Rascunho promovido para OS', v_actor_name, v_actor_id,
    jsonb_build_object('action', 'promote_draft'));

  -- Notificação no sino: "OS cadastrada com sucesso"
  INSERT INTO public.app_notifications (
    type,
    title,
    message,
    target_audience,
    empresa_id,
    created_by,
    created_by_name,
    created_by_avatar_url,
    metadata
  )
  VALUES (
    'success',
    'Novo atendimento',
    format('OS %s cadastrada com sucesso. [OS_ID:%s]', COALESCE(v_protocolo, p_os_id::text), p_os_id),
    'interno',
    v_cliente_id,
    v_actor_id,
    v_actor_name,
    v_actor_avatar_url,
    jsonb_build_object('os_id', p_os_id, 'protocolo', v_protocolo, 'action', 'promote_draft')
  );

  RETURN p_os_id;
END;
$$;
