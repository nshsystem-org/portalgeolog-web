-- Update OS creation notification title, message, and type
-- Change from "Nova Ordem de Serviço" to "Novo atendimento"
-- Change from "Protocolo #X foi gerado." to "OS cadastrada com sucesso"
-- Change type from 'info' to 'success' for green check icon

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
        'success',
        'Novo atendimento',
        'OS cadastrada com sucesso.',
        'interno',
        NEW.cliente_id,
        NEW.created_by,
        NEW.created_by_name,
        v_avatar_url
    );

    return NEW;
end;
$function$;
