const request = require('supertest');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { testContext } = require('./helpers/app');
const { issueSession } = require('../services/authService');
const { OTPService, getOtpService } = require('../services/otpService');

const START = Date.parse('2026-10-20T10:00:00.000Z');
const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });
async function fixture(configOverrides = {}) {
  let now = START;
  const otpOutboxDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nampay-otp-test-'));
  directories.push(otpOutboxDir);
  const users = Object.fromEntries(['payer', 'recipient', 'other'].map(uid => [uid, {
    uid, firstName: uid, lastName: 'Test', email: `${uid}@example.test`, status: 'active', sessionVersion: 0,
    phoneVerified: false, phoneNumber: '', cards: {},
  }]));
  const context = testContext({ seed: { users }, config: { now: () => now, otpOutboxDir, ...configOverrides } });
  const tokens = Object.fromEntries(Object.values(users).map(user => [user.uid, issueSession(user, context.config).token]));
  const api = (method, url, uid = 'payer') => request(context.app)[method](`/api/${url}`).set('Authorization', `Bearer ${tokens[uid]}`);
  const f = { ...context, api, users, otpOutboxDir, advance: amount => { now += amount; } };
  const card = await api('post', 'payments/link-card').send({ testCardId: 'demo-visa' }).expect(201);
  f.cardId = card.body.card.id;
  await newRequest(f);
  return f;
}
async function newRequest(f) {
  const generated = await f.api('post', 'qr/generate', 'recipient').send({ amount: '19.99', reference: 'OTP test' }).expect(201);
  f.requestId = generated.body.paymentRequest.id;
  f.qrData = generated.body.qrData;
  await f.api('post', 'qr/scan').send({ qrData: f.qrData }).expect(200);
}
async function sendCode(f) {
  const response = await f.api('post', 'otp/send').send({ requestId: f.requestId, purpose: 'payment_verification' }).expect(200);
  const file = path.join(f.otpOutboxDir, `otp-${response.body.sessionId}.json`);
  const delivery = JSON.parse(await fs.readFile(file, 'utf8'));
  return { ...response.body, code: delivery.code, file, delivery, response: response.body };
}

describe('real local challenge protocol', () => {
  it('issues private CSPRNG challenge, verifies it, and consumes it in an end-to-end simulated payment', async () => {
    const f = await fixture(); const issued = await sendCode(f);
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(issued.response).toMatchObject({ success: true, provider: 'mock', maskedDestination: 'Local demo inbox' });
    expect(issued.response).not.toHaveProperty('code');
    expect(issued.response).not.toHaveProperty('otp');
    expect((await fs.stat(issued.file)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(f.otpOutboxDir)).mode & 0o777).toBe(0o700);
    const session = await f.repository.read(`otpSessions/${issued.sessionId}`);
    expect(session).toMatchObject({ userUid: 'payer', requestId: f.requestId, amountMinor: 1999, status: 'pending', purpose: 'payment_verification' });
    expect(session.challengeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(session).not.toHaveProperty('code');
    const wrong = issued.code === '000000' ? '000001' : '000000';
    const invalid = await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: wrong }).expect(400);
    expect(invalid.body).toMatchObject({ code: 'OTP_INVALID', attemptsLeft: 4 });
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(200);
    await expect(fs.access(issued.file)).rejects.toMatchObject({ code: 'ENOENT' });
    const body = { requestId: f.requestId, cardId: f.cardId, sessionId: issued.sessionId, idempotencyKey: crypto.randomUUID() };
    const paid = await f.api('post', 'qr/confirm-payment').send(body).expect(200);
    expect(paid.body.transaction).toMatchObject({ amountMinor: 1999, status: 'completed', simulated: true });
    expect((await f.api('post', 'qr/confirm-payment').send(body).expect(200)).body.transaction.id).toBe(paid.body.transaction.id);
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(409);
    f.advance(300001);
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(409);
    expect(await f.repository.read(`otpSessions/${issued.sessionId}/status`)).toBe('consumed');
  });
  it('T-07: hides status and verification from another authenticated account', async () => {
    const f = await fixture(); const issued = await sendCode(f);
    await f.api('get', `otp/status/${issued.sessionId}`, 'other').expect(404);
    await f.api('post', 'otp/verify', 'other').send({ sessionId: issued.sessionId, otp: issued.code }).expect(404);
    expect(await f.repository.read(`otpSessions/${issued.sessionId}/attempts`)).toBe(0);
    const status = (await f.api('get', `otp/status/${issued.sessionId}`).expect(200)).body;
    expect(status.session).not.toHaveProperty('challengeHash');
    expect(status.session).not.toHaveProperty('phoneNumber');
  });
  it('T-08: refuses changed request amount, purpose and scan grant', async () => {
    const f = await fixture(); const issued = await sendCode(f);
    await f.repository.set(`paymentRequests/${f.requestId}/amountMinor`, 1);
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(403);
    await f.repository.set(`paymentRequests/${f.requestId}/amountMinor`, 1999);
    await f.repository.set(`otpSessions/${issued.sessionId}/purpose`, 'password_reset');
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(403);
    await f.repository.set(`otpSessions/${issued.sessionId}/purpose`, 'payment_verification');
    await f.repository.set(`requestAccess/${f.requestId}/payer`, null);
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(403);
    expect(await f.repository.read(`otpSessions/${issued.sessionId}/status`)).toBe('pending');
  });
  it('rejects arbitrary destinations and non-payment purposes without sending', async () => {
    const f = await fixture();
    await f.api('post', 'otp/send').send({ requestId: f.requestId, phoneNumber: '+264811234567' }).expect(400);
    await f.api('post', 'otp/send').send({ requestId: f.requestId, purpose: 'login' }).expect(400);
    await f.api('post', 'otp/send', 'recipient').send({ requestId: f.requestId }).expect(400);
    expect(await f.repository.read('otpSessions')).toBeNull();
    expect(await fs.readdir(f.otpOutboxDir)).toEqual([]);
  });
  it('T-10: concurrent wrong guesses increment attempts atomically and cannot reopen a blocked session', async () => {
    const f = await fixture(); const issued = await sendCode(f);
    const wrong = issued.code === '000000' ? '000001' : '000000';
    const results = await Promise.all(Array.from({ length: 9 }, () => f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: wrong })));
    expect(results.filter(result => result.status === 400)).toHaveLength(4);
    expect(results.filter(result => result.status === 429)).toHaveLength(5);
    expect(await f.repository.read(`otpSessions/${issued.sessionId}`)).toMatchObject({ status: 'blocked', attempts: 5 });
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(429);
  });
  it('enforces resend cooldown regardless of verified state and invalidates old challenges', async () => {
    const f = await fixture(); const first = await sendCode(f);
    await f.api('post', 'otp/resend').send({ requestId: f.requestId }).expect(429);
    await f.api('post', 'otp/verify').send({ sessionId: first.sessionId, otp: first.code }).expect(200);
    await f.api('post', 'otp/resend').send({ requestId: f.requestId }).expect(429);
    f.advance(60000);
    const second = await sendCode(f);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(await f.repository.read(`otpSessions/${first.sessionId}/status`)).toBe('superseded');
    await f.api('post', 'qr/confirm-payment').send({ requestId: f.requestId, cardId: f.cardId, sessionId: first.sessionId, idempotencyKey: crypto.randomUUID() }).expect(409);
    await f.api('post', 'otp/verify').send({ sessionId: second.sessionId, otp: second.code }).expect(200);
  });
  it('enforces account window limits across different requests', async () => {
    const f = await fixture();
    for (let index = 0; index < 5; index++) {
      if (index) f.advance(60000);
      await sendCode(f);
    }
    f.advance(60000); await newRequest(f);
    await f.api('post', 'otp/send').send({ requestId: f.requestId }).expect(429);
  });
  it('enforces expiry with no successful verification and keeps the code inaccessible', async () => {
    const f = await fixture(); const issued = await sendCode(f);
    f.advance(300000);
    await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(410);
    expect(await f.repository.read(`otpSessions/${issued.sessionId}/status`)).toBe('expired');
    await expect(fs.access(issued.file)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('marks delivery failure unusable and never returns provider details', async () => {
    const f = await fixture();
    const service = new OTPService({ repository: f.repository, config: f.config, deliver: async () => { throw new Error('private-provider-message'); } });
    await expect(service.issue({ userUid: 'payer', requestId: f.requestId, ip: 'isolated-ip' })).rejects.toMatchObject({ status: 503, code: 'OTP_DELIVERY_FAILED' });
    const [session] = Object.values(await f.repository.read('otpSessions'));
    expect(session.status).toBe('delivery_failed');
    expect(await fs.readdir(f.otpOutboxDir)).toEqual([]);
    await expect(service.verify({ userUid: 'payer', sessionId: session.id, otp: '000000' })).rejects.toMatchObject({ status: 409 });
  });
  it('T-20: allows mock only in explicit isolated demo and fails closed without a provider', async () => {
    const f = await fixture();
    for (const override of [{ nodeEnv: 'production' }, { demoMode: false }, { otpProvider: '' }]) {
      const service = new OTPService({ repository: f.repository, config: { ...f.config, ...override } });
      await expect(service.issue({ userUid: 'payer', requestId: f.requestId })).rejects.toMatchObject({ status: 503 });
    }
    const liveRepository = { ...f.repository, kind: 'firebase' };
    const nonEmulator = new OTPService({ repository: liveRepository, config: { ...f.config, useEmulators: false } });
    await expect(nonEmulator.issue({ userUid: 'payer', requestId: f.requestId })).rejects.toMatchObject({ status: 503 });
    const twilio = new OTPService({ repository: f.repository, config: { ...f.config, otpProvider: 'twilio' }, deliver: () => { throw new Error('Must not send'); } });
    await expect(twilio.issue({ userUid: 'payer', requestId: f.requestId })).rejects.toMatchObject({ status: 403, code: 'VERIFIED_PHONE_REQUIRED' });
    expect(await f.repository.read('otpSessions')).toBeNull();
  });
  it('does not allow malformed code attempts or legacy cleanup routes', async () => {
    const f = await fixture(); const issued = await sendCode(f);
    for (const otp of [123456, '123', '1234567', null, '12345a']) await f.api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp }).expect(400);
    await f.api('post', 'otp/cleanup').send({}).expect(404);
    expect(await f.repository.read(`otpSessions/${issued.sessionId}/attempts`)).toBe(0);
  });
  it('fails closed if the rate-limit transaction store is unavailable', async () => {
    const f = await fixture();
    const service = new OTPService({ repository: { ...f.repository, transaction: async () => { throw new Error('storage offline'); } }, config: f.config });
    await expect(service.issue({ userUid: 'payer', requestId: f.requestId })).rejects.toThrow('storage offline');
    expect(await fs.readdir(f.otpOutboxDir)).toEqual([]);
  });
});
