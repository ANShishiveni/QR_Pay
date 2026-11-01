const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
const endpoint = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

async function call(method, data) {
  const response = await fetch(`${endpoint}/accounts:${method}?key=emulator-only`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}

(async () => {
  const email = `auth-smoke-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const created = await call('signUp', { email, password, returnSecureToken: true });
  assert.equal(created.status, 200);
  try {
    assert.ok(created.body.localId);
    const login = await call('signInWithPassword', { email, password, returnSecureToken: true });
    assert.equal(login.status, 200);
    assert.equal(login.body.localId, created.body.localId);
    const wrongPassword = await call('signInWithPassword', { email, password: randomUUID(), returnSecureToken: true });
    assert.equal(wrongPassword.status, 400);
    const duplicate = await call('signUp', { email, password, returnSecureToken: true });
    assert.equal(duplicate.status, 400);
    console.log('PASS: Firebase Auth emulator registration, login, wrong-password rejection, duplicate rejection.');
  } finally {
    const removed = await call('delete', { idToken: created.body.idToken });
    assert.equal(removed.status, 200);
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
