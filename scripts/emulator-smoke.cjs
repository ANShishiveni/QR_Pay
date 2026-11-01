const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const admin = createRequire(path.join(__dirname, '../backend/package.json'))('firebase-admin');
const { createFirebaseRepository } = require('../backend/repositories');

const projectId = 'demo-nampay';
const databaseHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.equal(databaseHost, '127.0.0.1:9000', 'Smoke tests may only touch the local RTDB emulator');
assert.equal(authHost, '127.0.0.1:9099', 'Smoke tests may only touch the local Auth emulator');
assert.equal(process.env.FIREBASE_PROJECT_ID, projectId, 'Smoke tests require the isolated demo project');
// Firebase's Node ws:// transport ignores NO_PROXY. These tests have asserted
// fixed loopback hosts, so remove only plaintext-proxy routing in this child.
// HTTPS proxy routing and certificate verification remain unchanged.
delete process.env.HTTP_PROXY;
delete process.env.http_proxy;
const namespace = `${projectId}-default-rtdb`;
const runId = randomUUID();
const databaseUrl = `http://${databaseHost}`;
const testPath = `_emulatorChecks/${runId}`;
const app = admin.initializeApp({ projectId, databaseURL: `https://${namespace}.firebaseio.com` }, `smoke-${runId}`);

async function request(path, options = {}) {
  const response = await fetch(`${databaseUrl}/${path}.json?ns=${namespace}`, options);
  return { response, data: await response.json() };
}

(async () => {
  const database = app.database();
  const repository = createFirebaseRepository(database);
  try {
    const ref = database.ref(testPath);
    await repository.set(testPath, { count: 0, fixture: 'synthetic' });
    assert.equal(await repository.read(`${testPath}/fixture`), 'synthetic');
    await repository.update({ [`${testPath}/fixture`]: 'updated' });
    assert.equal(await repository.read(`${testPath}/fixture`), 'updated');
    const results = await Promise.all(Array.from({ length: 12 }, () => repository.transaction(root => {
      root._emulatorChecks[runId].count += 1;
      return root;
    })));
    assert.ok(results.every(result => result.committed));
    assert.equal(await repository.read(`${testPath}/count`), 12, 'Concurrent RTDB transactions must not lose updates');
    const aborted = await repository.transaction(() => undefined);
    assert.equal(aborted.committed, false);
    assert.equal(await repository.read(`${testPath}/count`), 12, 'Aborting a transaction must preserve stored state');

    const deniedRead = await request(testPath);
    assert.equal(deniedRead.response.status, 401);
    assert.match(deniedRead.data.error, /permission denied/i);
    const deniedWrite = await request(testPath, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 999 }) });
    assert.equal(deniedWrite.response.status, 401);
    assert.match(deniedWrite.data.error, /permission denied/i);
    assert.equal((await ref.child('count').get()).val(), 12);

    // Authenticated Firebase clients are denied too: NamPay uses server JWTs.
    const signup = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `emulator-${runId}@example.invalid`, password: randomUUID(), returnSecureToken: true }),
    });
    assert.equal(signup.status, 200);
    const account = await signup.json();
    assert.ok(account.idToken);
    try {
      const targets = {
        [`users/${account.localId}`]: { uid: account.localId, status: 'active' },
        [`transactions/forged-${runId}`]: { userId: account.localId, status: 'completed', amountMinor: 100 },
        [`paymentRequests/forged-${runId}`]: { senderId: account.localId, requesterUid: account.localId, status: 'completed' },
        [`otpSessions/forged-${runId}`]: { userId: account.localId, status: 'verified' },
      };
      for (const [path, value] of Object.entries(targets)) {
        const authenticatedWrite = await fetch(`${databaseUrl}/${path}.json?ns=${namespace}&auth=${encodeURIComponent(account.idToken)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
        });
        assert.equal(authenticatedWrite.status, 401, `Client write must be denied at ${path.split('/')[0]}`);
        assert.match((await authenticatedWrite.json()).error, /permission denied/i);
        assert.equal((await database.ref(path).get()).exists(), false);
      }
    } finally {
      await app.auth().deleteUser(account.localId);
    }
    console.log('PASS: Firebase Auth creation/deletion, RTDB CRUD, 12 concurrent transactions, and anonymous/authenticated client rule denial (T-15).');
  } finally {
    await database.ref(testPath).remove();
    await app.delete();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
