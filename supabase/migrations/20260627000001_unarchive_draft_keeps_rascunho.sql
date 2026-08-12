-- =============================================================================
-- Migration: unarchive_draft_keeps_rascunho
-- Data: 2026-06-28
-- =============================================================================
-- Objetivo: Ao reabrir (desarquivar) um rascunho arquivado, ele deve voltar
-- a ser um rascunho ativo (status Rascunho) em vez de virar uma OS real.
-- =============================================================================

-- ── 1. unarchive_os_atomic: preservar tipo rascunho ao reabrir ────────────────
CREATE OR REPLACE FUNCTION public.unarchive_os_atomic(
  p_os_id uuid,
  p_os_label text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_tipo text;
  v_is_draft boolean;
BEGIN
  v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  v_actor_name := COALESCE(
    (SELECT nome FROM public.user_roles WHERE id = v_actor_id),
    'Sistema'
  );

  SELECT tipo INTO v_tipo
  FROM public.ordens_servico
  WHERE id = p_os_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS % não encontrada', p_os_id;
  END IF;

  v_is_draft := (v_tipo = 'rascunho');

  UPDATE public.ordens_servico
  SET
    arquivado = false,
    status_operacional = CASE WHEN v_is_draft THEN 'Rascunho' ELSE 'Pendente' END,
    status_financeiro = CASE WHEN v_is_draft THEN 'Rascunho' ELSE 'Pendente' END,
    updated_at = NOW()
  WHERE id = p_os_id;

  INSERT INTO public.os_logs (os_id, type, description, actor_name, actor_id, metadata)
  VALUES (
    p_os_id,
    'unarchive',
    CASE WHEN v_is_draft
      THEN 'Rascunho reaberto' || CASE WHEN p_os_label IS NOT NULL AND p_os_label <> '' THEN ' — ' || p_os_label ELSE '' END
      ELSE 'OS reaberta' || CASE WHEN p_os_label IS NOT NULL AND p_os_label <> '' THEN ' — ' || p_os_label ELSE '' END
    END,
    v_actor_name,
    v_actor_id,
    jsonb_build_object('action', 'unarchive', 'tipo', v_tipo)
  );
END;
$$;
