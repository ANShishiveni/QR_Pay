# NamPay 2.0 demonstration candidate

Package version: **2.0.0-demo.0**. App version: **2.0.0**. Prepared 31 October 2026.
This is a simulated-payment prototype. No real funds, bank settlement, card
capture, paid SMS or production provider integration is enabled. Native release
acceptance remains incomplete; this is not an approved production release.

## Preserved payment journey and completed features

A requester creates an amount and five-minute QR. Another account scans or
imports its image, reviews the authoritative details, selects a predefined test
instrument and enters a server-generated private verification code. One atomic
commit consumes the authorization and creates the canonical transaction, both
histories and receipts. A lost response enters an uncertain state until a
read-only status check obtains the result. Writes are never replayed on reconnect.

The redesign adds shared light/dark/system themes, onboarding, protected four-tab
navigation, request management, server-derived dashboard totals, test-card
management, activity filters/pagination, transaction details and simulated receipt
exports. Profile/photo consent, password recovery/change, account preferences,
optional local biometric confirmation and an owned notification inbox are wired
to real routes. Empty/error/loading states, keyboard focus, dialog handling,
offline drafts and foreground reconciliation have automated/browser coverage.
See [feature inventory](FEATURE_INVENTORY.md) and [screenshots](../design/SCREENSHOTS.md).

## Security and compatibility

Sessions validate issuer, audience, expiry and server revocation. Native storage
uses SecureStore; web uses HttpOnly cookies and exact-origin mutation checks.
Recovery requires an expiring one-use proof. OTPs bind payer, request, amount
and purpose, enforce attempt/resend limits, and are consumed atomically.

The final regression review found and fixed cross-request reuse of a payer's
committed operation key. A hashed per-payer key binding now shares the settlement
transaction; changed details return 409 while exact retries return the original
result. Historical pre-index fingerprints cannot reveal their original keys;
an exact legacy retry adds a binding. Existing UID/history records are retained
through additive compatibility adapters. No production migration was executed.
See [payment contracts](../api/PAYMENTS_V2.md) and [security decisions](../security/SECURITY_DECISIONS.md).

Web now uses Metro on port 8081. The retained HTML root was corrected after a
browser regression exposed a collapsed navigation container. Expo 53.0.27 uses
React/React DOM 19.0.0, React Native 0.79.6 and TypeScript 5.8.3. Removed obsolete
Webpack/browser shims and unused client SDKs; scoped, hash-checked dependency
adapters keep the validated framework line. The 30 October audits report zero
high/critical matches, with **14 backend** and **19 frontend** moderate/low nodes
remaining. This is not a zero-findings audit. [Details and follow-up](../security/DEPENDENCY_AUDIT.md).

## Executed verification

The following completed on 30 October after the final code/dependency changes:

| Command from repository root | Result |
| --- | --- |
| `npm ci`; backend `npm ci`; frontend `npm ci --legacy-peer-deps` | Clean lockfile installation; both dependency adapters reproduced |
| `npm run check` | ESLint, source self-tests, 157 source files/14 configs with zero targeted findings, patch integrity and compatibility smoke passed |
| `npm test` | **115 backend tests/7 suites; 368 frontend tests/33 suites passed** |
| `npm run typecheck` | Passed |
| `NAMPAY_EMULATOR_TOOLS=/workspace/qr-pay-emulator-tools npm run test:emulators` | All three scripts passed: real rules/CRUD/Auth, 12 concurrent increments, **9 payment scenarios**, actual server startup/persistence |
| `npm run test:browser` | All five disposable Chromium runs passed: auth/recovery/privacy, two-account payment, features, reliability with normal/reduced motion |
| `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://demo-api.example.invalid npm --prefix frontend run build:bundles` | Web plus Android/iOS Hermes exports passed |
| `npm audit --json`; `npm audit --omit=dev --json` in all three roots | No high/critical matches; lower-severity findings remain |

The real Firebase suite verifies both eight competing confirmations of one
request and two distinct requests competing for the same payer operation key.
Each race yields one canonical transaction. The browser drops a response after
commit and reconciles without a second confirmation. Recovery failure/throttling,
private logs, malformed QR bounds and cross-account limits have explicit tests.
Full scope and remaining layer-specific gaps are in the [test matrix](../testing/TEST_MATRIX.md).

Local logs are in ignored `.local/evidence/`; regenerate them in a fresh checkout.
The GitHub workflow defines frozen installs, static/audit gates, unit/type checks,
real emulators, exports and browser journeys. Remote CI status must be verified
on the pull request; the workflow's presence alone is not a passing run.

## Build outputs and outstanding release gates

`frontend/dist-native` contains web and native JavaScript/assets. Run
`EXPO_PUBLIC_API_URL=https://demo-api.example.invalid node scripts/package-demo.cjs`
after export to create a versioned archive and SHA256 manifest in
`.local/artifacts`. The placeholder origin is non-resolving; this output proves
compilation and is **not an APK, IPA or configured deployment**.

Android build configuration and a guarded local helper are included. The actual
31 October preflight reports missing SDK Platform 35, Build-Tools 35, adb, NDK,
CMake and SDK license acceptance. Java and dependency-patch checks pass. An
authorized person must review/accept the Android SDK agreement before installing
those components. No agreement or paid EAS build was initiated automatically.

Physical Android and Android emulator acceptance remain mandatory: installation,
SecureStore restart/logout, camera/gallery/share, biometrics, keyboard/safe areas,
offline/background recovery and TalkBack. iOS hardware/macOS is unavailable.
Browser CSS zoom does not establish native font-scaling or screen-reader support;
complete dark/wide/enlarged-text composition review remains outstanding. Follow
[native acceptance](../testing/NATIVE_ACCEPTANCE.md) before claiming release readiness.

The cloud startup instructions were saved with Metro and the complete local test
workflow. Saving a draft does not publish it or prove restoration in a new task;
review/save the environment settings and publish separately.
