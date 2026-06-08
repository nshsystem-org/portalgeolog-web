alter table public.os_logs
  add column if not exists actor_avatar_url text;

comment on column public.os_logs.actor_avatar_url
  is 'Snapshot do avatar do autor do log para renderização rápida do histórico.';

update public.os_logs l
set actor_avatar_url = u.avatar_url
from public.user_roles u
where l.actor_id = u.id
  and l.actor_avatar_url is null
  and u.avatar_url is not null;

create or replace function public.handle_os_log_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_protocolo text;
  v_cliente_id uuid;
  v_avatar_url text;
  v_changed_sections text;
  v_updates text;
  v_action text;
  v_cycle_index integer;
  v_cycle_label text;
  v_km_value text;
  v_title text;
  v_message text;
  v_notification_type text;
begin
  if NEW.type not in (
    'update',
    'status_change',
    'archive',
    'unarchive',
    'driver_accept',
    'driver_start',
    'driver_finish',
    'comment'
  ) then
    return NEW;
  end if;

  select protocolo, cliente_id
    into v_protocolo, v_cliente_id
  from public.ordens_servico
  where id = NEW.os_id;

  if not found then
    return NEW;
  end if;

  select avatar_url
    into v_avatar_url
  from public.user_roles
  where id = NEW.actor_id;

  if NEW.metadata ? 'changed_sections' and jsonb_typeof(NEW.metadata->'changed_sections') = 'array' then
    select string_agg(section.value, ', ')
      into v_changed_sections
    from jsonb_array_elements_text(coalesce(NEW.metadata->'changed_sections', '[]'::jsonb)) as section(value);
  end if;

  if NEW.metadata ? 'updates' and jsonb_typeof(NEW.metadata->'updates') = 'object' then
    v_updates := nullif(
      concat_ws(
        ' | ',
        nullif(NEW.metadata->'updates'->>'operacional', ''),
        nullif(NEW.metadata->'updates'->>'financeiro', '')
      ),
      ''
    );
  end if;

  if NEW.metadata ? 'cycle_index' then
    begin
      v_cycle_index := (NEW.metadata->>'cycle_index')::integer;
      v_cycle_label := format('no ciclo %s', v_cycle_index + 1);
    exception
      when others then
        v_cycle_label := null;
    end;
  end if;

  if NEW.metadata ? 'action' then
    v_action := NEW.metadata->>'action';
  end if;

  if NEW.metadata ? 'km_initial' then
    v_km_value := NEW.metadata->>'km_initial';
  elsif NEW.metadata ? 'km_final' then
    v_km_value := NEW.metadata->>'km_final';
  end if;

  case NEW.type
    when 'update' then
      v_title := 'Atendimento atualizado';
      if v_changed_sections is not null then
        v_message := format(
          'A OS %s recebeu uma atualização de %s. Itens alterados: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          v_changed_sections
        );
      else
        v_message := format(
          'A OS %s recebeu uma atualização de %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
      end if;
      v_notification_type := 'info';
    when 'status_change' then
      v_title := 'Status do atendimento atualizado';
      if v_action = 'finish_all' then
        v_message := format(
          'Todos os ciclos da OS %s foram finalizados por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
      elsif v_action = 'finish_cycle' then
        v_message := format(
          'O ciclo da OS %s foi finalizado manualmente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end
        );
      elsif v_action = 'revert_to_pending' then
        v_message := format(
          'O ciclo da OS %s foi revertido para pendente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end
        );
      elsif v_action = 'revert_to_accept' then
        v_message := format(
          'O ciclo da OS %s voltou para aceite por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end
        );
      elsif v_updates is not null then
        v_message := format(
          'A OS %s foi atualizada por %s. Status: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          v_updates
        );
      else
        v_message := format(
          'A OS %s teve o status atualizado por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
      end if;
      v_notification_type := 'warning';
    when 'archive' then
      v_title := 'Atendimento arquivado';
      v_message := format(
        'A OS %s foi arquivada por %s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Sistema')
      );
      v_notification_type := 'warning';
    when 'unarchive' then
      v_title := 'Atendimento reaberto';
      v_message := format(
        'A OS %s foi reaberta por %s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Sistema')
      );
      v_notification_type := 'success';
    when 'driver_accept' then
      v_title := 'Motorista confirmou o atendimento';
      v_message := format(
        'A OS %s foi aceita por %s%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        coalesce(NEW.actor_name, 'Sistema'),
        case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end
      );
      v_notification_type := 'info';
    when 'driver_start' then
      v_title := 'Rota iniciada';
      v_message := format(
        'A OS %s iniciou a rota%s%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end,
        case when v_km_value is not null then format(' com KM inicial %s', v_km_value) else '' end
      );
      v_notification_type := 'info';
    when 'driver_finish' then
      v_title := 'Rota finalizada';
      v_message := format(
        'A OS %s finalizou a rota%s%s.',
        coalesce(v_protocolo, NEW.os_id::text),
        case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end,
        case when v_km_value is not null then format(' com KM final %s', v_km_value) else '' end
      );
      v_notification_type := 'success';
    when 'comment' then
      v_title := 'Novo comentário no atendimento';
      v_message := format('A OS %s recebeu um novo comentário.', coalesce(v_protocolo, NEW.os_id::text));
      v_notification_type := 'info';
    else
      return NEW;
  end case;

  v_message := v_message || format(' [OS_ID:%s]', NEW.os_id);

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
    v_notification_type,
    v_title,
    v_message,
    'interno',
    v_cliente_id,
    NEW.actor_id,
    NEW.actor_name,
    v_avatar_url
  );

  return NEW;
end;
$function$;

drop trigger if exists notify_os_log_insert_trigger on public.os_logs;
create trigger notify_os_log_insert_trigger
after insert on public.os_logs
for each row
execute function public.handle_os_log_notification();
