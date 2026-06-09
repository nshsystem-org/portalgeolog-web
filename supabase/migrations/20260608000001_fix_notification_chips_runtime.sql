-- Fix runtime error in notification chips trigger aggregation
-- The previous version used jsonb_agg(DISTINCT ... ORDER BY ...), which can fail
-- at execution time when OS logs are inserted. This version keeps the same
-- behavior but aggregates through a grouped subquery and emits a safe JSON array.

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
  v_changed_fields_list jsonb;
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
    select coalesce(jsonb_agg(label order by sort_order), '[]'::jsonb)
      into v_changed_fields_list
    from (
      select label, min(sort_order) as sort_order
      from (
        select
          case
            when lower(coalesce(field_change->>'field', '')) in ('código os', 'os') then 'Código OS'
            when lower(coalesce(field_change->>'field', '')) in ('solicitante responsável', 'solicitante vinculado', 'solicitante') then 'Solicitante'
            when lower(coalesce(field_change->>'field', '')) = 'centro de custo' then 'Centro de Custo'
            when lower(coalesce(field_change->>'field', '')) in ('motorista alocado', 'motorista vinculado', 'motorista') then 'Motorista'
            when lower(coalesce(field_change->>'field', '')) = 'veículo de uso' then 'Veículo'
            when lower(coalesce(field_change->>'field', '')) = 'valor bruto (r$)' then 'Valor'
            when lower(coalesce(field_change->>'field', '')) = 'custo motorista (r$)' then 'Custo com Motorista'
            when lower(coalesce(field_change->>'field', '')) = 'hora extra' then 'Hora Extra'
            when lower(coalesce(field_change->>'field', '')) = 'observações financeiras' then 'Observações Financeiras'
            else null
          end as label,
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
      where label is not null
      group by label
    ) labels;
  end if;

  case NEW.type
    when 'update' then
      v_title := 'Atendimento atualizado';
      if coalesce(jsonb_array_length(v_changed_fields_list), 0) > 0 then
        v_message := format(
          'Protocolo #%s — Atualizações realizadas:',
          coalesce(v_protocolo, NEW.os_id::text)
        );
      elsif v_changed_sections is not null then
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
    created_by_avatar_url,
    metadata
  )
  values (
    v_notification_type,
    v_title,
    v_message,
    'interno',
    v_cliente_id,
    NEW.actor_id,
    NEW.actor_name,
    v_avatar_url,
    jsonb_build_object('changed_fields_list', coalesce(v_changed_fields_list, '[]'::jsonb))
  );

  return NEW;
end;
$function$;
