-- Melhora a notificação de "Novo Centro de Custo":
-- 1. Popula created_by / created_by_name / created_by_avatar_url a partir
--    do usuário autenticado (auth.uid()) em vez de deixar NULL.
-- 2. Simplifica a mensagem para "{actor} criou um novo Centro de Custo"
--    (sem expor o nome do centro nem a empresa, conforme solicitado).
--
-- O frontend já mostra created_by_name em bold + actionText derivado do
-- título, então a mensagem do banco só é usada na notificação desktop e
-- no banco para auditoria.

CREATE OR REPLACE FUNCTION public.handle_new_centro_custo_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_actor_name text;
  v_actor_avatar text;
BEGIN
  -- Tenta resolver nome e avatar do usuário autenticado
  IF v_user_id IS NOT NULL THEN
    SELECT nome, avatar_url
      INTO v_actor_name, v_actor_avatar
    FROM public.user_roles
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.app_notifications (
    type,
    title,
    message,
    target_audience,
    created_by,
    created_by_name,
    created_by_avatar_url
  )
  VALUES (
    'info',
    'Novo Centro de Custo',
    'criou um novo Centro de Custo.',
    'interno',
    v_user_id,
    v_actor_name,
    v_actor_avatar
  );

  RETURN NEW;
END;
$function$;
