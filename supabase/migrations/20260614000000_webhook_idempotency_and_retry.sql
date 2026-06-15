-- Migration: Webhook Idempotency and Retry Queue
-- Objetivo: Garantir processamento único de flows e retry automático de mensagens

-- ============================================================================
-- 1. Tabela de Idempotência de Flow Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_flow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id TEXT NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('start', 'finish')),
  os_id UUID REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  cycle_index INTEGER NOT NULL,
  km_value NUMERIC(10, 2),
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Índice único para garantir idempotência
  CONSTRAINT webhook_flow_events_unique_context UNIQUE (context_id, flow_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_webhook_flow_events_os_id ON public.webhook_flow_events(os_id);
CREATE INDEX IF NOT EXISTS idx_webhook_flow_events_created_at ON public.webhook_flow_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_flow_events_context_id ON public.webhook_flow_events(context_id);

-- RLS: Apenas service role pode acessar
ALTER TABLE public.webhook_flow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on webhook_flow_events"
  ON public.webhook_flow_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. Tabela de Retry Queue para Mensagens WhatsApp
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pending_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  template_name TEXT,
  template_components JSONB,
  message_text TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('template', 'text')),
  os_id UUID REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pending_whatsapp_status ON public.pending_whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_pending_whatsapp_next_retry ON public.pending_whatsapp_messages(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_whatsapp_os_id ON public.pending_whatsapp_messages(os_id);

-- RLS: Apenas service role pode acessar
ALTER TABLE public.pending_whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pending_whatsapp_messages"
  ON public.pending_whatsapp_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_pending_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pending_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.pending_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_whatsapp_messages_updated_at();

-- ============================================================================
-- 3. Tabela de Métricas de Webhook (Observabilidade)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  phone TEXT,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para análise
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_event_type ON public.webhook_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_created_at ON public.webhook_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_metrics_success ON public.webhook_metrics(success);

-- RLS: Apenas service role pode acessar
ALTER TABLE public.webhook_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on webhook_metrics"
  ON public.webhook_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. Tabela de Rate Limiting
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Índice único para garantir uma janela por telefone/tipo
  CONSTRAINT webhook_rate_limits_unique_window UNIQUE (phone, event_type, window_start)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_phone ON public.webhook_rate_limits(phone);
CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_window_start ON public.webhook_rate_limits(window_start);

-- RLS: Apenas service role pode acessar
ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on webhook_rate_limits"
  ON public.webhook_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Limpeza automática de registros antigos (> 1 hora)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.webhook_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.webhook_flow_events IS 'Garante idempotência de processamento de flows do motorista';
COMMENT ON TABLE public.pending_whatsapp_messages IS 'Fila de retry para mensagens WhatsApp que falharam';
COMMENT ON TABLE public.webhook_metrics IS 'Métricas de performance e erros do webhook';
COMMENT ON TABLE public.webhook_rate_limits IS 'Rate limiting por telefone para evitar spam';
