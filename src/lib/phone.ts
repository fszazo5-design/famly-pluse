import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export interface PhoneValidation {
  valid: boolean;
  e164: string;
  error?: string;
}

function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

export function normalizePhoneInput(value: string): string {
  const western = toWesternDigits(value.trim());
  const withPlus = western.startsWith('00') ? `+${western.slice(2)}` : western;
  return withPlus.replace(/[\s().-]/g, '');
}

export function validateInternationalPhone(value: string): PhoneValidation {
  const normalized = normalizePhoneInput(value);
  if (!normalized.startsWith('+')) {
    return { valid: false, e164: normalized, error: 'اكتب الرقم مع رمز الدولة مثل +966 أو +20.' };
  }

  const parsed = parsePhoneNumberFromString(normalized);
  if (!parsed || !parsed.isValid()) {
    return { valid: false, e164: normalized, error: 'رقم الهاتف غير صحيح لهذا البلد. راجع رمز الدولة وطول الرقم.' };
  }

  return { valid: true, e164: parsed.number };
}
