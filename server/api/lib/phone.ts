import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export function validInternationalPhone(phone: unknown): phone is string {
  if (typeof phone !== 'string' || !phone.startsWith('+')) return false;
  const parsed = parsePhoneNumberFromString(phone);
  return Boolean(parsed && parsed.isValid() && parsed.number === phone);
}
