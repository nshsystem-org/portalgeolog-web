-- Adicionar campo de permissões específicas à tabela user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS specific_permissions JSONB DEFAULT '{}'::jsonb;

-- Criar índice para melhor performance em queries de permissões
CREATE INDEX IF NOT EXISTS idx_user_roles_specific_permissions 
ON public.user_roles USING GIN (specific_permissions);

-- Adicionar comentário
COMMENT ON COLUMN public.user_roles.specific_permissions IS 'Permissões específicas granulares por módulo (financeiro, os, clientes, motoristas, veículos)';
