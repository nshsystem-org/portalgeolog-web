create table public.os_logs (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.ordens_servico(id) on delete cascade,
  type text not null check (type in (
    'create','update','status_change','archive',
    'driver_accept','driver_start','driver_finish',
    'passenger_notify','passenger_confirm','comment'
  )),
  actor_name text not null default 'Sistema',
  actor_id uuid null,
  description text not null,
  metadata jsonb null default '{}',
  created_at timestamptz not null default now()
);

-- Índices
create index idx_os_logs_os_id on public.os_logs(os_id);
create index idx_os_logs_created_at on public.os_logs(created_at desc);

-- Políticas RLS
alter table public.os_logs enable row level security;

create policy "Allow select os_logs to authenticated"
  on public.os_logs for select
  to authenticated
  using (true);

create policy "Allow insert os_logs to authenticated"
  on public.os_logs for insert
  to authenticated
  with check (true);

-- Comentário
comment on table public.os_logs is 'Histórico de auditoria e logs de atendimento (OS)';
