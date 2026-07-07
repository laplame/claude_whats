/** Dígitos únicamente. */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formato canónico para móviles de México en WhatsApp:
 * 521 + 10 dígitos (ej. 5217131151168).
 */
export function normalizePhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (!digits) return phone;

  // 10 dígitos locales → asumir MX móvil
  if (digits.length === 10) {
    return `521${digits}`;
  }

  // 52 + 10 dígitos sin el 1 intermedio (527131151168 → 5217131151168)
  if (digits.startsWith("52") && digits.length === 12 && digits[2] !== "1") {
    return `521${digits.slice(2)}`;
  }

  return digits;
}

/** Variantes equivalentes para buscar en la base. */
export function phoneLookupVariants(phone: string): string[] {
  const canonical = normalizePhone(phone);
  const variants = new Set<string>([canonical, digitsOnly(phone)]);

  if (canonical.startsWith("521") && canonical.length === 13) {
    variants.add(`52${canonical.slice(3)}`);
  }
  if (canonical.startsWith("52") && canonical.length === 12 && canonical[2] !== "1") {
    variants.add(`521${canonical.slice(2)}`);
  }

  return [...variants].filter(Boolean);
}

export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}
