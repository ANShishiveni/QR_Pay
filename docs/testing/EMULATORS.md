# Local Firebase emulators

NamPay's isolated development project is **`demo-nampay`**. The `demo-` prefix
prevents accidental use of a real Firebase project for services not running in
the Emulator Suite. No Google login, service-account key, real SMS provider, or
real card is needed. The app's simulated payments remain server-authorized.

## Toolchain and installation

Validated tooling: Node `24.19.0`, npm `11.9.0`, Java `21.0.12.1`, and Firebase CLI
`15.34.0`. The CLI is separate from the application dependency graph and pinned
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

Run the backend in a separate terminal after emulator startup, using the
application's documented demo/start command and these Firebase values:

```bash
export FIREBASE_PROJECT_ID=demo-nampay
export GCLOUD_PROJECT=demo-nampay
export FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export NODE_ENV=development
export OTP_PROVIDER=mock
```

The RTDB namespace is `demo-nampay-default-rtdb`; the Admin SDK database URL is
`https://demo-nampay-default-rtdb.firebaseio.com`. With the emulator host set,
the SDK sends database operations to local port 9000. The backend must reject
production mock/emulator configurations. Never use a real database project or
service-account PEM to work around a local emulator error.

## Reproducible checks

This starts fresh Auth and RTDB emulators, runs the smoke test, preserves its
exit status, and stops the processes:

```bash
bash scripts/emulators.sh exec 'node scripts/emulator-smoke.cjs'
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

## Current validation evidence and network blocker

On 20 October 2026, the Auth functional smoke test completed successfully and
the CLI shut down its emulators with exit status 0. The installation wrapper
was rerun using the external tooling directory; frozen-lockfile installation
completed and reported CLI `15.34.0`. Shell syntax checks and Node syntax checks
for all emulator scripts also passed.

The full RTDB smoke command is **blocked, not passed**: the cloud egress proxy
returned **HTTP 403 to the CONNECT request for `storage.googleapis.com`**, where
Firebase hosts its official database emulator Java artifact. Therefore RTDB
CRUD, transaction behavior, and T-15 rule enforcement remain **not verified in
the real emulator** until that destination is allowed at runtime.

Required download:

```text
https://storage.googleapis.com/firebase-preview-drop/emulator/firebase-database-emulator-v4.11.2.jar
Size: 34495935 bytes
MD5: 2fd771101c0e1f7898c04c9204f2ce63
SHA256: b70d99344caf17c98b6f910fa8f6edf32a7c016cb1035e8915f70d38901eb97f
```

These values come from the pinned CLI's official
`firebase-tools/lib/emulator/downloadableEmulatorInfo.json`. The CLI performs
its size and MD5 checks before caching this artifact; the SHA256 is recorded
here from the same metadata. TLS and checksum verification remain enabled.
No mirror, proxy bypass, custom artifact, or checksum override was used.

The environment draft adds `storage.googleapis.com` to the custom allowlist,
preserving existing package-manager presets. A draft save does not apply the
running network policy. Once the user applies the setting, rerun the full smoke
command above and update this evidence. A nonfatal CLI MOTD/config warning does
not prevent Auth emulator functionality and does not justify broader access.
