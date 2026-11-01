export const normalizeEmail = value => String(value || '').trim().toLowerCase();
export function emailError(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address.';
}
export function nameError(value, label) {
  const name = typeof value === 'string' ? value.trim() : '';
  return name.length >= 1 && name.length <= 60 && !/[\u0000-\u001f<>]/.test(name) ? '' : `Enter your ${label}.`;
}
export function passwordError(value) {
  if (typeof value !== 'string' || value.length < 12) return 'Use at least 12 characters.';
  const bytes = Array.from(value).reduce((length, character) => {
    const point = character.codePointAt(0);
    return length + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
  }, 0);
  return bytes <= 72 ? '' : 'Use a shorter passphrase (at most 72 UTF-8 bytes).';
}
export function phoneError(value) {
  if (!value || !value.trim()) return '';
  let phone = value.replace(/[ ()-]/g, '');
  if (/^0\d{8,9}$/.test(phone)) phone = `+264${phone.slice(1)}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? '' : 'Use a valid international or Namibian phone number.';
}
export function errorMessage(error, fallback) {
  const message = error?.response?.data?.error || error?.message;
  return typeof message === 'string' && message ? message : fallback;
}
