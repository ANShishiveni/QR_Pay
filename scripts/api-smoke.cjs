const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

// This script deliberately refuses an external endpoint or non-demo database.
const origin = process.env.NAMPAY_SMOKE_API || 'http://127.0.0.1:3000';
const outbox = process.env.OTP_OUTBOX_DIR || path.resolve(__dirname, '../.local/outbox');
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use a local disposable API');
async function api(method, route, body, token, expected = 200) {
  const response = await fetch(`${origin}/api/${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${data.code || response.status}`);
  return data;
}
(async () => {
  const health = await api('GET', 'health');
  assert.equal(health.simulated, true);
  assert.equal(health.environment, 'development');
  assert.equal(health.database, 'memory', 'This smoke fixture may only mutate disposable memory state');
  const run = crypto.randomUUID();
  const password = crypto.randomBytes(24).toString('base64url');
  const recipient = await api('POST', 'auth/register', { firstName: 'Demo', lastName: 'Recipient', email: `recipient-${run}@example.test`, password }, null, 201);
  const payer = await api('POST', 'auth/register', { firstName: 'Demo', lastName: 'Payer', email: `payer-${run}@example.test`, password }, null, 201);
  const card = await api('POST', 'payments/link-card', { testCardId: 'demo-visa' }, payer.token, 201);
  const generated = await api('POST', 'qr/generate', { amount: '12.34', reference: 'Synthetic smoke request' }, recipient.token, 201);
  const scan = await api('POST', 'qr/scan', { qrData: generated.qrData }, payer.token);
  assert.equal(scan.paymentRequest.amountMinor, 1234);
  const challenge = await api('POST', 'otp/send', { requestId: generated.paymentRequest.id }, payer.token);
  const delivery = JSON.parse(await fs.readFile(path.join(outbox, `otp-${challenge.sessionId}.json`), 'utf8'));
  assert.equal(delivery.simulated, true);
  await api('POST', 'otp/verify', { sessionId: challenge.sessionId, otp: delivery.code }, payer.token);
  const operation = { requestId: generated.paymentRequest.id, cardId: card.card.id, sessionId: challenge.sessionId, idempotencyKey: crypto.randomUUID() };
  const result = await api('POST', 'qr/confirm-payment', operation, payer.token);
  const retry = await api('POST', 'qr/confirm-payment', operation, payer.token);
  assert.equal(result.transaction.id, retry.transaction.id);
  assert.equal(retry.idempotent, true);
  assert.equal(result.transaction.simulated, true);
  for (const [token, role] of [[payer.token, 'sent'], [recipient.token, 'received']]) {
    const history = await api('GET', 'users/transactions', null, token);
    assert.equal(history.transactions.length, 1);
    assert.equal(history.transactions[0].id, result.transaction.id);
    assert.equal(history.transactions[0].amountMinor, 1234);
    assert.equal(history.transactions[0].role, role);
  }
  await api('POST', 'qr/confirm-payment', { ...operation, idempotencyKey: crypto.randomUUID() }, payer.token, 409);
  await api('POST', 'auth/logout', {}, payer.token);
  await api('GET', 'auth/verify', null, payer.token, 401);
  console.log('PASS: live local API — two accounts, signed QR, real mock challenge, one simulated payment, idempotent retry, both histories, replay rejection, logout revocation.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
