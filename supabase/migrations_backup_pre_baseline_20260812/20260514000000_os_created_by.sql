alter table public.ordens_servico
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists created_by_name text;

create index if not exists idx_ordens_servico_created_by
  on public.ordens_servico(created_by)
  where created_by is not null;

-- Backfill best-effort from existing creation logs when available
with first_create_logs as (
  select distinct on (os_id)
    os_id,
    actor_id,
    actor_name
  from public.os_logs
  where type = 'create'
  order by os_id, created_at asc
)
update public.ordens_servico o
set created_by = coalesce(o.created_by, fcl.actor_id),
    created_by_name = coalesce(o.created_by_name, fcl.actor_name)
from first_create_logs fcl
where fcl.os_id = o.id;

comment on column public.ordens_servico.created_by is 'ID do usuário que criou a OS, quando disponível.';
comment on column public.ordens_servico.created_by_name is 'Nome do usuário que criou a OS, quando disponível.';
