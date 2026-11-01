const crypto = require('crypto');
const { requireId, httpError } = require('../utils/paymentValidation');

function secureQrData(request, config) {
  const payload = { version: 2, type: 'payment_request', token: request.id, expiresAt: request.expiresAt };
  const signature = crypto.createHmac('sha256', (config.qrSecret || config.jwtSecret)).update(JSON.stringify(payload)).digest('hex');
  return { ...payload, signature };
}
function validateQrData(value, config) {
  if (typeof value !== 'string' || value.length > 2048) throw httpError(400, 'INVALID_QR', 'This is not a valid NamPay payment QR code');
  let data;
  try { data = JSON.parse(value); } catch { throw httpError(400, 'INVALID_QR', 'This is not a valid NamPay payment QR code'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'INVALID_QR', 'This is not a valid NamPay payment QR code');
  // Legacy signed envelopes remain accepted for their original short expiry;
  // their current server record still supplies amount, recipient and status.
  const legacy = data.version === undefined;
  const keys = legacy ? ['type', 'token', 'expiresAt', 'signature'] : ['version', 'type', 'token', 'expiresAt', 'signature'];
  if (Object.keys(data).length !== keys.length || Object.keys(data).some(key => !keys.includes(key))
    || (!legacy && data.version !== 2) || data.type !== 'payment_request'
    || typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt))
    || new Date(data.expiresAt).toISOString() !== data.expiresAt
    || typeof data.signature !== 'string' || !/^[a-f0-9]{64}$/.test(data.signature)) {
    throw httpError(400, 'INVALID_QR', 'This is not a valid NamPay payment QR code');
  }
  requireId(data.token, 'Request ID');
  const payload = legacy ? { type: data.type, token: data.token, expiresAt: data.expiresAt }
    : { version: 2, type: data.type, token: data.token, expiresAt: data.expiresAt };
  const expected = crypto.createHmac('sha256', legacy ? config.jwtSecret : (config.qrSecret || config.jwtSecret)).update(JSON.stringify(payload)).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(data.signature, 'hex'))) {
    throw httpError(400, 'INVALID_QR_SIGNATURE', 'The QR code could not be verified');
  }
  return payload;
}
module.exports = { secureQrData, validateQrData };
