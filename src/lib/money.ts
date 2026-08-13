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

  // Input vazio deve resultar em string vazia, senão o campo nunca limpa
  // e fica preso com um "0" persistente.
  if (digits === "") return "";

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
  // Usa "!== undefined" (não truthy) para não perder a vírgula quando o
  // usuário acabou de digitá-la e ainda não há dígitos decimais (decPartRaw
  // seria "", que é falsy, mas ainda representa uma vírgula presente).
  const decPart = decPartRaw !== undefined ? decPartRaw.slice(0, 2) : undefined;

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

/**
 * Calcula a nova posição do cursor após a máscara reformatar o valor.
 *
 * O problema: quando a máscara insere/remove separadores de milhar (pontos),
 * a posição bruta do cursor não corresponde mais ao mesmo dígito. Sem
 * correção, o navegador mantém o cursor no offset original, que agora cai
 * no meio do número — fazendo o próximo caractere ser inserido no lugar
 * errado (ex: digitar "5584" vira "5.584", cursor fica em "5.58|4", e
 * digitar "," produz "5.58,4" em vez de "5.584,").
 *
 * Estratégia:
 * - Se o cursor está depois da vírgula (parte decimal), preserva o offset
 *   relativo à vírgula — a parte decimal não é reformatada.
 * - Se o cursor está na parte inteira, conta quantos dígitos existem antes
 *   do cursor no valor bruto e posiciona o cursor após o mesmo número de
 *   dígitos no valor mascarado.
 */
export function calculateMoneyCursorPos(
  rawValue: string,
  rawCursor: number,
  maskedValue: string,
): number {
  const rawCommaPos = rawValue.indexOf(",");
  const maskedCommaPos = maskedValue.indexOf(",");

  // Cursor na parte decimal (depois da vírgula)
  if (rawCommaPos !== -1 && rawCursor > rawCommaPos) {
    if (maskedCommaPos === -1) return maskedValue.length;
    const offsetFromComma = rawCursor - rawCommaPos;
    // Limita ao final do mascarado
    return Math.min(maskedCommaPos + offsetFromComma, maskedValue.length);
  }

  // Cursor na parte inteira: conta dígitos antes do cursor no valor bruto
  const digitsBefore = rawValue
    .slice(0, rawCursor)
    .replace(/[^\d]/g, "").length;

  if (digitsBefore === 0) return 0;

  // Encontra a posição após o enésimo dígito no valor mascarado
  let digitsSeen = 0;
  for (let i = 0; i < maskedValue.length; i++) {
    if (/\d/.test(maskedValue[i])) {
      digitsSeen++;
      if (digitsSeen === digitsBefore) {
        return i + 1;
      }
    }
  }
  // Se não houver dígitos suficientes (ex: zeros à esquerda removidos),
  // posiciona após o último dígito ou no final
  if (digitsSeen < digitsBefore) {
    // acha o último dígito
    for (let i = maskedValue.length - 1; i >= 0; i--) {
      if (/\d/.test(maskedValue[i])) return i + 1;
    }
  }
  return maskedValue.length;
}
