-- Migration: adicionar políticas RLS para os_operational_cycles
-- Motivo: a tabela foi criada sem políticas RLS, causando problema onde
-- o endpoint (service_role) conseguia inserir mas o frontend (authenticated)
-- não conseguia ler os ciclos, resultando em reconstrução a partir dos
-- waypoints (sempre state='pending').

alter table public.os_operational_cycles enable row level security;

create policy "Allow select os_operational_cycles to authenticated"
  on public.os_operational_cycles for select
  to authenticated using (true);

create policy "Allow insert os_operational_cycles to authenticated"
  on public.os_operational_cycles for insert
  to authenticated with check (true);

create policy "Allow update os_operational_cycles to authenticated"
  on public.os_operational_cycles for update
  to authenticated using (true) with check (true);

create policy "Allow delete os_operational_cycles to authenticated"
  on public.os_operational_cycles for delete
  to authenticated using (true);
