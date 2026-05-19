export const BRAZIL_COUNTRY_CODE = "55";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function stripBrazilCountryCode(phone: string): string {
  const digits = onlyDigits(phone);

  if (!digits) return "";

  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11) {
    return digits.slice(BRAZIL_COUNTRY_CODE.length);
  }

  return digits;
}

export function normalizeBrazilPhone(phone: string): string {
  const digits = onlyDigits(phone);

  if (!digits) return "";
  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11) return digits;

  const localDigits = stripBrazilCountryCode(phone);
  if (localDigits.length <= 11) {
    return `${BRAZIL_COUNTRY_CODE}${localDigits}`;
  }

  return digits;
}

export function formatBrazilPhone(phone: string): string {
  const localDigits = stripBrazilCountryCode(phone);

  if (!localDigits) return "";
  if (localDigits.length <= 2) return localDigits;

  if (localDigits.length <= 6) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
  }

  if (localDigits.length <= 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }

  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  }

  return localDigits;
}
