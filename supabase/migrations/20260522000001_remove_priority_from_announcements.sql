-- Remover coluna priority da tabela system_announcements
ALTER TABLE public.system_announcements DROP COLUMN IF EXISTS priority;

-- Remover índice relacionado a priority se existir
DROP INDEX IF EXISTS idx_system_announcements_priority;
