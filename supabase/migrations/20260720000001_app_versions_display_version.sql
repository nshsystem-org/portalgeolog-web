-- Adiciona coluna display_version (ex: "v1.0.4") para exibição amigável no sidebar.
-- A coluna `version` continua guardando o stamp interno (hash+timestamp).
ALTER TABLE public.app_versions
  ADD COLUMN IF NOT EXISTS display_version TEXT;

-- Backfill da versão inicial caso já existam linhas sem display_version.
UPDATE public.app_versions
SET display_version = 'v0.1.0'
WHERE display_version IS NULL;

-- Garante que toda nova linha tenha um display_version visível ao frontend.
ALTER TABLE public.app_versions
  ALTER COLUMN display_version SET NOT NULL;

COMMENT ON COLUMN public.app_versions.display_version
  IS 'Versão amigável exibida no frontend (ex: "v1.0.4"). Auto-incrementada pelo script publish-app-version.mjs.';
