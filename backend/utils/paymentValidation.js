const MAX_AMOUNT_MINOR = 1_000_000; // N$10,000: a bounded prototype request, never a balance.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
function requireId(value, name = 'Identifier') {
  if (typeof value !== 'string' || !ID_PATTERN.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) {
    throw httpError(400, 'INVALID_IDENTIFIER', `${name} is invalid`);
  }
  return value;
}
function parseAmount(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'number' && !Number.isFinite(value))) {
    throw httpError(400, 'INVALID_AMOUNT', 'Enter a positive amount with at most two decimal places');
  }
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(text)) {
    throw httpError(400, 'INVALID_AMOUNT', 'Enter a positive amount with at most two decimal places');
  }
  const [whole, fraction = ''] = text.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return validateMinor(minor);
}
function validateMinor(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_AMOUNT_MINOR) {
    throw httpError(400, 'INVALID_AMOUNT', 'Amount must be between N$0.01 and N$10,000.00');
  }
  return value;
}
function amountFromBody(body) {
  const minor = body.amountMinor === undefined ? parseAmount(body.amount) : validateMinor(body.amountMinor);
  if (body.amount !== undefined && parseAmount(body.amount) !== minor) {
    throw httpError(400, 'AMOUNT_MISMATCH', 'Amount fields do not agree');
  }
  return minor;
}
function textField(value, name, limit, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
    throw httpError(400, 'INVALID_INPUT', `${name} is invalid`);
  }
  return value.trim();
}
function route(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}
module.exports = { MAX_AMOUNT_MINOR, requireId, parseAmount, validateMinor, amountFromBody, textField, httpError, route };
