-- Migration: tabela normalizada para ciclos operacionais da OS
-- Objetivo: mover o estado operacional de cada ciclo para uma tabela própria.

create table if not exists public.os_operational_cycles (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid not null references public.ordens_servico(id) on delete cascade,
  itinerary_index integer not null,
  sequence_order integer not null,
  kind text not null check (kind in ('itinerary', 'return')),
  ordinal integer not null,
  title text not null,
  state text not null check (
    state in (
      'pending',
      'awaiting_accept',
      'awaiting_start',
      'awaiting_km_start',
      'awaiting_finish',
      'awaiting_km_finish',
      'completed',
      'cancelled'
    )
  ),
  message_sent_at timestamptz null,
  accepted_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  km_initial integer null,
  km_final integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_os_operational_cycles_os_itinerary_index
  on public.os_operational_cycles (ordem_servico_id, itinerary_index);

create index if not exists idx_os_operational_cycles_os_sequence_order
  on public.os_operational_cycles (ordem_servico_id, sequence_order);

create index if not exists idx_os_operational_cycles_os_state
  on public.os_operational_cycles (ordem_servico_id, state);

comment on table public.os_operational_cycles is 'Tabela normalizada dos ciclos operacionais da OS (itinerário/retorno), com estado, timestamps e quilometragem.';
comment on column public.os_operational_cycles.ordem_servico_id is 'OS pai do ciclo operacional.';
comment on column public.os_operational_cycles.itinerary_index is 'Índice do itinerário/retorno usado pela rota.';
comment on column public.os_operational_cycles.sequence_order is 'Ordem sequencial do ciclo dentro da OS.';

create or replace function public.set_os_operational_cycles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_os_operational_cycles_updated_at_trigger on public.os_operational_cycles;
create trigger set_os_operational_cycles_updated_at_trigger
before update on public.os_operational_cycles
for each row execute function public.set_os_operational_cycles_updated_at();

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
