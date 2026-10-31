const request = require('supertest');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { testContext } = require('./helpers/app');
const { issueSession } = require('../services/authService');
const { getOtpService } = require('../services/otpService');

const START = Date.parse('2026-10-30T09:00:00.000Z');
const directories = [];
afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })));
});
async function fixture({ count = 3, config = {}, sharedPhone = false } = {}) {
  let now = START;
  const otpOutboxDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nampay-release-security-'));
  directories.push(otpOutboxDir);
  const ids = ['recipient', ...Array.from({ length: count }, (_, index) => `payer-${index}`)];
  const users = Object.fromEntries(ids.map(uid => [uid, {
    uid, email: `${uid}@example.invalid`, firstName: uid, lastName: 'Synthetic', status: 'active', sessionVersion: 0,
    phoneVerified: sharedPhone, phoneNumber: sharedPhone ? '+264810000001' : '', cards: {},
  }]));
  const context = testContext({ seed: { users }, config: { now: () => now, otpOutboxDir, ...config }, routes: ['payments', 'qr', 'otp'] });
  const tokens = Object.fromEntries(ids.map(uid => [uid, issueSession(users[uid], context.config).token]));
  const api = (method, route, uid = 'payer-0') => request(context.app)[method](`/api/${route}`).set('Authorization', `Bearer ${tokens[uid]}`);
  return { ...context, api, tokens, otpOutboxDir, advance: milliseconds => { now += milliseconds; } };
}
async function generate(f, uid = 'recipient') {
  return (await f.api('post', 'qr/generate', uid).send({ amountMinor: 12345, reference: 'Synthetic release invoice' }).expect(201)).body;
}
async function scan(f, generated, uid = 'payer-0') {
  return f.api('post', 'qr/scan', uid).send({ qrData: generated.qrData }).expect(200);
}
async function challenge(f, generated, uid = 'payer-0') {
  await scan(f, generated, uid);
  const result = await f.api('post', 'otp/send', uid).send({ requestId: generated.paymentRequest.id }).expect(200);
  const delivery = JSON.parse(await fs.readFile(path.join(f.otpOutboxDir, `otp-${result.body.sessionId}.json`), 'utf8'));
  await f.api('post', 'otp/verify', uid).send({ sessionId: result.body.sessionId, otp: delivery.code }).expect(200);
  return { sessionId: result.body.sessionId, code: delivery.code };
}
async function prepared(f, uid = 'payer-0') {
  const card = (await f.api('post', 'payments/link-card', uid).send({ testCardId: 'demo-visa' }).expect(201)).body.card;
  const generated = await generate(f);
  const verified = await challenge(f, generated, uid);
  return { generated, code: verified.code, body: { requestId: generated.paymentRequest.id, cardId: card.id,
    sessionId: verified.sessionId, idempotencyKey: crypto.randomUUID() } };
}
function safeError(response, code) {
  expect(response.body).toEqual({ code, error: expect.any(String), requestId: expect.any(String) });
  expect(response.headers['x-request-id']).toBe(response.body.requestId);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(JSON.stringify(response.body)).not.toMatch(/stack|RangeError|timingSafeEqual|node_modules|Authorization|Bearer/);
}

it.each([0, 1, 63])('T-02: a %i-character signature returns a sanitized 400, never a timing comparison exception', async length => {
  const f = await fixture(); const generated = await generate(f);
  const envelope = { ...JSON.parse(generated.qrData), signature: 'a'.repeat(length) };
  const result = await f.api('post', 'qr/scan').send({ qrData: JSON.stringify(envelope) }).expect(400);
  safeError(result, 'INVALID_QR');
  expect(result.body.error).toBe('This is not a valid NamPay payment QR code');
  expect(await f.repository.read('requestAccess')).toBeNull();
});
it('T-02: the QR payload size boundary rejects 2049 characters while accepting the signed 2048-character envelope', async () => {
  const f = await fixture(); const generated = await generate(f);
  const boundary = generated.qrData.padEnd(2048, ' ');
  safeError(await f.api('post', 'qr/scan').send({ qrData: `${boundary} ` }).expect(400), 'INVALID_QR');
  expect(await f.repository.read('requestAccess')).toBeNull();
  await f.api('post', 'qr/scan').send({ qrData: boundary }).expect(200);
});
it('T-02/T-17: oversized HTTP bodies fail without echoing their payload or parsing details', async () => {
  const f = await fixture();
  const result = await f.api('post', 'qr/scan').send({ qrData: 'PRIVATE-SYNTHETIC-PAYLOAD'.repeat(100000) }).expect(413);
  safeError(result, 'INVALID_INPUT'); expect(result.body.error).toBe('The request body is too large');
  expect(result.text).not.toContain('PRIVATE-SYNTHETIC-PAYLOAD');
  expect(await f.repository.read('requestAccess')).toBeNull();
});
it.each(['qr/confirm-payment', 'payments/process-payment'])('T-05: direct self-payment at %s is rejected without a prior scan', async endpoint => {
  const f = await fixture(); const generated = await generate(f);
  const card = (await f.api('post', 'payments/link-card', 'recipient').send({ testCardId: 'demo-visa' }).expect(201)).body.card;
  const result = await f.api('post', endpoint, 'recipient').send({ requestId: generated.paymentRequest.id,
    cardId: card.id, sessionId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }).expect(400);
  safeError(result, 'SELF_PAYMENT');
  expect(await f.repository.read('transactions')).toBeNull();
  expect((await f.api('get', `qr/requests/${generated.paymentRequest.id}`, 'recipient')).body.paymentRequest.status).toBe('pending');
});
it.each([Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, 1e30, '9007199254740992'])('T-06: unsafe or noninteger-typed amountMinor %p is rejected without creating a request', async amountMinor => {
  const f = await fixture();
  safeError(await f.api('post', 'qr/generate', 'recipient').send({ amountMinor }).expect(400), 'INVALID_AMOUNT');
  expect((await f.api('get', 'qr/requests', 'recipient')).body.requests).toEqual([]);
});
it('T-10: the shared-IP quota covers distinct accounts and ignores untrusted forwarded headers', async () => {
  const f = await fixture({ count: 21 }); const generated = await generate(f);
  for (let index = 0; index < 21; index += 1) {
    const uid = `payer-${index}`; await scan(f, generated, uid);
    const result = await f.api('post', 'otp/send', uid).set('X-Forwarded-For', `192.0.2.${index + 1}`).send({ requestId: generated.paymentRequest.id });
    expect(result.status).toBe(index < 20 ? 200 : 429);
    if (index === 20) safeError(result, 'OTP_RATE_LIMITED');
  }
  expect(await fs.readdir(f.otpOutboxDir)).toHaveLength(20);
  f.advance(900001); const next = await generate(f); await scan(f, next, 'payer-20');
  await f.api('post', 'otp/send', 'payer-20').send({ requestId: next.paymentRequest.id }).expect(200);
});
it('T-10: verified accounts sharing a destination share cooldown and window quota without invoking an SMS provider', async () => {
  const f = await fixture({ count: 6, sharedPhone: true, config: { otpProvider: 'twilio' } });
  // Only the delivery boundary is stubbed; HTTP authentication, destination
  // resolution, request authorization and transactional quotas remain real.
  const deliver = jest.fn().mockResolvedValue(undefined);
  getOtpService(f.app).deliverOverride = deliver;
  let generated = await generate(f);
  await scan(f, generated, 'payer-0'); await scan(f, generated, 'payer-1');
  await f.api('post', 'otp/send').send({ requestId: generated.paymentRequest.id }).expect(200);
  safeError(await f.api('post', 'otp/send', 'payer-1').send({ requestId: generated.paymentRequest.id }).expect(429), 'OTP_RATE_LIMITED');
  for (let index = 1; index < 5; index += 1) {
    f.advance(60000); await scan(f, generated, `payer-${index}`);
    await f.api('post', 'otp/send', `payer-${index}`).send({ requestId: generated.paymentRequest.id }).expect(200);
  }
  f.advance(60000); generated = await generate(f); await scan(f, generated, 'payer-5');
  safeError(await f.api('post', 'otp/send', 'payer-5').send({ requestId: generated.paymentRequest.id }).expect(429), 'OTP_RATE_LIMITED');
  expect(deliver).toHaveBeenCalledTimes(5);
  expect(new Set(deliver.mock.calls.map(([, destination]) => destination))).toEqual(new Set(['+264810000001']));
  expect(await fs.readdir(f.otpOutboxDir)).toEqual([]);
});
it.each(['cardId', 'sessionId'])('T-12: a committed key cannot be replayed with a changed %s', async field => {
  const f = await fixture(); const flow = await prepared(f);
  const completed = await f.api('post', 'qr/confirm-payment').send(flow.body).expect(200);
  const changed = field === 'cardId' ? (await f.api('post', 'payments/link-card').send({ testCardId: 'demo-mastercard' }).expect(201)).body.card.id : crypto.randomUUID();
  const conflict = await f.api('post', 'qr/confirm-payment').send({ ...flow.body, [field]: changed }).expect(409);
  safeError(conflict, 'IDEMPOTENCY_KEY_REUSED');
  const retry = await f.api('post', 'qr/confirm-payment').send(flow.body).expect(200);
  expect(retry.body).toMatchObject({ idempotent: true, transaction: { id: completed.body.transaction.id } });
  expect((await f.api('get', 'payments/history')).body.transactions).toHaveLength(1);
});
it('T-12: a committed key cannot fund another request even with fresh correctly bound verification', async () => {
  const f = await fixture(); const flow = await prepared(f);
  const completed = await f.api('post', 'qr/confirm-payment').send(flow.body).expect(200);
  f.advance(60000); const next = await generate(f); const verified = await challenge(f, next);
  const body = { ...flow.body, requestId: next.paymentRequest.id, sessionId: verified.sessionId };
  safeError(await f.api('post', 'qr/confirm-payment').send(body).expect(409), 'IDEMPOTENCY_KEY_REUSED');
  expect((await f.api('get', `qr/requests/${next.paymentRequest.id}`)).body.paymentRequest.status).toBe('pending');
  expect((await f.api('get', `otp/status/${verified.sessionId}`)).body.session.status).toBe('verified');
  expect((await f.api('get', 'payments/history')).body.transactions.map(value => value.id)).toEqual([completed.body.transaction.id]);
  expect((await f.api('post', 'qr/confirm-payment').send(flow.body).expect(200)).body.transaction.id).toBe(completed.body.transaction.id);
});
it('T-12: concurrent different requests using one payer key commit only one payment', async () => {
  const f = await fixture(); const first = await prepared(f);
  f.advance(60000); const next = await generate(f); const verified = await challenge(f, next);
  const second = { ...first.body, requestId: next.paymentRequest.id, sessionId: verified.sessionId };
  const results = await Promise.all([first.body, second].map(body => f.api('post', 'qr/confirm-payment').send(body)));
  expect(results.map(response => response.status).sort()).toEqual([200, 409]);
  safeError(results.find(response => response.status === 409), 'IDEMPOTENCY_KEY_REUSED');
  const winner = results.find(response => response.status === 200).body.transaction;
  const originalBody = winner.requestId === first.body.requestId ? first.body : second;
  const losingBody = winner.requestId === first.body.requestId ? second : first.body;
  expect((await f.api('post', 'qr/confirm-payment').send(originalBody).expect(200)).body).toMatchObject({ idempotent: true, transaction: { id: winner.id } });
  expect((await f.api('get', `otp/status/${losingBody.sessionId}`)).body.session.status).toBe('verified');
  expect((await f.api('get', 'payments/history')).body.transactions).toHaveLength(1);
  expect(JSON.stringify(await f.repository.read())).not.toContain(first.body.idempotencyKey);
});
it('T-12: the same client key on different payer accounts remains independently scoped', async () => {
  const f = await fixture(); const one = await prepared(f); const two = await prepared(f, 'payer-1');
  two.body.idempotencyKey = one.body.idempotencyKey;
  const first = await f.api('post', 'qr/confirm-payment').send(one.body).expect(200);
  const second = await f.api('post', 'qr/confirm-payment', 'payer-1').send(two.body).expect(200);
  expect(first.body.transaction.id).not.toBe(second.body.transaction.id);
  for (const uid of ['payer-0', 'payer-1']) expect((await f.api('get', 'payments/history', uid)).body.transactions).toHaveLength(1);
});
it('T-12: pre-index transactions retain their exact result and gain a key binding on retry', async () => {
  const f = await fixture(); const flow = await prepared(f);
  const paid = await f.api('post', 'qr/confirm-payment').send(flow.body).expect(200);
  // Model a retained canonical record written before the operation-key index.
  const historical = await f.repository.read('transactions');
  await f.repository.set('paymentOperations', null);
  const retried = await f.api('post', 'payments/process-payment').send(flow.body).expect(200);
  expect(retried.body).toMatchObject({ idempotent: true, transaction: { id: paid.body.transaction.id } });
  expect(await f.repository.read('transactions')).toEqual(historical);
  f.advance(60000); const next = await generate(f); const verified = await challenge(f, next);
  safeError(await f.api('post', 'qr/confirm-payment').send({ ...flow.body, requestId: next.paymentRequest.id, sessionId: verified.sessionId }).expect(409), 'IDEMPOTENCY_KEY_REUSED');
});
it('T-12: an unavailable indexed canonical result fails closed instead of authorizing a new payment', async () => {
  const f = await fixture(); const flow = await prepared(f);
  const paid = await f.api('post', 'qr/confirm-payment').send(flow.body).expect(200);
  await f.repository.set(`transactions/${paid.body.transaction.id}`, null);
  const capture = jest.spyOn(console, 'error').mockImplementation(() => {});
  safeError(await f.api('post', 'qr/confirm-payment').send(flow.body).expect(503), 'PAYMENT_RESULT_UNAVAILABLE');
  expect(capture).toHaveBeenCalledTimes(1);
  expect(await f.repository.read('transactions')).toEqual({});
  expect((await f.api('get', `otp/status/${flow.body.sessionId}`)).body.session.status).toBe('consumed');
});
it('T-17/T-20: captured application logs and public errors omit submitted card data, real challenge, bearer token and internal failures', async () => {
  const logs = [];
  for (const method of ['log', 'info', 'warn', 'debug', 'error']) jest.spyOn(console, method).mockImplementation((...args) => logs.push({ method, args }));
  const f = await fixture(); const flow = await prepared(f);
  const pan = '4111111111111111'; const cvv = '867'; const internal = 'private-provider-or-storage-diagnostic';
  const responses = [];
  responses.push(await f.api('post', 'payments/link-card').send({ testCardId: 'demo-visa', cardNumber: pan, cvv }).expect(400));
  responses.push(await f.api('post', 'otp/verify').send({ sessionId: flow.body.sessionId, otp: flow.code }).expect(409));
  responses.push(await f.api('post', 'qr/confirm-payment').send(flow.body).expect(200));
  f.advance(60000); const next = await generate(f); await scan(f, next);
  getOtpService(f.app).deliverOverride = jest.fn(async () => { throw new Error(`${internal} PAN=${pan} CVV=${cvv} OTP=${flow.code} token=${f.tokens['payer-0']}`); });
  responses.push(await f.api('post', 'otp/send').send({ requestId: next.paymentRequest.id }).expect(503));
  // A raw storage exception reaches the global handler, which must log only a
  // request correlation ID and safe code, not Error.message or request bodies.
  jest.spyOn(f.repository, 'read').mockRejectedValueOnce(new Error(`${internal} ${pan} ${cvv} ${flow.code} ${f.tokens['payer-0']}`));
  const failed = await f.api('get', 'payments/cards').expect(500);
  responses.push(failed); safeError(failed, 'INTERNAL_ERROR');
  expect(logs.some(entry => entry.method === 'error')).toBe(true);
  for (const entry of logs) for (const argument of entry.args) {
    expect(typeof argument).toBe('string');
    expect(JSON.parse(argument)).toEqual({ requestId: expect.any(String), code: expect.any(String) });
  }
  const captured = JSON.stringify(logs);
  for (const secret of [pan, `CVV=${cvv}`, flow.code, f.tokens['payer-0'], internal]) expect(captured).not.toContain(secret);
  for (const response of responses) for (const secret of [pan, flow.code, f.tokens['payer-0'], internal]) expect(response.text).not.toContain(secret);
});
