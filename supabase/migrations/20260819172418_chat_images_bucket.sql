-- Migration: bucket público para imagens do chat
-- Purpose: permitir envio de imagens nas conversas do chat (anexo / colar)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'chat-images'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'chat-images',
      'chat-images',
      true,
      5242880, -- 5 MB
      ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
    );
  END IF;
END $$;

-- Políticas de storage: usuários autenticados podem subir e ler imagens do chat.
-- O bucket é público, então leitura por URL funciona sem auth, mas mantemos a
-- policy de SELECT para clientes autenticados (Supabase JS respeita RLS no upload).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload chat images'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'chat-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can read chat images'
  ) THEN
    CREATE POLICY "Authenticated users can read chat images"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'chat-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete own chat images'
  ) THEN
    CREATE POLICY "Authenticated users can delete own chat images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'chat-images'
        AND owner = auth.uid()
      );
  END IF;
END $$;
