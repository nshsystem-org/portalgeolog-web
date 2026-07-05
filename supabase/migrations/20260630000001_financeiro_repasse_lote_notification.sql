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
  v_detail text;
  v_details text[] := '{}'::text[];
  v_change jsonb;
  v_driver_name text;
  v_repasse_os_count integer;
  v_periodo text;
  v_attach_os_id boolean := true;
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

  if NEW.metadata ? 'cliente_id' then
    begin
      v_cliente_id := nullif(NEW.metadata->>'cliente_id', '')::uuid;
    exception
      when others then
        null;
    end;
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

  if NEW.metadata ? 'field_changes' and jsonb_typeof(NEW.metadata->'field_changes') = 'array' then
    for v_change in select value from jsonb_array_elements(NEW.metadata->'field_changes') as value
    loop
      if v_change->>'action' = 'added' then
        v_detail := format('Adicionou %s%s',
          v_change->>'field',
          case when v_change->>'to' is not null and v_change->>'to' <> '' then format(': %s', v_change->>'to') else '' end
        );
      elsif v_change->>'action' = 'removed' then
        v_detail := format('Removeu %s%s',
          v_change->>'field',
          case when v_change->>'from' is not null and v_change->>'from' <> '' then format(': %s', v_change->>'from') else '' end
        );
      else
        v_detail := format('%s: %s → %s',
          v_change->>'field',
          coalesce(nullif(v_change->>'from', ''), '—'),
          coalesce(nullif(v_change->>'to', ''), '—')
        );
      end if;
      v_details := array_append(v_details, v_detail);
    end loop;
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
      if array_length(v_details, 1) > 0 then
        v_message := format(
          'A OS %s foi atualizada por %s. %s',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          array_to_string(v_details, ' | ')
        );
        if length(v_message) > 330 then
          v_message := substring(v_message from 1 for 330) || '...';
        end if;
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
      if v_action = 'repasse_lote_pago' or coalesce(NEW.metadata->>'lote', 'false') = 'true' then
        select name
          into v_driver_name
        from public.drivers
        where id = nullif(NEW.metadata->>'driver_id', '')::uuid;

        v_repasse_os_count := coalesce(jsonb_array_length(coalesce(NEW.metadata->'os_ids', '[]'::jsonb)), 0);

        if NEW.metadata ? 'data_inicio' and NEW.metadata ? 'data_fim' then
          v_periodo := format(' no período %s a %s', NEW.metadata->>'data_inicio', NEW.metadata->>'data_fim');
        end if;

        v_title := 'Repasse em lote registrado';
        v_message := format(
          'O repasse em lote do motorista %s foi marcado como pago%s%s.',
          coalesce(v_driver_name, nullif(NEW.metadata->>'driver_id', ''), 'Sistema'),
          case when v_repasse_os_count > 0 then format(' (%s OS)', v_repasse_os_count) else '' end,
          coalesce(v_periodo, '')
        );
        v_notification_type := 'success';
        v_attach_os_id := false;
      elsif v_action = 'finish_all' then
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'Todos os ciclos da OS %s foram finalizados por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
        v_notification_type := 'warning';
      elsif v_action = 'finish_cycle' then
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s foi finalizado manualmente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end
        );
        v_notification_type := 'warning';
      elsif v_action = 'revert_to_pending' then
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s foi revertido para pendente por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end
        );
        v_notification_type := 'warning';
      elsif v_action = 'revert_to_accept' then
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'O ciclo da OS %s voltou para aceite por %s%s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          case when v_cycle_label is not null then format(' (%s)', v_cycle_label) else '' end
        );
        v_notification_type := 'warning';
      elsif v_updates is not null then
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'A OS %s foi atualizada por %s. Status: %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema'),
          v_updates
        );
        v_notification_type := 'warning';
      else
        v_title := 'Status do atendimento atualizado';
        v_message := format(
          'A OS %s teve o status atualizado por %s.',
          coalesce(v_protocolo, NEW.os_id::text),
          coalesce(NEW.actor_name, 'Sistema')
        );
        v_notification_type := 'warning';
      end if;
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

  if v_attach_os_id then
    v_message := v_message || format(' [OS_ID:%s]', NEW.os_id);
  end if;

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
