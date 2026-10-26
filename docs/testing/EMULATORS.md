# Local Firebase emulators

NamPay's isolated development project is **`demo-nampay`**. The `demo-` prefix
prevents accidental use of a real Firebase project for services not running in
the Emulator Suite. No Google login, service-account key, real SMS provider, or
real card is needed. The app's simulated payments remain server-authorized.

## Toolchain and installation

Validated tooling: Node `24.19.0`, npm `11.9.0`, Java `21.0.12.1`, and Firebase CLI
`15.1.0`. The CLI is separate from the application dependency graph and pinned
by `scripts/install-emulators.sh`; its local installation has an npm lockfile.

From the repository root:

```bash
bash scripts/install-emulators.sh
bash scripts/emulators.sh start
```

The default tooling/cache directory is `.cache/firebase-tools/`. In the Codex
cloud workspace the tested external installation is:

```bash
export NAMPAY_EMULATOR_TOOLS=/workspace/qr-pay-emulator-tools
bash scripts/emulators.sh start
```

`scripts/emulators.sh` supports only `start` and `exec`; it cannot deploy a
Firebase project. Both modes force `demo-nampay`, load `firebase.json`, and bind
services to loopback. The Emulator UI is disabled because it is not needed for
automated or application tests.

| Service | Bind address |
| --- | --- |
| Realtime Database | `127.0.0.1:9000` |
| Authentication | `127.0.0.1:9099` |
| Emulator hub | `127.0.0.1:4400` |
| Emulator logging | `127.0.0.1:4500` |

Live processes do not survive cloud environment snapshots. Start the emulators
again in each new task. The default flow starts empty disposable state; it does
not import or export user data.

## Application environment

Run the backend from the repository root in a separate terminal after emulator
startup. This command explicitly selects the local Firebase demo and binds the
API to loopback:

```bash
env -u HTTP_PROXY -u http_proxy \
  NODE_ENV=development DEMO_MODE=true DATABASE_MODE=firebase OTP_PROVIDER=mock \
  FIREBASE_PROJECT_ID=demo-nampay GCLOUD_PROJECT=demo-nampay \
  FIREBASE_DATABASE_URL=https://demo-nampay-default-rtdb.firebaseio.com \
  FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 \
  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  HOST=127.0.0.1 PORT=3000 \
  node backend/server.js
```

The RTDB namespace is `demo-nampay-default-rtdb`; the Admin SDK database URL is
`https://demo-nampay-default-rtdb.firebaseio.com`. With the emulator host set,
the SDK sends database operations to local port 9000. The backend must reject
production mock/emulator configurations. Never use a real database project or
service-account PEM to work around a local emulator error.

When running the emulator-backed Node server behind this cloud environment's
proxy, use `env -u HTTP_PROXY -u http_proxy node backend/server.js`. The Firebase
Node SDK ignores `NO_PROXY` for its local `ws://` connection. This change is
scoped to that emulator-only process: `HTTPS_PROXY`/`https_proxy`, certificate
verification, and remote HTTPS routing remain unchanged. Do not use these
settings for a live project.

## Reproducible checks

This starts fresh Auth and RTDB emulators, runs all three smoke scripts, preserves their
exit status, and stops the processes:

```bash
bash scripts/emulators.sh exec 'node scripts/emulator-smoke.cjs && node scripts/emulator-payment-smoke.cjs && node scripts/emulator-server-smoke.cjs'
```

The smoke test uses random synthetic identifiers and checks:

- Application Firebase repository create/read/update/remove against real RTDB
  emulator storage through the Admin SDK.
- Twelve concurrent atomic increments with no lost writes and an aborted
  transaction that preserves state.
- Anonymous client reads and writes denied by Firebase rules.
- Firebase-authenticated attempts to write user records, completed
  transactions, payment requests, and verified OTP sessions denied (T-15).
- Auth emulator account creation and cleanup.

It touches only its own synthetic records and refuses non-loopback emulator
addresses. No mocked database response is used for these checks.

The second script runs **eight API integration scenarios against the actual
Firebase repository**, using real Admin SDK references scoped to a unique test
subtree. It validates three account registrations/logins, test cards and signed
QR validation, a CSPRNG OTP delivered to a private local inbox, eight concurrent
confirmations resulting in exactly one transaction, consistent participant
histories/receipts, replay rejection and idempotent retries, cancellation racing
confirmation, and logout revocation. It deletes only its own test subtree and
private inbox when finished. The OTP is not injected into database state or
returned by the API; the script obtains it from the mock provider's private
delivery file as a local tester would.

The third script calls the real `startServer()` entry point, including
`initializeFirebase()` and the default Admin app. It uses the same application
environment shown above, with an ephemeral loopback API port and disposable
signing keys. Real HTTP requests verify Firebase health, registration, login
and session verification; direct repository reads confirm persistence. It
deletes only its synthetic account and email index, then closes the API,
repository and Admin app. It does not replace the repository's root reference.

Auth can also be validated independently when the database Java artifact is
unavailable. In the cloud workspace this exact command was executed:

```bash
FIREBASE_CLI_DISABLE_TELEMETRY=1 \
GCLOUD_PROJECT=demo-nampay FIREBASE_PROJECT_ID=demo-nampay \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
/workspace/qr-pay-emulator-tools/node_modules/.bin/firebase \
  emulators:exec --only auth --project demo-nampay \
  --config firebase.json --non-interactive \
  'node scripts/auth-emulator-smoke.cjs'
```

That functional test creates a synthetic account, signs in, rejects a wrong
password, rejects duplicate registration, and deletes its account. It never
prints passwords or ID tokens.

## Firebase access model

`backend/database.rules.json` denies all direct client reads and writes,
including Firebase-authenticated clients. NamPay uses an Express-validated JWT
model; the mobile/web clients access protected data through the API. Backend
Admin SDK calls bypass Firebase rules, so API authorization, ownership, OTP
binding, and payment invariants must be independently tested. Firebase rules
are not a replacement for those checks.

This closes the old rule allowing any authenticated client to write a
transaction. It does not modify or delete historical records, change database
paths, or deploy rules to a real Firebase project. Legacy UID/path compatibility
belongs to the backend repository adapters and their fixture tests.

## Current validation evidence

On 26 October 2026, this exact command completed with exit status **0**:

```bash
NAMPAY_EMULATOR_TOOLS=/workspace/qr-pay-emulator-tools \
bash scripts/emulators.sh exec 'node scripts/emulator-smoke.cjs && node scripts/emulator-payment-smoke.cjs && node scripts/emulator-server-smoke.cjs'
```

Results: Firebase Auth creation/deletion, real RTDB repository CRUD, **12
concurrent increments**, an aborted transaction, anonymous client read/write
denial, and authenticated write denial on four sensitive data paths all passed.
The second script reported **8 of 8 real Firebase-backed API scenarios passed**,
including **8 concurrent payment confirmations creating exactly 1 canonical
transaction**. The third script passed real application initialization, Firebase
health, registration persistence, login, session verification and cleanup. These
are functional script checks, not an additional Jest test count. All emulator
listeners were closed after successful cleanup. The first two scripts also
passed on 22 October; the full run above followed the root-read correction below.

The earlier Auth-only test also passed registration, login, wrong-password
rejection, duplicate-registration rejection, and cleanup. Shell syntax checks,
Node syntax checks, and whitespace checks for the emulator scripts passed.

The official RTDB artifact was downloaded through the supplied HTTPS proxy;
its expected size and independent SHA256 check both matched:

```text
https://storage.googleapis.com/firebase-preview-drop/emulator/firebase-database-emulator-v4.11.2.jar
Size: 34495935 bytes
MD5: 2fd771101c0e1f7898c04c9204f2ce63
SHA256: b70d99344caf17c98b6f910fa8f6edf32a7c016cb1035e8915f70d38901eb97f
```

These values come from the pinned CLI's official
`firebase-tools/lib/emulator/downloadableEmulatorInfo.json`. The CLI performs
its size and MD5 checks before caching this artifact. `sha256sum` independently
confirmed the SHA256 listed above. TLS and checksum verification remain enabled;
no alternate artifact host or verification override was used.

## Resolved environment issues

The application-startup check found that `createFirebaseRepository.read()` passed
an empty string to `database.ref('')`, which the real SDK rejects. Registration
worked because it used a transaction, but login returned HTTP 500 when reading
the root. The adapter now calls `database.ref()` for a root read and retains
explicit child paths. A focused regression and the actual server startup check
cover this case; subtree-scoped integration alone did not expose it.

The initial `storage.googleapis.com` CONNECT request returned HTTP 403. The
environment allowlist was updated and a later runtime download succeeded; this
is no longer a blocker. A saved draft alone was not treated as proof of access.

Firebase CLI `15.34.0` ignored `NO_PROXY` when uploading rules and routed local
emulator requests through egress. Official CLI `15.1.0` supports Node 24 and uses
`proxy-agent`, which honors loopback exclusions. The wrapper now appends only
`localhost` and `127.0.0.1` to `NO_PROXY`/`no_proxy`, retaining all existing
entries and external proxy settings. Both CLI releases use the same official
RTDB `4.11.2` artifact.

The Firebase Node SDK independently ignores those exclusions for `ws://`.
Each smoke script first checks exact loopback hosts and the demo project, then
removes only `HTTP_PROXY`/`http_proxy` in its own process. External HTTPS remains
proxied and verified. In Codex, local listener creation also needs scoped
execution outside the default sandbox; its initial `EPERM` was not a port
conflict and did not justify changing the bind address.
