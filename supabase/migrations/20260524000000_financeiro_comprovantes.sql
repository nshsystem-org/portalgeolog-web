-- Migration: anexos financeiros por OS e rastreio de faturamento/recebimento
-- Purpose: adicionar suporte a comprovantes e estados financeiros sem quebrar OS existentes

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS financeiro_faturado_em timestamptz,
  ADD COLUMN IF NOT EXISTS financeiro_recebido_em timestamptz;

CREATE TABLE IF NOT EXISTS public.os_financeiro_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  nome_arquivo text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL DEFAULT 0,
  tipo_documento text NOT NULL DEFAULT 'comprovante',
  observacao text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_financeiro_anexos_ordem_servico_created_at
  ON public.os_financeiro_anexos (ordem_servico_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_financeiro_dashboard
  ON public.ordens_servico (arquivado, status_financeiro, data, cliente_id, centro_custo_id, driver_id);

ALTER TABLE public.os_financeiro_anexos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'financeiro-comprovantes'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('financeiro-comprovantes', 'financeiro-comprovantes', false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'os_financeiro_anexos'
      AND policyname = 'Authenticated users can read os finance attachments'
  ) THEN
    CREATE POLICY "Authenticated users can read os finance attachments"
      ON public.os_financeiro_anexos
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'os_financeiro_anexos'
      AND policyname = 'Authenticated users can insert os finance attachments'
  ) THEN
    CREATE POLICY "Authenticated users can insert os finance attachments"
      ON public.os_financeiro_anexos
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
