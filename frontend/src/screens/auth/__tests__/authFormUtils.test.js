import { emailError, nameError, normalizeEmail, passwordError, phoneError } from '../authFormUtils';

test('email normalization retains addressing and rejects missing domain or whitespace', () => {
  expect(normalizeEmail(' Demo+test@EXAMPLE.COM ')).toBe('demo+test@example.com');
  expect(emailError(' Demo+test@EXAMPLE.COM ')).toBe('');
  expect(emailError('demo@example')).toBeTruthy();
  expect(emailError('demo @example.com')).toBeTruthy();
});

test('names accept meaningful Unicode but reject empty, excessive and control input', () => {
  expect(nameError(' Élise ', 'first name')).toBe('');
  expect(nameError(' ', 'first name')).toBeTruthy();
  expect(nameError('a'.repeat(61), 'first name')).toBeTruthy();
  expect(nameError('Demo\nUser', 'first name')).toBeTruthy();
  expect(nameError('<Demo>', 'first name')).toBeTruthy();
});

test('password limits match the backend minimum and bcrypt UTF-8 byte limit', () => {
  expect(passwordError('a'.repeat(11))).toBeTruthy();
  expect(passwordError('a'.repeat(12))).toBe('');
  expect(passwordError('a'.repeat(72))).toBe('');
  expect(passwordError('a'.repeat(73))).toBeTruthy();
  expect(passwordError('é'.repeat(36))).toBe('');
  expect(passwordError('é'.repeat(37))).toBeTruthy();
  expect(passwordError('🌱'.repeat(18))).toBe('');
  expect(passwordError('🌱'.repeat(19))).toBeTruthy();
});

test('optional phone accepts Namibian and international formatting without implying verification', () => {
  expect(phoneError('')).toBe('');
  expect(phoneError('081 234 5678')).toBe('');
  expect(phoneError('+264 81 234 5678')).toBe('');
  expect(phoneError('123')).toBeTruthy();
  expect(phoneError('call-me')).toBeTruthy();
});
