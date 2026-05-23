-- Otimização de índices para tabelas de logs e presença
-- Esta migration adiciona índices para melhorar performance de queries
-- sem alterar a estrutura existente das tabelas

-- Índices para frontend_error_logs (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'frontend_error_logs'
  ) THEN
    -- Índice para ordenação por data (mais recente primeiro)
    CREATE INDEX IF NOT EXISTS idx_frontend_logs_created_at 
      ON public.frontend_error_logs(created_at DESC);
    
    -- Índice para filtro por usuário
    CREATE INDEX IF NOT EXISTS idx_frontend_logs_user_id 
      ON public.frontend_error_logs(user_id);
    
    -- Índice para filtro por nível de erro
    CREATE INDEX IF NOT EXISTS idx_frontend_logs_level 
      ON public.frontend_error_logs(error_level);
    
    -- Índice de texto completo para busca por componente (case-insensitive)
    CREATE INDEX IF NOT EXISTS idx_frontend_logs_component 
      ON public.frontend_error_logs USING gin(to_tsvector('portuguese', component));
    
    RAISE NOTICE 'Índices para frontend_error_logs criados com sucesso';
  ELSE
    RAISE NOTICE 'Tabela frontend_error_logs não encontrada, pulando criação de índices';
  END IF;
END $$;

-- Índices para webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at 
  ON public.webhook_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source 
  ON public.webhook_logs(source);

-- Índice GIN para busca eficiente em payload JSONB
CREATE INDEX IF NOT EXISTS idx_webhook_logs_payload 
  ON public.webhook_logs USING gin(payload jsonb_path_ops);

-- Índices para user_presence (melhora performance de queries de usuários online)
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen 
  ON public.user_presence(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_presence_status 
  ON public.user_presence(status);

-- Comentários explicativos
COMMENT ON INDEX idx_frontend_logs_created_at IS 'Índice para ordenação por data de criação (logs mais recentes)';
COMMENT ON INDEX idx_frontend_logs_user_id IS 'Índice para filtro rápido por usuário';
COMMENT ON INDEX idx_frontend_logs_level IS 'Índice para filtro por nível de erro';
COMMENT ON INDEX idx_frontend_logs_component IS 'Índice de texto completo para busca por componente';
COMMENT ON INDEX idx_webhook_logs_created_at IS 'Índice para ordenação por data de criação (logs mais recentes)';
COMMENT ON INDEX idx_webhook_logs_source IS 'Índice para filtro por fonte de webhook';
COMMENT ON INDEX idx_webhook_logs_payload IS 'Índice GIN para busca eficiente em payload JSONB';
COMMENT ON INDEX idx_user_presence_last_seen IS 'Índice para query de usuários online (filtro por last_seen_at)';
COMMENT ON INDEX idx_user_presence_status IS 'Índice para filtro rápido por status (online/offline)';