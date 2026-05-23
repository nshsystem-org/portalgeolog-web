-- Migration: Conceder permissões para função update_parceiro_atomic
-- Description: Grant execute permissions para authenticated e service_role

GRANT EXECUTE ON FUNCTION update_parceiro_atomic(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated, service_role;
