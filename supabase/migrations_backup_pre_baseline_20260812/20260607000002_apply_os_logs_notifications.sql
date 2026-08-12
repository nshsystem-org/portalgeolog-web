-- Migração consolidada para ativar notificações a partir de os_logs
-- Aplica: actor_avatar_url + trigger de notificação com mensagens específicas

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
  v_specific_update_messages text;
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

  if NEW.type = 'update'
     and NEW.metadata ? 'field_changes'
     and jsonb_typeof(NEW.metadata->'field_changes') = 'array' then
    select string_agg(phrase, ' | ' order by sort_order)
      into v_specific_update_messages
    from (
      select phrase, min(sort_order) as sort_order
      from (
        select
          case
            when lower(coalesce(field_change->>'field', '')) in ('código os', 'os') then
              'Código OS atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) in ('solicitante responsável', 'solicitante vinculado', 'solicitante') then
              'Solicitante atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) = 'centro de custo' then
              'Centro de Custo atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) in ('motorista alocado', 'motorista vinculado', 'motorista') then
              'Motorista atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) = 'veículo de uso' then
              'Veículo atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) = 'valor bruto (r$)' then
              'Valor atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) = 'custo motorista (r$)' then
              'Custo com Motorista atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) = 'hora extra' then
              'Hora Extra atualizado com sucesso.'
            when lower(coalesce(field_change->>'field', '')) = 'observações financeiras' then
              'Observações Financeiras atualizada com sucesso.'
            else
              null
          end as phrase,
          case
            when lower(coalesce(field_change->>'field', '')) in ('código os', 'os') then 1
            when lower(coalesce(field_change->>'field', '')) in ('solicitante responsável', 'solicitante vinculado', 'solicitante') then 2
            when lower(coalesce(field_change->>'field', '')) = 'centro de custo' then 3
            when lower(coalesce(field_change->>'field', '')) in ('motorista alocado', 'motorista vinculado', 'motorista') then 4
            when lower(coalesce(field_change->>'field', '')) = 'veículo de uso' then 5
            when lower(coalesce(field_change->>'field', '')) = 'valor bruto (r$)' then 6
            when lower(coalesce(field_change->>'field', '')) = 'custo motorista (r$)' then 7
            when lower(coalesce(field_change->>'field', '')) = 'hora extra' then 8
            when lower(coalesce(field_change->>'field', '')) = 'observações financeiras' then 9
            else 100
          end as sort_order
        from jsonb_array_elements(coalesce(NEW.metadata->'field_changes', '[]'::jsonb)) as field_change
      ) mapped
      where phrase is not null
      group by phrase
    ) phrases;
  end if;

  case NEW.type
    when 'update' then
      v_title := 'Atendimento atualizado';
      if v_specific_update_messages is not null then
        v_message := format(
          'A OS %s %s',
          coalesce(v_protocolo, NEW.os_id::text),
          v_specific_update_messages
        );
      else
        -- Notificação resumida no toast; detalhes completos ficam em os_logs (modal "Logs de Atendimento")
        v_message := format(
          'A OS %s foi atualizada por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
      end if;
      v_notification_type := 'info';
    when 'status_change' then
      v_title := 'Status do atendimento atualizado';
      if v_action = 'finish_all'
         or coalesce(NEW.metadata->'updates'->>'operacional', '') = 'Finalizado'
         or coalesce(NEW.metadata->>'status_operacional', '') = 'Finalizado' then
        v_title := 'Atendimento finalizado';
        v_message := format(
          'A OS %s OS finalizada com sucesso.',
          coalesce(v_protocolo, NEW.os_id::text)
        );
        v_notification_type := 'success';
      elsif v_action = 'revert_to_pending' then
        v_message := format(
          'A OS %s retornou para status Pendente.',
          coalesce(v_protocolo, NEW.os_id::text)
        );
      elsif v_action = 'revert_to_accept' then
        v_message := format(
          'A OS %s retornou para status Aceite.',
          coalesce(v_protocolo, NEW.os_id::text)
        );
      elsif v_updates is not null then
        v_message := format(
          'A OS %s teve o status atualizado: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          v_updates
        );
      else
        v_message := format(
          'A OS %s teve o status atualizado.',
          coalesce(v_protocolo, NEW.os_id::text)
        );
      end if;
      v_notification_type := 'warning';
    when 'archive' then
      v_title := 'Atendimento arquivado';
      v_message := format(
        'A OS %s foi arquivada com sucesso.',
        coalesce(v_protocolo, NEW.os_id::text)
      );
      v_notification_type := 'warning';
    when 'unarchive' then
      v_title := 'Atendimento reaberto';
      v_message := format(
        'A OS %s foi reaberta com sucesso.',
        coalesce(v_protocolo, NEW.os_id::text)
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
