-- Ensure OS creation notification carries the author data from ordens_servico
-- so the trigger-generated app_notifications row is not duplicated by client code
-- and still shows the user who created the OS.

create or replace function public.handle_new_os_notification()
returns trigger
language plpgsql
security definer
as $function$
declare
    v_avatar_url text;
begin
    select avatar_url into v_avatar_url
    from public.user_roles
    where id = NEW.created_by;

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
        'info',
        'Nova Ordem de Serviço',
        'Protocolo #' || NEW.protocolo || ' foi gerado.',
        'interno',
        NEW.cliente_id,
        NEW.created_by,
        NEW.created_by_name,
        v_avatar_url
    );

    return NEW;
end;
$function$;
