-- =============================================================================
-- Migration: driver_logs
-- Data: 2026-08-15
-- =============================================================================
-- Cria a tabela public.driver_logs para auditoria de operações sobre motoristas:
--   - criação (create)
--   - edição de dados (update)
--   - vinculação de veículo (vehicle_link)
--   - desvinculação de veículo (vehicle_unlink)
--   - arquivamento (archive)
--   - restauração (restore)
--   - atualização de avatar (avatar_update)
--
-- O ator (actor_id / actor_name / actor_avatar_url) é informado pelo frontend
-- a partir do perfil autenticado (user_roles). A tabela segue o mesmo padrão
-- visual e de RLS de public.os_logs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.driver_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  type             text NOT NULL,
  actor_name       text NOT NULL DEFAULT 'Sistema'::text,
  actor_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_avatar_url text,
  description      text NOT NULL,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Tipos de evento permitidos
ALTER TABLE public.driver_logs
  DROP CONSTRAINT IF EXISTS driver_logs_type_check;
ALTER TABLE public.driver_logs
  ADD CONSTRAINT driver_logs_type_check CHECK (
    type IN (
      'create',
      'update',
      'vehicle_link',
      'vehicle_unlink',
      'archive',
      'restore',
      'avatar_update'
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_driver_logs_driver_id
  ON public.driver_logs (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_logs_created_at
  ON public.driver_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_logs_actor_id
  ON public.driver_logs (actor_id) WHERE actor_id IS NOT NULL;

-- RLS
ALTER TABLE public.driver_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select driver_logs to authenticated" ON public.driver_logs;
CREATE POLICY "Allow select driver_logs to authenticated"
  ON public.driver_logs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert driver_logs to authenticated" ON public.driver_logs;
CREATE POLICY "Allow insert driver_logs to authenticated"
  ON public.driver_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Realtime: habilita a tabela para que o frontend receba inserts ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_logs;
