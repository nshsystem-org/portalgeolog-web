// =============================================================================
// Utilitários de moeda pt-BR — funções puras para parsing e formatação
// =============================================================================

/**
 * Converte uma string digitada pelo usuário (formato pt-BR) em número.
 * Aceita: "720", "720,50", "1.234,56", "1234.56", "R$ 1.234,56", "  0,01  "
 * Retorna null se não for um valor numérico válido.
 */
export function parseMoneyInput(input: string): number | null {
  if (!input) return null;
  // Remove espaços, "R$", e caracteres não numéricos exceto , e .
  let cleaned = input.trim().replace(/[R$\s]/g, "");

  // Se tem tanto vírgula quanto ponto, assume pt-BR: ponto = milhar, vírgula = decimal
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Remove os pontos (separadores de milhar) e troca vírgula por ponto decimal
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // Só vírgula: assume decimal pt-BR
    cleaned = cleaned.replace(",", ".");
  }
  // else: só pontos ou nenhum separador — já está em formato numérico

  const value = parseFloat(cleaned);
  if (Number.isNaN(value) || value < 0) return null;
  return value;
}

/**
 * Formata um número como string de exibição pt-BR para o input de moeda.
 * Ex: 1234.5 -> "1.234,50", 0 -> "0,00"
 */
export function formatMoneyDisplay(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Máscara de digitação pt-BR: aplica separadores de milhar e vírgula decimal
 * conforme o usuário digita. Só permite dígitos, mantendo no máximo 2 casas decimais.
 * Ex: "1234" -> "1.234", "1234,5" -> "1.234,5", "1234,56" -> "1.234,56"
 */
export function maskMoneyInput(input: string): string {
  // Remove tudo que não é dígito ou vírgula
  let digits = input.replace(/[^\d,]/g, "");

  // Se houver mais de uma vírgula, mantém só a primeira
  const firstComma = digits.indexOf(",");
  if (firstComma !== -1) {
    digits =
      digits.slice(0, firstComma + 1) +
      digits.slice(firstComma + 1).replace(/,/g, "");
  }

  // Split em parte inteira e decimal
  const [intPartRaw, decPartRaw] = digits.split(",");

  // Limita decimais a 2 casas
  const decPart = decPartRaw ? decPartRaw.slice(0, 2) : undefined;

  // Formata parte inteira com separadores de milhar
  let intPart = intPartRaw || "";
  // Remove zeros à esquerda (mas mantém pelo menos "0")
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";

  // Aplica pontos a cada 3 dígitos da direita para esquerda
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decPart !== undefined) {
    return `${intPart},${decPart}`;
  }
  return intPart;
}
