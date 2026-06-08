export function formatDocument(
  value: string,
  pessoaTipo: "fisica" | "juridica",
): string {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, pessoaTipo === "juridica" ? 14 : 11);

  if (pessoaTipo === "juridica") {
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function validateCPF(cpf: string): boolean {
  const cpfClean = cpf.replace(/\D/g, "");
  if (cpfClean.length !== 11) return false;

  if (/^(\d)\1{10}$/.test(cpfClean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfClean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpfClean.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfClean.charAt(10))) return false;

  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  const cnpjClean = cnpj.replace(/\D/g, "");
  if (cnpjClean.length !== 14) return false;

  if (/^(\d)\1{13}$/.test(cnpjClean)) return false;

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpjClean.charAt(i)) * weightsFirst[i];
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(cnpjClean.charAt(12))) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpjClean.charAt(i)) * weightsSecond[i];
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(cnpjClean.charAt(13))) return false;

  return true;
}

export function validateCelular(celular: string): boolean {
  const celularClean = celular.replace(/\D/g, "");

  if (celularClean.length !== 11) return false;

  if (/^(\d)\1{10}$/.test(celularClean)) return false;

  const ddd = celularClean.substring(0, 2);
  if (ddd < "11" || ddd > "99") return false;

  return true;
}
