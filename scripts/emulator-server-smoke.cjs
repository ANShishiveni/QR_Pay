const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

// Run through emulators.sh. Refuse external hosts before changing any proxy
// routing or initializing the application's default Firebase Admin app.
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:9000');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIREBASE_PROJECT_ID, 'demo-nampay');
delete process.env.HTTP_PROXY;
delete process.env.http_proxy;
Object.assign(process.env, {
  NODE_ENV: 'development', DEMO_MODE: 'true', DATABASE_MODE: 'firebase', OTP_PROVIDER: 'mock',
  GCLOUD_PROJECT: 'demo-nampay', FIREBASE_DATABASE_URL: 'https://demo-nampay-default-rtdb.firebaseio.com',
  HOST: '127.0.0.1', PORT: '0', JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
  QR_SIGNING_SECRET: crypto.randomBytes(48).toString('base64url'),
});

(async () => {
  const deadline = setTimeout(() => {
    console.error('FAIL: emulator application startup exceeded 45 seconds');
    process.exit(1);
  }, 45_000);
  deadline.unref();
  const outbox = await fs.mkdtemp(path.join(os.tmpdir(), 'nampay-startup-'));
  process.env.OTP_OUTBOX_DIR = outbox;
  process.env.AUTH_OUTBOX_DIR = outbox;
  const { startServer } = require('../backend/server');
  const { admin } = require('../backend/config/firebase');
  const email = `startup-${crypto.randomUUID()}@example.invalid`;
  const indexPath = `emailIndex/${crypto.createHash('sha256').update(email).digest('hex')}`;
  let running;
  try {
    // Exercise the real initializer, default Admin app and listening server,
    // without substituting the repository or its root reference.
    running = startServer();
    await once(running.server, 'listening');
    assert.equal(running.server.address().address, '127.0.0.1');
    const origin = `http://127.0.0.1:${running.server.address().port}`;
    const call = async (route, options = {}) => {
      const response = await fetch(`${origin}/api/${route}`, {
        ...options, signal: AbortSignal.timeout(15_000),
      });
      return { status: response.status, body: await response.json() };
    };
    const health = await call('health');
    assert.equal(health.status, 200, 'Health endpoint must accept the emulator configuration');
    assert.equal(health.body.status, 'OK');
    assert.equal(health.body.environment, 'development');
    assert.equal(health.body.database, 'firebase');
    assert.equal(health.body.simulated, true);
    const password = crypto.randomBytes(24).toString('base64url');
    const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const registration = await call('auth/register', json({ email, password, firstName: 'Synthetic', lastName: 'Startup' }));
    assert.equal(registration.status, 201, 'Registration must persist through the initialized Firebase repository');
    const uid = registration.body.user.uid;
    assert.equal(await running.repository.read(indexPath), uid);
    const stored = await running.repository.read(`users/${uid}`);
    assert.equal(stored.email, email);
    assert.ok(stored.hashedPassword);
    assert.equal(stored.password, undefined);
    const login = await call('auth/login', json({ email, password }));
    assert.equal(login.status, 200, 'Login must read the stored Firebase account');
    assert.equal(login.body.user.uid, uid);
    const verified = await call('auth/verify', { headers: { Authorization: `Bearer ${login.body.token}` } });
    assert.equal(verified.status, 200, 'Session verification must accept the issued token');
    assert.equal(verified.body.user.uid, uid);
  } finally {
    try {
      if (running) {
        await new Promise((resolve, reject) => running.server.close(error => error ? reject(error) : resolve()));
        const uid = await running.repository.read(indexPath);
        if (uid) {
          const record = await running.repository.read(`users/${uid}`);
          assert.equal(record?.email, email, 'Cleanup must target only this synthetic account');
          await running.repository.update({ [indexPath]: null, [`users/${uid}`]: null });
          assert.equal(await running.repository.read(indexPath), null);
          assert.equal(await running.repository.read(`users/${uid}`), null);
        }
      }
    } finally {
      if (running) await running.repository.close();
      await Promise.all(admin.apps.map(app => app.delete()));
      await fs.rm(outbox, { recursive: true, force: true });
      clearTimeout(deadline);
    }
  }
  console.log('PASS: real startServer/initializeFirebase on loopback, Firebase health, registration persistence, login, session verification and scoped cleanup.');
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
