-- Fix OS creation notification to include protocolo and OS_ID
-- Allows the frontend to display the protocolo in the notification meta
-- and to open the attendance when the notification is clicked.
-- Pattern matches other notifications (e.g. finished): "OS %s ... [OS_ID:%s]"

create or replace function public.handle_new_os_notification()
returns trigger
language plpgsql
security definer
as $function$
declare
    v_avatar_url text;
    v_protocolo text;
begin
    select avatar_url into v_avatar_url
    from public.user_roles
    where id = NEW.created_by;

    v_protocolo := coalesce(NEW.protocolo, NEW.id::text);

    insert into public.app_notifications (
        type,
        title,
        message,
        target_audience,
        empresa_id,
        created_by,
        created_by_name,
        created_by_avatar_url
    )
    values (
        'success',
        'Novo atendimento',
        format('OS %s cadastrada com sucesso. [OS_ID:%s]', v_protocolo, NEW.id),
        'interno',
        NEW.cliente_id,
        NEW.created_by,
        NEW.created_by_name,
        v_avatar_url
    );

    return NEW;
end;
$function$;
