-- Trigger to notify when an OS status changes to 'Finalizado'
-- This catches all paths: manual finalization, edit finalization, cycle completion

CREATE OR REPLACE FUNCTION public.handle_os_finished_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_avatar_url text;
BEGIN
    -- Only trigger when status_operacional changes to 'Finalizado'
    IF NEW.status_operacional = 'Finalizado' AND 
       (OLD.status_operacional IS NULL OR OLD.status_operacional != 'Finalizado') THEN
        
        SELECT avatar_url INTO v_avatar_url
        FROM public.user_roles
        WHERE id = NEW.created_by;

        INSERT INTO public.app_notifications (
            type,
            title,
            message,
            target_audience,
            empresa_id,
            created_by,
            created_by_name,
            created_by_avatar_url
        )
        VALUES (
            'success',
            'Atendimento finalizado',
            format('OS %s finalizada com sucesso. [OS_ID:%s]', COALESCE(NEW.protocolo, NEW.id::text), NEW.id),
            'interno',
            NEW.cliente_id,
            NEW.created_by,
            COALESCE(NEW.created_by_name, 'Sistema'),
            v_avatar_url
        );
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_os_finished_trigger ON public.ordens_servico;
CREATE TRIGGER notify_os_finished_trigger
    AFTER UPDATE OF status_operacional ON public.ordens_servico
    FOR EACH ROW
    WHEN (OLD.status_operacional IS DISTINCT FROM NEW.status_operacional)
    EXECUTE FUNCTION public.handle_os_finished_notification();
