-- Migration: habilitar Realtime para tabelas de ordens de servico
-- Motivo: a tabela ordens_servico nunca foi adicionada a publicacao
-- supabase_realtime, entao o frontend nao recebia eventos de mudanca
-- em tempo real (atualizacao de status, conclusao, etc).

alter publication supabase_realtime add table public.ordens_servico;
alter publication supabase_realtime add table public.os_waypoints;
alter publication supabase_realtime add table public.os_operational_cycles;
