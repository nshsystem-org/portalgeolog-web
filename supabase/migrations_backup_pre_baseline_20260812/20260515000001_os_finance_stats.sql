-- Migration: RPC para estatísticas financeiras de OS por mês
-- Purpose: Evitar carregar todas as OS no cliente para calcular totais financeiros

CREATE OR REPLACE FUNCTION get_os_finance_stats(p_month text)
RETURNS TABLE(
  total_os     bigint,
  total_bruto  numeric,
  total_custo  numeric,
  total_imposto numeric,
  total_lucro  numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(valor_bruto), 0)::numeric,
    COALESCE(SUM(custo), 0)::numeric,
    COALESCE(SUM(imposto), 0)::numeric,
    COALESCE(SUM(lucro), 0)::numeric
  FROM ordens_servico
  WHERE arquivado = false
    AND data LIKE (p_month || '%');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
