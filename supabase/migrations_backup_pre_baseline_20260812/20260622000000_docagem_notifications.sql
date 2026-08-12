-- =============================================================================
-- Migration: docagem_notifications
-- Data: 2026-06-22
-- =============================================================================
-- Gera notificações internas (app_notifications) para eventos de docagem:
-- criação, finalização, reset, exclusão, reativação e cancelamento.
-- Segue o padrão do projeto: notificações são geradas exclusivamente por
-- PostgreSQL triggers, e o frontend apenas renderiza o que o banco envia.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Função auxiliar: inserir notificação de docagem
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
    p_type,
    p_title,
    p_message,
    'interno',
    p_empresa_id,
    p_actor_id,
    COALESCE(v_actor_name, 'Sistema'),
    v_actor_avatar_url,
    p_metadata
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Notificação ao criar uma nova docagem
-- ---------------------------------------------------------------------------
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

  SELECT nome INTO v_cliente_nome
  FROM public.clientes
  WHERE id = NEW.cliente_id;

  PERFORM public.insert_docagem_notification(
    'success',
    'Nova docagem',
    format('Docagem criada para %s em %s.', COALESCE(v_cliente_nome, 'Cliente'), NEW.endereco),
    NEW.cliente_id,
    v_actor_id,
    jsonb_build_object(
      'docagem_id', NEW.id,
      'cliente_id', NEW.cliente_id,
      'data_inicio', NEW.data_inicio,
      'data_fim', NEW.data_fim
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_docagem_created_trigger ON public.docagens;
CREATE TRIGGER notify_docagem_created_trigger
  AFTER INSERT ON public.docagens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_docagem_created_notification();

-- ---------------------------------------------------------------------------
-- 3. Notificação ao cancelar uma docagem
-- ---------------------------------------------------------------------------
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

    SELECT nome INTO v_cliente_nome
    FROM public.clientes
    WHERE id = NEW.cliente_id;

    PERFORM public.insert_docagem_notification(
      'warning',
      'Docagem cancelada',
      format('Docagem de %s em %s foi cancelada.', COALESCE(v_cliente_nome, 'Cliente'), NEW.endereco),
      NEW.cliente_id,
      v_actor_id,
      jsonb_build_object('docagem_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_docagem_cancelled_trigger ON public.docagens;
CREATE TRIGGER notify_docagem_cancelled_trigger
  AFTER UPDATE OF status ON public.docagens
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_docagem_cancelled_notification();

-- ---------------------------------------------------------------------------
-- 4. Notificações para alterações de status de instâncias diárias
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_docagem_instance_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_docagem_id UUID;
  v_cliente_id UUID;
  v_cliente_nome TEXT;
  v_endereco TEXT;
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_status TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;

  SELECT d.id, d.cliente_id, d.endereco
    INTO v_docagem_id, v_cliente_id, v_endereco
  FROM public.docagens d
  WHERE d.id = NEW.docagem_id;

  SELECT nome INTO v_cliente_nome
  FROM public.clientes
  WHERE id = v_cliente_id;

  v_status := NEW.status;

  CASE v_status
    WHEN 'finalizada' THEN
      v_title := 'Dia de docagem finalizado';
      v_message := format('Dia %s da docagem de %s foi finalizado.', NEW.data, COALESCE(v_cliente_nome, 'Cliente'));
      v_type := 'success';
    WHEN 'pendente' THEN
      IF OLD.status = 'finalizada' THEN
        v_title := 'Dia de docagem resetado';
        v_message := format('Dia %s da docagem de %s voltou para pendente.', NEW.data, COALESCE(v_cliente_nome, 'Cliente'));
        v_type := 'warning';
      ELSE
        v_title := 'Dia de docagem reativado';
        v_message := format('Dia %s da docagem de %s foi reativado.', NEW.data, COALESCE(v_cliente_nome, 'Cliente'));
        v_type := 'success';
      END IF;
    WHEN 'excluida' THEN
      v_title := 'Dia de docagem excluído';
      v_message := format('Dia %s da docagem de %s foi excluído.', NEW.data, COALESCE(v_cliente_nome, 'Cliente'));
      v_type := 'warning';
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM public.insert_docagem_notification(
    v_type,
    v_title,
    v_message,
    v_cliente_id,
    v_actor_id,
    jsonb_build_object(
      'docagem_id', v_docagem_id,
      'instancia_id', NEW.id,
      'data', NEW.data,
      'status', NEW.status,
      'status_anterior', OLD.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_docagem_instance_status_trigger ON public.docagem_instancias;
CREATE TRIGGER notify_docagem_instance_status_trigger
  AFTER UPDATE OF status ON public.docagem_instancias
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_docagem_instance_status_notification();
