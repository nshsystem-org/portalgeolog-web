-- Corrige a função atômica de criação de OS para não depender da relação
-- public.config_imposto, que não existe no schema atual.
-- A função passa a resolver o percentual de imposto com fallback seguro:
-- 1) financial_config_history
-- 2) app_settings
-- 3) 12% como padrão

create or replace function public.get_imposto_percentual_for_date(
  p_date date
)
returns numeric
language plpgsql
stable
security definer
as $$
declare
  v_value text;
  v_percent numeric := 12;
begin
  if to_regclass('public.financial_config_history') is not null then
    select value
    into v_value
    from public.financial_config_history
    where config_key = 'imposto_percentual'
      and effective_from <= p_date
    order by effective_from desc
    limit 1;
  end if;

  if v_value is null and to_regclass('public.app_settings') is not null then
    select value
    into v_value
    from public.app_settings
    where key = 'imposto_percentual'
    limit 1;
  end if;

  if v_value is not null then
    v_percent := coalesce(nullif(trim(v_value), '')::numeric, 12);
  end if;

  if v_percent < 0 or v_percent > 100 then
    v_percent := 12;
  end if;

  return v_percent;
end;
$$;

create or replace function public.insert_os_atomic(
  p_os_data jsonb,
  p_waypoints jsonb default '[]'::jsonb,
  p_operational_cycles jsonb default '[]'::jsonb,
  p_actor_name text default 'Sistema',
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_os_id uuid;
  v_wp jsonb;
  v_passenger jsonb;
  v_cycle jsonb;
  v_wp_id uuid;
  v_position integer := 0;
  v_imposto_percentual numeric;
  v_v_bruto numeric;
  v_v_custo numeric;
  v_imposto numeric;
  v_lucro numeric;
begin
  -- 1. Calcular valores financeiros usando a fonte correta do percentual
  v_v_bruto := coalesce((p_os_data->>'valor_bruto')::numeric, 0);
  v_v_custo := coalesce((p_os_data->>'custo')::numeric, 0);
  v_imposto_percentual := public.get_imposto_percentual_for_date(
    coalesce(nullif(p_os_data->>'data', '')::date, current_date)
  );
  v_imposto := v_v_bruto * (v_imposto_percentual / 100);
  v_lucro := v_v_bruto - v_imposto - v_v_custo;

  -- 2. Inserir ordem de serviço
  insert into public.ordens_servico (
    protocolo,
    data,
    hora,
    hora_extra,
    os_number,
    cliente_id,
    solicitante,
    solicitante_id,
    centro_custo,
    centro_custo_id,
    motorista,
    driver_id,
    veiculo_id,
    valor_bruto,
    obs_financeiras,
    imposto,
    custo,
    lucro,
    status_operacional,
    status_financeiro,
    created_by,
    created_by_name
  ) values (
    '', -- trigger irá gerar
    (p_os_data->>'data')::date,
    nullif(p_os_data->>'hora', ''),
    coalesce(p_os_data->>'hora_extra', ''),
    coalesce(p_os_data->>'os_number', ''),
    nullif(p_os_data->>'cliente_id', '')::uuid,
    coalesce(p_os_data->>'solicitante', ''),
    nullif(p_os_data->>'solicitante_id', '')::uuid,
    coalesce(p_os_data->>'centro_custo', ''),
    nullif(p_os_data->>'centro_custo_id', '')::uuid,
    coalesce(p_os_data->>'motorista', ''),
    nullif(p_os_data->>'driver_id', '')::uuid,
    nullif(p_os_data->>'veiculo_id', '')::uuid,
    v_v_bruto,
    coalesce(p_os_data->>'obs_financeiras', ''),
    v_imposto,
    v_v_custo,
    v_lucro,
    'Pendente',
    'Pendente',
    p_actor_id,
    p_actor_name
  )
  returning id into v_os_id;

  -- 3. Inserir ciclos operacionais
  if p_operational_cycles is not null and jsonb_typeof(p_operational_cycles) = 'array' then
    for v_cycle in select * from jsonb_array_elements(p_operational_cycles)
    loop
      insert into public.os_operational_cycles (
        ordem_servico_id,
        itinerary_index,
        sequence_order,
        kind,
        ordinal,
        title,
        state,
        message_sent_at,
        accepted_at,
        started_at,
        finished_at,
        km_initial,
        km_final
      ) values (
        v_os_id,
        coalesce((v_cycle->>'itineraryIndex')::integer, 0),
        coalesce((v_cycle->>'sequenceOrder')::integer, 0),
        coalesce(v_cycle->>'kind', 'itinerary'),
        coalesce((v_cycle->>'ordinal')::integer, 1),
        coalesce(nullif(v_cycle->>'title', ''), ''),
        coalesce(v_cycle->>'state', 'pending'),
        nullif(v_cycle->>'messageSentAt', '')::timestamptz,
        nullif(v_cycle->>'acceptedAt', '')::timestamptz,
        nullif(v_cycle->>'startedAt', '')::timestamptz,
        nullif(v_cycle->>'finishedAt', '')::timestamptz,
        nullif(v_cycle->>'kmInitial', '')::integer,
        nullif(v_cycle->>'kmFinal', '')::integer
      );
    end loop;
  end if;

  -- 4. Inserir waypoints, passageiros e comentários
  if p_waypoints is not null and jsonb_typeof(p_waypoints) = 'array' then
    for v_wp in select * from jsonb_array_elements(p_waypoints)
    loop
      insert into public.os_waypoints (
        ordem_servico_id,
        position,
        label,
        lat,
        lng,
        comment,
        itinerary_index,
        hora,
        data
      ) values (
        v_os_id,
        v_position,
        coalesce(v_wp->>'label', ''),
        nullif(v_wp->>'lat', '')::double precision,
        nullif(v_wp->>'lng', '')::double precision,
        coalesce(v_wp->>'comment', ''),
        nullif(v_wp->>'itinerary_index', '')::integer,
        nullif(v_wp->>'hora', '')::time,
        nullif(v_wp->>'data', '')::date
      )
      returning id into v_wp_id;

      if jsonb_array_length(coalesce(v_wp->'passengers', '[]'::jsonb)) > 0 then
        for v_passenger in select * from jsonb_array_elements(coalesce(v_wp->'passengers', '[]'::jsonb))
        loop
          insert into public.os_waypoint_passengers (
            waypoint_id,
            passageiro_id
          ) values (
            v_wp_id,
            nullif(v_passenger->>'solicitante_id', '')::uuid
          );
        end loop;
      end if;

      if coalesce(v_wp->>'comment', '') <> '' then
        insert into public.os_waypoint_comments (
          ordem_servico_id,
          waypoint_position,
          waypoint_label,
          comment
        ) values (
          v_os_id,
          v_position,
          coalesce(v_wp->>'label', ''),
          v_wp->>'comment'
        );
      end if;

      v_position := v_position + 1;
    end loop;
  end if;

  -- 5. Inserir log de criação
  insert into public.os_logs (
    os_id,
    type,
    description,
    actor_name,
    actor_id,
    metadata
  ) values (
    v_os_id,
    'create',
    'Dados de cadastro do atendimento',
    p_actor_name,
    p_actor_id,
    '{}'::jsonb
  );

  return v_os_id;
end;
$$;

grant execute on function public.get_imposto_percentual_for_date(date) to authenticated;
grant execute on function public.get_imposto_percentual_for_date(date) to service_role;
grant execute on function public.insert_os_atomic(jsonb, jsonb, jsonb, text, uuid) to authenticated;
grant execute on function public.insert_os_atomic(jsonb, jsonb, jsonb, text, uuid) to service_role;
