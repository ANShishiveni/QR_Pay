# NamPay 2.0 — simulated QR payments

NamPay is a sandbox prototype for requesting and approving **simulated** NAD
payments. It moves no real money, connects to no bank or payment processor, and
collects no real card numbers or security codes. Receipts are demonstration
records, not proof of bank settlement.

A requester creates a five-minute QR. A different account scans it or imports
its image, reviews the server amount and recipient, chooses a predefined test
instrument, and enters a server-generated verification code. One atomic commit
records the simulation for both accounts. A lost response is reconciled before
the app reports a result.

## Run locally

Use Node 24 and npm 11; Java 21 is needed for Firebase emulators. From the repository
root:

```sh
npm ci
npm --prefix backend ci
npm --prefix frontend ci --legacy-peer-deps
```

Start the disposable memory API:

```sh
NODE_ENV=development DEMO_MODE=true DATABASE_MODE=memory OTP_PROVIDER=mock \
  OTP_OUTBOX_DIR="$(pwd)/.local/outbox" npm --prefix backend start
```

In another terminal:

```sh
EXPO_PUBLIC_API_URL=http://localhost:3000 npm --prefix frontend run web -- --localhost
```

Open **http://localhost:8081**. Use localhost consistently for browser cookies.
Register synthetic accounts; there are no public/default credentials. Mock OTP
and recovery messages go to the private local outbox, never a public endpoint.
Restarting the memory API clears its data and invalidates its sessions/QRs.
See [setup](docs/SETUP.md) for private delivery, native hosts and Firebase.

## Included

- Light/dark/system appearance, onboarding and protected four-tab navigation.
- Verified sessions, logout, local mock password recovery and password changes.
- Request creation, expiry, list, cancellation, sharing and new-request regeneration.
- Camera/gallery QR validation, authoritative review, bound OTP and exact retry.
- Server totals, predefined cards, activity filters/pagination and simulated receipts.
- Profile names/photo preview, appearance/security preferences and in-app inbox.
- Offline draft protection, foreground reconciliation, keyboard and ARIA fixes.

The [feature inventory](docs/implementation/FEATURE_INVENTORY.md) describes each
flow and unavailable capabilities. The [screenshot gallery](docs/design/SCREENSHOTS.md)
records browser evidence. [Architecture](docs/architecture/ARCHITECTURE.md) and
[API contracts](docs/api/CONTRACT.md) explain ownership and retained legacy data.

## Verify

```sh
npm run check
npm test
npm run typecheck
npm run emulators:install
npm run test:emulators
npm run test:browser
```

The browser runner starts its own disposable API and Metro server; ports 3000 and
8081 must be free. Chromium is required. Emulator checks use only `demo-nampay`
on loopback. See [test matrix](docs/testing/TEST_MATRIX.md) for exact evidence and
[security decisions](docs/security/SECURITY_DECISIONS.md) for restrictions.

## Release status

This branch is a demonstration candidate, **not approved for production**.
Native install/device, SecureStore lifecycle, camera/share, biometrics and
TalkBack/VoiceOver checks remain outstanding. Browser zoom testing does not
establish native font-scaling acceptance. See [native acceptance](docs/testing/NATIVE_ACCEPTANCE.md),
[dependency audit](docs/security/DEPENDENCY_AUDIT.md), and the live
[progress tracker](docs/implementation/PROGRESS.md). No real-provider credentials
or production data are needed for the automated checks.

License: MIT.
