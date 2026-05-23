-- Adicionar coluna subtitle à tabela system_announcements
ALTER TABLE public.system_announcements ADD COLUMN IF NOT EXISTS subtitle TEXT;
