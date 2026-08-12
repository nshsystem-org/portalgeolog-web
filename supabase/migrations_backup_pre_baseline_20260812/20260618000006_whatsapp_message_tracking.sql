-- Migration: whatsapp_message_tracking
-- Objetivo: Rastrear message_ids do WhatsApp para correlacionar com status updates
delivery/read da Meta e gerar notificações no sino.

CREATE TABLE IF NOT EXISTS public.whatsapp_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  motorista TEXT NOT NULL,
  cycle_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_wmt_message_id ON public.whatsapp_message_tracking(message_id);
CREATE INDEX IF NOT EXISTS idx_wmt_os_id ON public.whatsapp_message_tracking(os_id);
CREATE INDEX IF NOT EXISTS idx_wmt_status ON public.whatsapp_message_tracking(status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_wmt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wmt_updated_at ON public.whatsapp_message_tracking;
CREATE TRIGGER trigger_update_wmt_updated_at
  BEFORE UPDATE ON public.whatsapp_message_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_wmt_updated_at();

-- RLS
ALTER TABLE public.whatsapp_message_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_message_tracking"
  ON public.whatsapp_message_tracking
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
