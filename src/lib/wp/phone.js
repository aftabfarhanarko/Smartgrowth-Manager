export function normalizePhoneDigits(phone, defaultCountryCode = process.env.WA_DEFAULT_COUNTRY_CODE || "880") {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (!digits) return "";

  if (!defaultCountryCode) return digits;

  // Handle international prefix: 00<countrycode>...
  if (digits.startsWith(`00${defaultCountryCode}`)) {
    return digits.slice(2);
  }

  // Already has country code.
  if (digits.startsWith(defaultCountryCode)) {
    return digits;
  }

  // Local BD format: 0XXXXXXXX -> 880XXXXXXXX
  if (digits.startsWith("0")) {
    return `${defaultCountryCode}${digits.slice(1)}`;
  }

  // Fallback: assume it's missing country code.
  return `${defaultCountryCode}${digits}`;
}

