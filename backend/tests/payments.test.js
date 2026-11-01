const request = require('supertest');
const crypto = require('node:crypto');
const { testContext } = require('./helpers/app');
const { issueSession } = require('../services/authService');
const { parseAmount, MAX_AMOUNT_MINOR } = require('../utils/paymentValidation');
const START = Date.parse('2026-10-20T09:00:00.000Z');
function fixture() {
  let now = START;
  const users = Object.fromEntries(['payer', 'recipient', 'stranger'].map(uid => [uid, {
    uid, email: `${uid}@example.test`, firstName: uid, lastName: 'Demo', status: 'active', sessionVersion: 0,
    createdAt: new Date(now).toISOString(), cards: {},
  }]));
  const context = testContext({ seed: { users }, config: { now: () => now }, routes: ['payments', 'qr', 'users'] });
  const tokens = Object.fromEntries(Object.values(users).map(user => [user.uid, issueSession(user, context.config).token]));
  const api = (method, path, uid = 'payer') => request(context.app)[method](`/api/${path}`).set('Authorization', `Bearer ${tokens[uid]}`);
  return { ...context, api, users, tokens, advance: milliseconds => { now += milliseconds; } };
}
async function pending(f) {
  return (await f.api('post', 'qr/generate', 'recipient').send({ amount: '123.45', reference: 'Test invoice' }).expect(201)).body;
}
async function ready(f, sessionOverrides = {}) {
  const generated = await pending(f);
  const cardId = (await f.api('post', 'payments/link-card').send({ testCardId: 'demo-visa' }).expect(201)).body.card.id;
  await f.api('post', 'qr/scan').send({ qrData: generated.qrData }).expect(200);
  const sessionId = crypto.randomUUID();
  await f.repository.set(`otpSessions/${sessionId}`, {
    id: sessionId, userUid: 'payer', purpose: 'payment_verification', requestId: generated.paymentRequest.id,
    amountMinor: generated.paymentRequest.amountMinor, status: 'verified', attempts: 1,
    createdAt: new Date(START).toISOString(), verifiedAt: new Date(START).toISOString(),
    expiresAt: generated.paymentRequest.expiresAt, ...sessionOverrides,
  });
  return { ...generated, cardId, sessionId, idempotencyKey: crypto.randomUUID(), requestId: generated.paymentRequest.id };
}
function confirm(flow) { return { requestId: flow.requestId, cardId: flow.cardId, sessionId: flow.sessionId, idempotencyKey: flow.idempotencyKey }; }

describe('money parsing (T-06)', () => {
  test.each(['0', '-1', 'NaN', 'Infinity', '1e3', '1.001', true, null, {}, [], NaN, Infinity, '10000.01'])('rejects %p', value => expect(() => parseAmount(value)).toThrow());
  test.each([['0.01', 1], ['123.45', 12345], ['10000', MAX_AMOUNT_MINOR]])('parses %s exactly', (value, expected) => expect(parseAmount(value)).toBe(expected));
});

describe('signed requests', () => {
  it('T-01: returns authoritative fields and no PII in signed QR data', async () => {
    const f = fixture(); const generated = await pending(f);
    expect(Object.keys(JSON.parse(generated.qrData)).sort()).toEqual(['expiresAt', 'signature', 'token', 'type', 'version']);
    expect(generated.qrData).not.toContain('example.test');
    const scan = await f.api('post', 'qr/scan').send({ qrData: generated.qrData }).expect(200);
    expect(scan.body.paymentRequest).toMatchObject({ amountMinor: 12345, requesterUid: 'recipient', currency: 'NAD', status: 'pending' });
    expect(scan.body.receiverCard).toBeNull();
    expect((await f.repository.read(`requestAccess/${generated.paymentRequest.id}/payer`)).expiresAt).toBe(generated.paymentRequest.expiresAt);
  });
  it('T-02: rejects tampering, extra fields, malformed signature and payloads', async () => {
    const f = fixture(); const generated = await pending(f); const data = JSON.parse(generated.qrData);
    for (const changed of [{ ...data, token: crypto.randomUUID() }, { ...data, amount: 1 }, { ...data, signature: 'x'.repeat(64) }, [], null]) {
      await f.api('post', 'qr/scan').send({ qrData: JSON.stringify(changed) }).expect(400);
    }
    await f.api('post', 'qr/scan').send({ qrData: 'not json' }).expect(400);
    expect(await f.repository.read('requestAccess')).toBeNull();
  });
  it('T-03/T-05: rejects expiry and self-payment; expiry notifications are deduplicated', async () => {
    const f = fixture(); const generated = await pending(f);
    await f.api('post', 'qr/scan', 'recipient').send({ qrData: generated.qrData }).expect(400);
    f.advance(300000);
    expect((await f.api('post', 'qr/scan').send({ qrData: generated.qrData }).expect(410)).body.code).toBe('REQUEST_EXPIRED');
    for (let i = 0; i < 2; i++) expect((await f.api('get', 'qr/requests', 'recipient').expect(200)).body.requests[0].status).toBe('expired');
    expect(Object.keys(await f.repository.read('notifications/recipient')).filter(id => id.startsWith('request_expired_'))).toHaveLength(1);
  });
  it('bounds TTL, currency and generation amount without partial writes', async () => {
    const f = fixture();
    for (const expiresIn of ['300', -1, 0, 301, 1.5, null]) await f.api('post', 'qr/generate', 'recipient').send({ amount: '5.00', expiresIn }).expect(400);
    for (const amount of ['0', '-1', '999999999', '1.001', 'NaN']) await f.api('post', 'qr/generate', 'recipient').send({ amount }).expect(400);
    await f.api('post', 'qr/generate', 'recipient').send({ amountMinor: 500, amount: '6' }).expect(400);
    await f.api('post', 'qr/generate', 'recipient').send({ amount: '5', currency: 'USD' }).expect(400);
    expect(await f.repository.read('paymentRequests')).toBeNull();
  });
  it('limits visibility/cancellation and rejects cancelled QR codes', async () => {
    const f = fixture(); const generated = await pending(f); const id = generated.paymentRequest.id;
    await f.api('get', `qr/requests/${id}`, 'stranger').expect(404);
    await f.api('post', `qr/requests/${id}/cancel`).send({}).expect(404);
    expect((await f.api('post', `qr/requests/${id}/cancel`, 'recipient').send({}).expect(200)).body.paymentRequest.status).toBe('cancelled');
    await f.api('post', 'qr/scan').send({ qrData: generated.qrData }).expect(409);
    await f.api('post', `qr/requests/${id}/cancel`, 'recipient').send({}).expect(200);
  });
  it('retains original minimal signed-envelope compatibility', async () => {
    const f = fixture(); const generated = await pending(f); const { type, token, expiresAt } = JSON.parse(generated.qrData);
    const legacy = { type, token, expiresAt };
    legacy.signature = crypto.createHmac('sha256', f.config.jwtSecret).update(JSON.stringify(legacy)).digest('hex');
    await f.api('post', 'qr/scan').send({ qrData: JSON.stringify(legacy) }).expect(200);
  });
});

describe('owned test instruments (T-14/T-17)', () => {
  it('rejects real-card fields/invalid expiry and keeps exactly one default after removal', async () => {
    const f = fixture();
    await f.api('post', 'payments/link-card').send({ cardNumber: '4111111111111111', cvc: '123', testCardId: 'demo-visa' }).expect(400);
    await f.api('post', 'payments/link-card').send({ testCardId: 'unknown' }).expect(400);
    await f.api('post', 'payments/link-card').send({ testCardId: 'demo-visa', expMonth: 1, expYear: 2025 }).expect(400);
    const one = (await f.api('post', 'payments/link-card').send({ testCardId: 'demo-visa' }).expect(201)).body.card;
    const two = (await f.api('post', 'payments/link-card').send({ testCardId: 'demo-mastercard' }).expect(201)).body.card;
    expect(one.isDefault).toBe(true);
    expect((await f.api('get', 'payments/cards')).body.cards.filter(card => card.isDefault)).toHaveLength(1);
    await f.api('put', `payments/set-default-card/${two.id}`).send({}).expect(200);
    await f.api('delete', `payments/remove-card/${two.id}`).expect(200);
    expect((await f.api('get', 'payments/cards')).body.cards[0]).toMatchObject({ id: one.id, isDefault: true, simulated: true });
    await f.api('delete', `payments/remove-card/${one.id}`, 'stranger').expect(404);
    expect(JSON.stringify(await f.repository.read('users/payer/cards'))).not.toMatch(/4111111111111111|cardNumber|cvc|cvv|paymentMethodId/);
  });
  it('serializes competing default changes', async () => {
    const f = fixture(); const ids = [];
    for (const testCardId of ['demo-visa', 'demo-mastercard']) ids.push((await f.api('post', 'payments/link-card').send({ testCardId }).expect(201)).body.card.id);
    await Promise.all(ids.map(id => f.api('put', `payments/set-default-card/${id}`).send({}).expect(200)));
    expect((await f.api('get', 'payments/cards')).body.cards.filter(card => card.isDefault)).toHaveLength(1);
  });
});

describe('atomic simulation invariants', () => {
  it('T-11/T-12/T-16/T-18: concurrent identical retries produce one transaction and consistent participant views', async () => {
    const f = fixture(); const flow = await ready(f);
    const responses = await Promise.all(Array.from({ length: 8 }, () => f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(200)));
    const id = responses[0].body.transaction.id;
    expect(new Set(responses.map(result => result.body.transaction.id)).size).toBe(1);
    expect(responses.filter(result => result.body.idempotent === false)).toHaveLength(1);
    const state = await f.repository.read();
    expect(Object.keys(state.transactions)).toEqual([id]);
    expect(state.otpSessions[flow.sessionId]).toMatchObject({ status: 'consumed', transactionId: id });
    expect(state.userTransactions.payer[id]).toMatchObject({ role: 'sent', amountMinor: 12345, status: 'completed' });
    expect(state.userTransactions.recipient[id]).toMatchObject({ role: 'received', amountMinor: 12345, status: 'completed' });
    expect((await f.api('post', 'payments/process-payment').send(confirm(flow)).expect(200)).body.idempotent).toBe(true);
    expect((await f.api('get', `qr/requests/${flow.requestId}`).expect(200)).body.paymentRequest).toMatchObject({ status: 'completed', transactionId: id });
    for (const uid of ['payer', 'recipient']) {
      const history = (await f.api('get', 'payments/history', uid).expect(200)).body.transactions;
      expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ id, amountMinor: 12345, simulated: true });
      expect((await f.api('get', `payments/transactions/${id}`, uid).expect(200)).body.transaction.notice).toContain('No real funds transferred');
    }
    await f.api('get', `payments/transactions/${id}`, 'stranger').expect(404);
  });
  it('T-04/T-09: rejects another operation key and used QR', async () => {
    const f = fixture(); const flow = await ready(f);
    await f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(200);
    await f.api('post', 'qr/confirm-payment').send({ ...confirm(flow), idempotencyKey: crypto.randomUUID() }).expect(409);
    await f.api('post', 'qr/scan').send({ qrData: flow.qrData }).expect(409);
    expect(Object.keys(await f.repository.read('transactions'))).toHaveLength(1);
  });
  it.each([['user', { userUid: 'stranger' }], ['request', { requestId: 'another-request' }], ['purpose', { purpose: 'password_reset' }], ['amount', { amountMinor: 1 }]])('T-07/T-08: rejects OTP bound to different %s', async (_label, session) => {
    const f = fixture(); const flow = await ready(f, session);
    expect((await f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(403)).body.code).toBe('OTP_BINDING_MISMATCH');
    expect(await f.repository.read('transactions')).toBeNull();
    expect(await f.repository.read(`paymentRequests/${flow.requestId}/status`)).toBe('pending');
  });
  it('rejects unverified/consumed/blocked/expired authorizations', async () => {
    for (const status of ['pending', 'consumed', 'blocked']) {
      const f = fixture(); const flow = await ready(f, { status });
      await f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(409);
      expect(await f.repository.read('transactions')).toBeNull();
    }
    const f = fixture(); const flow = await ready(f, { expiresAt: new Date(START - 1).toISOString() });
    await f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(410);
  });
  it('rejects changed amount, other user card and bypassing signed QR scan', async () => {
    const f = fixture(); const flow = await ready(f);
    await f.api('post', 'qr/confirm-payment').send({ ...confirm(flow), amountMinor: 1 }).expect(400);
    const other = (await f.api('post', 'payments/link-card', 'stranger').send({ testCardId: 'demo-visa' }).expect(201)).body.card;
    await f.api('post', 'qr/confirm-payment').send({ ...confirm(flow), cardId: other.id }).expect(403);
    await f.repository.set(`requestAccess/${flow.requestId}/payer`, null);
    await f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(403);
    expect(await f.repository.read('transactions')).toBeNull();
  });
  it('T-19: cancel racing confirmation produces exactly one terminal outcome', async () => {
    const f = fixture(); const flow = await ready(f);
    const results = await Promise.all([f.api('post', 'qr/confirm-payment').send(confirm(flow)), f.api('post', `qr/requests/${flow.requestId}/cancel`, 'recipient').send({})]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const state = await f.repository.read(); const status = state.paymentRequests[flow.requestId].status;
    expect(['completed', 'cancelled']).toContain(status);
    expect(Object.keys(state.transactions || {})).toHaveLength(status === 'completed' ? 1 : 0);
  });
  it('rejects confirmation at exact expiry and with removed card', async () => {
    let f = fixture(); let flow = await ready(f); f.advance(300000);
    await f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(410);
    f = fixture(); flow = await ready(f);
    await f.api('delete', `payments/remove-card/${flow.cardId}`).expect(200);
    await f.api('post', 'qr/confirm-payment').send(confirm(flow)).expect(403);
  });
  it('preserves legacy counterpart records and excludes unrelated accounts', async () => {
    const f = fixture();
    for (const [uid, type] of [['payer', 'send'], ['recipient', 'receive']]) await f.repository.set(`transactions/legacy_${uid}`, { id: 'legacy', userId: uid, type, amount: 25, currency: 'NAD', status: 'completed', timestamp: new Date(START).toISOString() });
    const result = (await f.api('get', 'payments/history').expect(200)).body;
    expect(result.transactions).toHaveLength(1); expect(result.transactions[0]).toMatchObject({ id: 'legacy', legacy: true, amountMinor: 2500, role: 'sent' });
    expect((await f.api('get', 'payments/history', 'stranger')).body.transactions).toEqual([]);
  });
  it('T-13: rejects absent, forged and expired sessions', async () => {
    const f = fixture();
    await request(f.app).get('/api/payments/cards').expect(401);
    await request(f.app).get('/api/payments/cards').set('Authorization', 'Bearer forged').expect(401);
    f.advance(3600001); await f.api('get', 'payments/cards').expect(401);
  });
});
