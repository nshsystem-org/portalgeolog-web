-- Migration: adicionar message_sent_by_id nos ciclos operacionais
-- Objetivo: rastrear quem enviou a ultima mensagem ao motorista, evitando reenvios duplicados sem confirmacao.

alter table public.os_operational_cycles
add column if not exists message_sent_by_id uuid null references public.user_roles(id) on delete set null;

-- Atualizar o RPC replace_os_operational_cycles para incluir message_sent_by_id
create or replace function public.replace_os_operational_cycles(
  p_os_id uuid,
  p_cycles jsonb
)
returns void
language plpgsql
security definer
as $$
declare
  v_cycle jsonb;
begin
  delete from public.os_operational_cycles
  where ordem_servico_id = p_os_id;

  if p_cycles is null or jsonb_typeof(p_cycles) <> 'array' or jsonb_array_length(p_cycles) = 0 then
    return;
  end if;

  for v_cycle in select * from jsonb_array_elements(p_cycles)
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
      message_sent_by_id,
      accepted_at,
      started_at,
      finished_at,
      km_initial,
      km_final
    ) values (
      p_os_id,
      coalesce((v_cycle->>'itineraryIndex')::integer, 0),
      coalesce((v_cycle->>'sequenceOrder')::integer, 0),
      coalesce(v_cycle->>'kind', 'itinerary'),
      coalesce((v_cycle->>'ordinal')::integer, 1),
      coalesce(nullif(v_cycle->>'title', ''), ''),
      coalesce(v_cycle->>'state', 'pending'),
      nullif(v_cycle->>'messageSentAt', '')::timestamptz,
      nullif(v_cycle->>'messageSentById', '')::uuid,
      nullif(v_cycle->>'acceptedAt', '')::timestamptz,
      nullif(v_cycle->>'startedAt', '')::timestamptz,
      nullif(v_cycle->>'finishedAt', '')::timestamptz,
      nullif(v_cycle->>'kmInitial', '')::integer,
      nullif(v_cycle->>'kmFinal', '')::integer
    );
  end loop;
end;
$$;

grant execute on function public.replace_os_operational_cycles(uuid, jsonb) to authenticated;
grant execute on function public.replace_os_operational_cycles(uuid, jsonb) to service_role;
