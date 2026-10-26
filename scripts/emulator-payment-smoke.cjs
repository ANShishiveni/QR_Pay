const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireBackend = createRequire(path.join(__dirname, '../backend/package.json'));
const admin = requireBackend('firebase-admin');
const request = requireBackend('supertest');
const { createFirebaseRepository } = require('../backend/repositories');
const { createApp, runtimeConfig } = require('../backend/server');

assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:9000');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-nampay');
// The SDK ignores NO_PROXY for local ws:// connections. Only this strictly
// loopback/demo test child drops plaintext-proxy routing; HTTPS stays proxied.
delete process.env.HTTP_PROXY;
delete process.env.http_proxy;
const runId = crypto.randomUUID();
const testPath = `_apiIntegrationChecks/${runId}`;
const firebaseApp = admin.initializeApp({
  projectId: 'demo-nampay', databaseURL: 'https://demo-nampay-default-rtdb.firebaseio.com',
}, `api-smoke-${runId}`);

(async () => {
  const database = firebaseApp.database();
  const outbox = await fs.mkdtemp(path.join(os.tmpdir(), 'nampay-emulator-otp-'));
  // These are real SDK refs. A per-run subtree isolates the API's entire logical
  // database while exercising the production Firebase repository implementation.
  const repository = createFirebaseRepository({
    ref(relative = '') { return database.ref(`${testPath}${relative ? `/${relative}` : ''}`); },
    goOffline() { database.goOffline(); },
  });
  let now = Date.now();
  const config = runtimeConfig({
    NODE_ENV: 'test', DEMO_MODE: 'true', OTP_PROVIDER: 'mock',
    FIREBASE_PROJECT_ID: 'demo-nampay', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', OTP_OUTBOX_DIR: outbox,
  });
  config.now = () => now;
  const app = createApp({ repository, config });
  const accounts = {};
  const api = (method, route, role = 'payer') => request(app)[method](`/api/${route}`)
    .set('Authorization', `Bearer ${accounts[role].token}`);
  let scenarios = 0;
  const passed = label => { scenarios += 1; console.log(`PASS ${scenarios}: ${label}`); };

  async function makeRequest() {
    const generated = await api('post', 'qr/generate', 'recipient').send({ amount: '123.45', reference: 'Synthetic emulator invoice' }).expect(201);
    await api('post', 'qr/scan').send({ qrData: generated.body.qrData }).expect(200);
    return generated.body;
  }
  async function issueCode(requestId) {
    const response = await api('post', 'otp/send').send({ requestId, purpose: 'payment_verification' }).expect(200);
    assert.equal(response.body.provider, 'mock');
    assert.equal(response.body.code, undefined);
    const file = path.join(outbox, `otp-${response.body.sessionId}.json`);
    const delivery = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.match(delivery.code, /^\d{6}$/);
    return { sessionId: response.body.sessionId, code: delivery.code };
  }

  try {
    for (const role of ['payer', 'recipient', 'stranger']) {
      const credentials = { email: `${role}-${runId}@example.invalid`, password: crypto.randomUUID() };
      const created = await request(app).post('/api/auth/register').send({
        ...credentials, firstName: role, lastName: 'Synthetic',
      }).expect(201);
      const login = await request(app).post('/api/auth/login').send(credentials).expect(200);
      accounts[role] = login.body;
      assert.equal(login.body.user.uid, created.body.user.uid);
      await api('get', 'auth/verify', role).expect(200);
    }
    passed('three independent account registrations, logins and current-session validation persisted in RTDB');

    const card = (await api('post', 'payments/link-card').send({ testCardId: 'demo-visa' }).expect(201)).body.card;
    const strangerCard = (await api('post', 'payments/link-card', 'stranger').send({ testCardId: 'demo-mastercard' }).expect(201)).body.card;
    const generated = await makeRequest();
    const requestId = generated.paymentRequest.id;
    assert.equal(generated.paymentRequest.amountMinor, 12345);
    const changed = { ...JSON.parse(generated.qrData), token: crypto.randomUUID() };
    await api('post', 'qr/scan').send({ qrData: JSON.stringify(changed) }).expect(400);
    await api('post', 'qr/scan', 'recipient').send({ qrData: generated.qrData }).expect(400);
    await api('get', `qr/requests/${requestId}`, 'stranger').expect(404);
    passed('test card persistence, authoritative signed QR scan, tamper/self-payment/stranger rejection');

    const issued = await issueCode(requestId);
    const session = await repository.read(`otpSessions/${issued.sessionId}`);
    assert.equal(session.userUid, accounts.payer.user.uid);
    assert.equal(session.amountMinor, 12345);
    assert.match(session.challengeHash, /^[a-f0-9]{64}$/);
    assert.equal(session.code, undefined);
    await api('post', 'otp/verify', 'stranger').send({ sessionId: issued.sessionId, otp: issued.code }).expect(404);
    const wrong = issued.code === '000000' ? '000001' : '000000';
    await api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: wrong }).expect(400);
    await api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(200);
    const body = { requestId, cardId: card.id, sessionId: issued.sessionId, idempotencyKey: crypto.randomUUID() };
    await api('post', 'qr/confirm-payment').send({ ...body, cardId: strangerCard.id }).expect(403);
    await api('post', 'qr/confirm-payment').send({ ...body, amountMinor: 1 }).expect(400);
    const otherRequest = await makeRequest();
    await api('post', 'qr/confirm-payment').send({ ...body, requestId: otherRequest.paymentRequest.id }).expect(403);
    passed('private real OTP challenge, wrong-owner/code rejection and request/amount/card binding');

    const confirmations = await Promise.all(Array.from({ length: 8 }, () => api('post', 'qr/confirm-payment').send(body).expect(200)));
    const transactionId = confirmations[0].body.transaction.id;
    assert.equal(new Set(confirmations.map(response => response.body.transaction.id)).size, 1);
    assert.equal(confirmations.filter(response => response.body.idempotent === false).length, 1);
    assert.deepEqual(Object.keys(await repository.read('transactions')), [transactionId]);
    assert.equal(await repository.read(`otpSessions/${issued.sessionId}/status`), 'consumed');
    passed('eight concurrent confirmations commit exactly one canonical simulated transaction and consume OTP once');

    for (const [role, direction] of [['payer', 'sent'], ['recipient', 'received']]) {
      const history = (await api('get', 'payments/history', role).expect(200)).body.transactions;
      assert.equal(history.length, 1);
      assert.equal(history[0].id, transactionId);
      assert.equal(history[0].amountMinor, 12345);
      assert.equal(history[0].simulated, true);
      const view = await repository.read(`userTransactions/${accounts[role].user.uid}/${transactionId}`);
      assert.equal(view.role, direction);
      assert.equal(view.status, 'completed');
      const receipt = (await api('get', `payments/transactions/${transactionId}`, role).expect(200)).body.transaction;
      assert.match(receipt.notice, /No real funds transferred/);
    }
    await api('get', `payments/transactions/${transactionId}`, 'stranger').expect(404);
    passed('matching sender/recipient histories and simulated receipts with ownership restrictions');

    const retry = await api('post', 'payments/process-payment').send(body).expect(200);
    assert.equal(retry.body.transaction.id, transactionId);
    assert.equal(retry.body.idempotent, true);
    await api('post', 'qr/confirm-payment').send({ ...body, idempotencyKey: crypto.randomUUID() }).expect(409);
    await api('post', 'otp/verify').send({ sessionId: issued.sessionId, otp: issued.code }).expect(409);
    await api('post', 'qr/scan').send({ qrData: generated.qrData }).expect(409);
    passed('safe timeout retry reconciliation and rejection of consumed OTP, used QR and another operation key');

    now += 61_000;
    const raced = await makeRequest();
    const racedId = raced.paymentRequest.id;
    const racedOtp = await issueCode(racedId);
    await api('post', 'otp/verify').send({ sessionId: racedOtp.sessionId, otp: racedOtp.code }).expect(200);
    const race = await Promise.all([
      api('post', 'qr/confirm-payment').send({ requestId: racedId, cardId: card.id, sessionId: racedOtp.sessionId, idempotencyKey: crypto.randomUUID() }),
      api('post', `qr/requests/${racedId}/cancel`, 'recipient').send({}),
    ]);
    assert.deepEqual(race.map(response => response.status).sort(), [200, 409]);
    const terminal = await repository.read(`paymentRequests/${racedId}/status`);
    assert.ok(['completed', 'cancelled'].includes(terminal));
    assert.equal(Object.keys(await repository.read('transactions')).length, terminal === 'completed' ? 2 : 1);
    passed('cancellation versus confirmation race has exactly one terminal outcome and no duplicate records');

    await api('post', 'auth/logout').expect(200);
    await api('get', 'auth/verify').expect(401);
    passed('logout revocation survives subsequent RTDB-backed session verification');
    console.log(`PASS: ${scenarios} real Firebase repository API scenarios; no real cards, SMS, or funds used.`);
  } finally {
    await database.ref(testPath).remove();
    await firebaseApp.delete();
    await fs.rm(outbox, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
