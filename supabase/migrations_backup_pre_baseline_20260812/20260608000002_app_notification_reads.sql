-- Tabela para rastrear leitura individual de notificações por usuário
-- Cada usuário tem seu próprio estado de lido/não lido para cada notificação

create table if not exists public.app_notification_reads (
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- Índice para buscar rapidamente todas as leituras de um usuário
CREATE INDEX IF NOT EXISTS idx_app_notification_reads_user_id
  ON public.app_notification_reads(user_id);

-- Índice para buscar rapidamente leituras de uma notificação específica
CREATE INDEX IF NOT EXISTS idx_app_notification_reads_notification_id
  ON public.app_notification_reads(notification_id);

-- Política RLS: usuários só podem ver suas próprias leituras
alter table public.app_notification_reads enable row level security;

create policy "Usuários veem apenas suas próprias leituras"
  on public.app_notification_reads
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Usuários podem inserir suas próprias leituras"
  on public.app_notification_reads
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Usuários podem deletar suas próprias leituras"
  on public.app_notification_reads
  for delete
  to authenticated
  using (user_id = auth.uid());

comment on table public.app_notification_reads is 'Rastreia o estado de leitura de cada notificação por usuário individual.';
comment on column public.app_notification_reads.notification_id is 'Referência à notificação lida.';
comment on column public.app_notification_reads.user_id is 'ID do usuário que leu a notificação.';
comment on column public.app_notification_reads.read_at is 'Timestamp em que o usuário marcou a notificação como lida.';
