const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { testContext } = require('./helpers/app');
const profile = (email = 'test@example.test') => ({ email, password: 'A test-only passphrase!', firstName: 'Test', lastName: 'User', phoneNumber: '+264811234567' });
const bearer = token => `Bearer ${token}`;
async function register(app, email) { return (await request(app).post('/api/auth/register').send(profile(email)).expect(201)).body; }
function context(options = {}) { return testContext({ ...options, routes: ['auth', 'users'] }); }

describe('authentication and private account APIs', () => {
  it('registers normalized UID accounts without exposing password hashes or verification secrets', async () => {
    const { app, repository } = context();
    const account = await register(app, '  TeSt@example.test  ');
    expect(account.user.email).toBe('test@example.test');
    expect(account.user.phoneVerified).toBe(false);
    expect(account.user).not.toHaveProperty('hashedPassword');
    expect(account.user).not.toHaveProperty('sessionVersion');
    const stored = await repository.read(`users/${account.user.uid}`);
    expect(stored.hashedPassword).not.toBe(profile().password);
    expect(await bcrypt.compare(profile().password, stored.hashedPassword)).toBe(true);
    const verified = await request(app).get('/api/auth/verify').set('Authorization', bearer(account.token)).expect(200);
    expect(verified.body.user.uid).toBe(account.user.uid);
  });

  it.each([
    [{ email: 'not-an-email' }, 'INVALID_EMAIL'], [{ password: 'short' }, 'INVALID_PASSWORD'],
    [{ password: 'é'.repeat(40) }, 'INVALID_PASSWORD'], [{ firstName: '<script>' }, 'INVALID_NAME'],
    [{ phoneNumber: '123' }, 'INVALID_PHONE'],
  ])('rejects malformed registration (%s)', async (changes, code) => {
    const { app, repository } = context();
    const response = await request(app).post('/api/auth/register').send({ ...profile(), ...changes }).expect(400);
    expect(response.body.code).toBe(code);
    expect(await repository.read('users')).toBe(null);
  });

  it('atomically rejects competing registrations for a normalized email', async () => {
    const { app, repository } = context();
    const responses = await Promise.all([request(app).post('/api/auth/register').send(profile()), request(app).post('/api/auth/register').send(profile('TEST@example.test'))]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect(Object.keys(await repository.read('users'))).toHaveLength(1);
  });

  it('uses identical credential errors for wrong passwords and missing accounts', async () => {
    const { app } = context();
    await register(app);
    const wrong = await request(app).post('/api/auth/login').send({ email: profile().email, password: 'incorrect-password' }).expect(401);
    const absent = await request(app).post('/api/auth/login').send({ email: 'absent@example.test', password: 'incorrect-password' }).expect(401);
    expect(wrong.body.code).toBe(absent.body.code);
    expect(wrong.body.error).toBe(absent.body.error);
    expect(wrong.body).not.toHaveProperty('details');
  });

  it('T-13 rejects expired, forged, wrong-audience, missing-claim and missing tokens', async () => {
    let now = Date.now();
    const { app, config } = context({ config: { now: () => now } });
    const account = await register(app);
    await request(app).get('/api/auth/verify').expect(401);
    await request(app).get('/api/auth/verify').set('Authorization', 'Bearer invalid-token').expect(401);
    const claims = { uid: account.user.uid, sv: 0 };
    const options = { algorithm: 'HS256', subject: account.user.uid, issuer: 'nampay-api', audience: 'nampay-client', jwtid: crypto.randomUUID(), expiresIn: '1h' };
    for (const token of [jwt.sign(claims, crypto.randomBytes(48), options), jwt.sign(claims, config.jwtSecret, { ...options, audience: 'other-service' }), jwt.sign({ uid: account.user.uid }, config.jwtSecret, options), jwt.sign(claims, config.jwtSecret, { algorithm: 'HS256', subject: account.user.uid, issuer: 'nampay-api', audience: 'nampay-client', jwtid: crypto.randomUUID() })]) {
      await request(app).get('/api/auth/verify').set('Authorization', bearer(token)).expect(401);
    }
    now += 3601 * 1000;
    await request(app).get('/api/auth/verify').set('Authorization', bearer(account.token)).expect(401);
  });

  it('T-13 rejects a correctly signed token from a different issuer', async () => {
    const { app, config } = context();
    const account = await register(app);
    await request(app).get('/api/auth/verify').set('Authorization', bearer(account.token)).expect(200);

    const claims = jwt.decode(account.token);
    const otherIssuerToken = jwt.sign({ ...claims, iss: 'another-application' }, config.jwtSecret, { algorithm: 'HS256' });
    // Signature, current account, audience, expiry and session claims remain valid.
    expect(jwt.verify(otherIssuerToken, config.jwtSecret, { algorithms: ['HS256'] }).aud).toBe(config.jwtAudience);
    const response = await request(app).get('/api/auth/verify').set('Authorization', bearer(otherIssuerToken)).expect(401);
    expect(response.body.code).toBe('SESSION_EXPIRED');
    expect(response.body).not.toHaveProperty('user');
  });

  it('rejects disabled accounts and revokes only the logged-out session', async () => {
    const { app, repository } = context();
    const account = await register(app);
    const other = (await request(app).post('/api/auth/login').send(profile()).expect(200)).body;
    await request(app).post('/api/auth/logout').set('Authorization', bearer(account.token)).expect(200);
    await request(app).get('/api/auth/verify').set('Authorization', bearer(account.token)).expect(401);
    await request(app).get('/api/auth/verify').set('Authorization', bearer(other.token)).expect(200);
    await repository.set(`users/${account.user.uid}/status`, 'disabled');
    await request(app).get('/api/auth/verify').set('Authorization', bearer(other.token)).expect(401);
    await request(app).post('/api/auth/login').send(profile()).expect(401);
  });

  it('uses HttpOnly strict cookies for web and blocks cross-origin mutations', async () => {
    const { app } = context();
    await register(app);
    const login = await request(app).post('/api/auth/login').set('X-Client-Platform', 'web').set('Origin', 'http://localhost:19006').send(profile()).expect(200);
    expect(login.body).not.toHaveProperty('token');
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Strict'); expect(cookie).toContain('Path=/api');
    await request(app).get('/api/auth/verify').set('Cookie', cookie).expect(200);
    await request(app).put('/api/users/profile').set('Cookie', cookie).send({ firstName: 'Changed' }).expect(403);
    await request(app).put('/api/users/profile').set('Cookie', cookie).set('Origin', 'https://attacker.example').send({ firstName: 'Changed' }).expect(403);
    await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Origin', 'http://localhost:19006').expect(200);
    await request(app).get('/api/auth/verify').set('Cookie', cookie).expect(401);
  });

  it('T-14 rejects another profile identity and sensitive contact or verification edits', async () => {
    const { app } = context();
    const account = await register(app);
    const token = bearer(account.token);
    await request(app).get('/api/users/profile?uid=someone-else').set('Authorization', token).expect(403);
    await request(app).put('/api/users/profile').set('Authorization', token).send({ uid: 'someone-else', firstName: 'Victim' }).expect(403);
    await request(app).put('/api/users/profile').set('Authorization', token).send({ phoneVerified: true }).expect(400);
    await request(app).put('/api/users/profile').set('Authorization', token).send({ phoneNumber: '+264811234568' }).expect(409);
    const updated = await request(app).put('/api/users/profile').set('Authorization', token).send({ firstName: '  Revised ' }).expect(200);
    expect(updated.body.user.firstName).toBe('Revised');
    expect(updated.body.user).not.toHaveProperty('hashedPassword');
  });

  it('persists validated preferences and rejects malformed photos', async () => {
    const { app } = context();
    const token = bearer((await register(app)).token);
    await request(app).put('/api/users/preferences').set('Authorization', token).send({ theme: 'dark', notifications: false }).expect(200);
    const result = await request(app).get('/api/users/profile').set('Authorization', token).expect(200);
    expect(result.body.user.preferences).toMatchObject({ theme: 'dark', notifications: false });
    await request(app).put('/api/users/preferences').set('Authorization', token).send({ theme: 'invalid' }).expect(400);
    await request(app).post('/api/users/photo').set('Authorization', token).send({ photo: 'data:image/png;base64,SGVsbG8=' }).expect(400);
    await request(app).post('/api/users/photo').set('Authorization', token).send({ photo: 'data:image/svg+xml;base64,PHN2Zy8+' }).expect(400);
  });

  it('requires password reauthentication and revokes all old sessions after a change', async () => {
    const { app } = context();
    const account = await register(app);
    const nextPassword = 'A different test passphrase!';
    await request(app).put('/api/users/password').set('Authorization', bearer(account.token)).send({ currentPassword: 'wrong', newPassword: nextPassword }).expect(401);
    await request(app).put('/api/users/password').set('Authorization', bearer(account.token)).send({ currentPassword: profile().password, newPassword: nextPassword }).expect(200);
    await request(app).get('/api/auth/verify').set('Authorization', bearer(account.token)).expect(401);
    await request(app).post('/api/auth/login').send(profile()).expect(401);
    await request(app).post('/api/auth/login').send({ email: profile().email, password: nextPassword }).expect(200);
  });

  it('copies legacy users only after verified login, retains records and rejects stale password fallback', async () => {
    const legacyKey = 'legacy@example_test';
    const user = { ...profile('legacy@example.test'), uid: 'legacy-uid', hashedPassword: await bcrypt.hash(profile().password, 10), cards: { oldCard: { last4: '4242' } } };
    delete user.password;
    const { app, repository } = context({ seed: { users: { [legacyKey]: user }, transactions: { historical: { userId: user.uid, amount: 25, type: 'send' } } } });
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'bad' }).expect(401);
    expect(await repository.read(`users/${user.uid}`)).toBeNull();
    const logged = (await request(app).post('/api/auth/login').send({ email: user.email, password: profile().password }).expect(200)).body;
    expect(await repository.read(`users/${user.uid}/cards/oldCard/last4`)).toBe('4242');
    expect(await repository.read(`users/${legacyKey}`)).toEqual(user);
    await repository.set(`users/${user.uid}/cards/oldCard/last4`, '0000');
    expect(await repository.read(`users/${legacyKey}/cards/oldCard/last4`)).toBe('4242');
    expect(await repository.read('transactions/historical')).toEqual({ userId: user.uid, amount: 25, type: 'send' });
    await request(app).put('/api/users/password').set('Authorization', bearer(logged.token)).send({ currentPassword: profile().password, newPassword: 'New legacy test passphrase!' }).expect(200);
    await request(app).post('/api/auth/login').send({ email: user.email, password: profile().password }).expect(401);
  });

  it('enforces authentication attempt limits', async () => {
    const { app } = context({ config: { authLimit: 1 } });
    app.set('trust proxy', 1);
    await request(app).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.70').send({ email: 'none@example.test', password: 'bad' }).expect(401);
    await request(app).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.70').send({ email: 'none@example.test', password: 'bad' }).expect(429);
  });
});

describe('password recovery proof', () => {
  let outbox;
  beforeEach(async () => { outbox = await fs.mkdtemp(path.join(os.tmpdir(), 'nampay-auth-test-')); });
  afterEach(async () => { await fs.rm(outbox, { recursive: true, force: true }); });
  it('uses a private one-time proof, generic responses, and invalidates old sessions', async () => {
    const { app, repository } = context({ config: { authOutboxDir: outbox } });
    const account = await register(app);
    const missing = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.test' }).expect(202);
    const existing = await request(app).post('/api/auth/forgot-password').send({ email: profile().email }).expect(202);
    expect(existing.body).toEqual(missing.body); expect(existing.body).not.toHaveProperty('token');
    const [file] = await fs.readdir(outbox);
    const delivery = JSON.parse(await fs.readFile(path.join(outbox, file), 'utf8'));
    expect((await fs.stat(path.join(outbox, file))).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(await repository.read())).not.toContain(delivery.token);
    await request(app).post('/api/auth/reset-password').send({ token: '0'.repeat(64), newPassword: 'A new recovered passphrase!' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token: delivery.token, newPassword: 'A new recovered passphrase!' }).expect(200);
    await request(app).get('/api/auth/verify').set('Authorization', bearer(account.token)).expect(401);
    await request(app).post('/api/auth/reset-password').send({ token: delivery.token, newPassword: 'Another attempted passphrase!' }).expect(400);
    await request(app).post('/api/auth/login').send({ email: profile().email, password: 'A new recovered passphrase!' }).expect(200);
  });
  it('rejects expired proof and preserves the existing password', async () => {
    let now = Date.now();
    const { app } = context({ config: { authOutboxDir: outbox, now: () => now } });
    await register(app);
    await request(app).post('/api/auth/forgot-password').send({ email: profile().email }).expect(202);
    const [file] = await fs.readdir(outbox);
    const { token } = JSON.parse(await fs.readFile(path.join(outbox, file), 'utf8'));
    now += 16 * 60 * 1000;
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Expired proof passphrase!' }).expect(400);
    await request(app).post('/api/auth/login').send(profile()).expect(200);
  });
});
