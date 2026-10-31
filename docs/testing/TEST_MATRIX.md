# NamPay 2.0 test matrix

Updated: 31 October 2026; final automated runs completed 30 October 2026.
Source: implementation blueprint, sections 14–15.
This is a living evidence register, not a declaration that planned checks passed.
All payment fixtures must be synthetic and all transfers simulated. No test may
contact a production database, send paid SMS, accept real cards or create charges.

## Baseline evidence

The initial checkout is `998d2ec571289edbf777a52d9edea50652cf257b`.

| Check | Command / scope | Observed baseline result |
| --- | --- | --- |
| Toolchain | `node --version`; `npm --version` | Node 24.19.0; npm 11.9.0 |
| Root dependencies | `npm ci --cache /workspace/.cache/npm --no-audit --no-fund` | Passed; committed lockfile preserved |
| Backend dependencies | Same command from `backend/` | Passed; committed lockfile preserved |
| Frontend dependencies | `npm ci --legacy-peer-deps --cache /workspace/.cache/npm --no-audit --no-fund` from `frontend/` | Passed; legacy peer flag required by the documented dependency combination |
| Original backend suite | `cd backend && npm test -- --runInBand --ci` | Two suites failed before test execution: undeclared `supertest`; **zero tests executed** |
| Original API startup | `cd backend && npm start` | Failed: Firebase configuration missing; no successful API request |
| Backend import defect | `backend/routes/auth.js:8`, `backend/routes/otp.js:12` | Confirmed by code: `const jwtSecret = jwtSecret` prevents route initialization; missing credentials are a separate blocker |
| Frontend browser smoke | `/workspace/qr-pay-tools/browser-smoke.cjs`, executed by onboarding agent | Login rendered, registration opened, empty registration rejected, no uncaught browser errors; no account/payment/SMS created |
| Original web startup port | `npm run web -- --localhost --port 19006` | Failed because Metro took Webpack's port; omit the override so Metro uses 8081 and Webpack uses 19006 |
| Native builds/devices | Android physical device/emulator; iOS simulator/device | **Not verified** |

Baseline browser rendering establishes only unauthenticated UI readiness. It does
not establish that registration, secure storage, QR validation, OTP or payment
works. Updated harness and implementation results must be recorded below with
their exact command and counts, without rewriting these historical outcomes.

## Historical Phase 1 frontend evidence

The following checks passed on 20 October 2026 with mocked platform storage and
HTTP boundaries:

```sh
cd frontend
npx --no-install jest --runInBand --ci \
  src/context/__tests__/AuthContext.test.js \
  src/config/__tests__/apiPolicy.test.js \
  src/services/storage/__tests__/storage.test.js
```

Result: **3 suites, 27 tests passed**. This covers native secure-adapter selection,
web refusal to persist tokens in JavaScript storage, preference/account
isolation, storage failures, HTTPS configuration, sanitized API errors,
verify-before-auth, native missing-token startup, failed verification/retry,
session invalidation, pending logout recovery and lifecycle listener cleanup.
`git diff --check` passed after this batch. Android/iOS device storage remains
unverified; these tests do not substitute for device execution. The later real
browser cookie check is recorded separately below.

`npx --no-install jest --runInBand --ci src/config/__tests__/api.test.js`
also passed: **1 suite, 3 tests**. An Axios test adapter verifies request-bound
OTP payloads, no automatic retry after a payment timeout, and HTTP 401 session
invalidation. No external network calls occur in these tests.

## Backend, Firebase and browser evidence

The Phase 1 backend gate passed **87 tests across 5 suites** before the startup
regression described below. Its command from the repository root is:

```sh
npm --prefix backend test -- --runInBand --ci
```

Sources: `backend/tests/auth.test.js`, `auth.activity.test.js`,
`payments.test.js`, `otp.security.test.js` and `foundation.test.js`. These use
isolated memory repositories, controlled clocks and private local OTP/recovery
delivery files. Some payment-invariant tests seed a verified OTP as a fixture;
`otp.security.test.js` separately runs the actual issue/verify/consume protocol.
Neither kind is presented as Firebase emulator evidence.

On 26 October, the real server startup check caught a Firebase SDK integration
defect: `read()` supplied an empty-string root path, so registration persisted
but login returned HTTP 500. The adapter now calls `ref()` for the root.
The focused `foundation.test.js` suite passed **16/16**, including the new
regression. The full backend suite then passed **88/88 tests across 5 suites**
on 27 October with `npm test -- --runInBand --ci` from `backend/`. The actual server check below passed after the correction.

This exact command completed with **exit 0 on 26 October 2026**:

```sh
NAMPAY_EMULATOR_TOOLS=/workspace/qr-pay-emulator-tools \
bash scripts/emulators.sh exec 'node scripts/emulator-smoke.cjs && node scripts/emulator-payment-smoke.cjs && node scripts/emulator-server-smoke.cjs'
```

The first script passed real Admin SDK CRUD, **12 concurrent increments**, an
aborted transaction, Auth account creation/deletion, anonymous read/write denial
and Firebase-authenticated write denial on four sensitive paths (T-15).
The second passed **8/8 API scenarios** using real SDK references and a unique
RTDB subtree: account sessions; cards/signed QR; actual private OTP and binding;
**8 concurrent confirmations yielding 1 canonical transaction**; matching
participant histories/receipts; retry/replay rejection; cancellation race; and
logout revocation. The third passed real `startServer()`/`initializeFirebase()`
with the default Admin app and unmodified root reference, loopback HTTP health,
registration persistence, login, session verification and scoped cleanup.
These are script scenarios, not additional Jest tests. See
[EMULATORS.md](EMULATORS.md) for versions, artifact verification and startup.

On 22 October, `node scripts/browser-auth-smoke.cjs` completed with **exit 0**
against the running local web app and disposable memory-backed demo API.
Chromium verified onboarding/skip persistence, empty-form validation, synthetic
registration, four primary tabs, an HttpOnly/SameSite Strict cookie, no token in
the web JSON response or JavaScript-readable cookie/localStorage, authenticated
reload, logout/401, private password recovery/reset and login with the replacement
password. It reported no uncaught browser errors. Compact light (390×844) and
wide dark (1280×900) auth views had no horizontal overflow. Screenshots are in
`docs/design/screenshots/` (`onboarding-light-compact.png`,
`auth-login-light-compact.png`, `auth-register-light-compact.png`,
`auth-login-dark-wide.png`). The script uses reduced-motion browser emulation;
this does not constitute a full animation/accessibility audit. Later UI edits
require their own browser gate. Current frontend aggregate counts belong to
the implementation progress record, rather than these historical test batches.

## Current verification register

The Phase 6 runs below completed after the dependency, Metro bundler, browser
layout and cross-request idempotency changes. Source inspection identifies the
assertions; the saved run results establish execution. Counts in the historical
sections above are intentionally unchanged.

| Gate | Latest completed evidence | Phase 6 final rerun |
| --- | --- | --- |
| Backend unit/API | **115 tests, 7 suites passed**, including 21 release-security cases and two recovery delivery/throttling regressions | **Passed** in `npm test`; zero failed/skipped tests reported |
| Frontend unit/component | **368 tests, 33 suites passed** on the final dependency set | **Passed** in `npm test`; zero failed/skipped tests reported |
| TypeScript | `npm run typecheck` with TypeScript **5.8.3** | **Passed** |
| Static checks | `npm run check`: ESLint, scanner self-test, source/config rules, dependency patch integrity and tooling compatibility | **Passed**; scanner inspected **157 source files and 14 JSON configurations**, zero findings |
| Dependency advisories | Latest audit: backend **14 lower-severity** findings; frontend **19 lower-severity** findings; no high/critical findings in either | See [DEPENDENCY_AUDIT.md](../security/DEPENDENCY_AUDIT.md) for exact graphs, mitigation and remaining advisories; an audit is not a proof of exploit absence |
| Real Firebase | Repository/rules/Auth, **9 payment API scenarios**, and actual server startup | **All three scripts passed**, including 12 concurrent repository updates, 8 identical confirmations yielding one transaction, and distinct requests racing on one payer operation key |
| Chromium auth/payment/features/reliability | `npm run test:browser` starts disposable localhost services using Metro | **All five runs passed**: auth, payment, features, reliability with reduced motion, reliability with normal motion; includes final CSS/200% zoom and browser credential-storage checks |
| Web/native JavaScript exports | `npm --prefix frontend run build:bundles` with Expo **53.0.27**, React Native **0.79.6** and TypeScript **5.8.3** | **Web, Android and iOS exports passed** into `frontend/dist-native`; these JS/assets are not an APK/IPA or native installation |
| Android build/device; iOS | No successful APK compilation, installation or physical/emulator runtime execution | **Not verified**; see [NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md) |
| Remote CI | Hosted run exercised installs, scans,115/368 tests, typecheck, real Firebase and exports | Current result is tracked in [PR6 checks](https://github.com/ANShishiveni/QR_Pay/pull/6). The first executable run exposed a normal-motion browser timing assertion; its transition wait was corrected. |

Saved local evidence: `.local/evidence/static-unit-release.log`,
`firebase-release.log`, `browser-release.log` and `bundles-release.log` in the
same directory. These ignored logs and generated exports are workspace artifacts,
not files guaranteed in a fresh checkout. The commands below reproduce the gates.
The final real-Firebase payment count is **9 scenarios**, superseding the eight
scenarios in the historical 26 October run without changing that older result.

The Phase 4 feature browser covers catalog card add/default/remove, authoritative
dashboard totals, activity filters, owned detail and downloaded receipt,
name/photo consent, saved theme/alerts and password reauthentication/revocation
([FEATURES.md](FEATURES.md)). Phase 5 adds offline-write blocking without replay,
draft retention, notification read reconciliation/muting, keyboard tabs/dialogs,
normal/reduced motion and a 200% CSS zoom layout check
([RELIABILITY.md](RELIABILITY.md), [ACCESSIBILITY.md](ACCESSIBILITY.md)).
Screenshots and their exact coverage limits are catalogued in
[SCREENSHOTS.md](../design/SCREENSHOTS.md).

## Required security and correctness scenarios

All scenarios below are P0. **Passed** applies only to the stated executed
layer; **Partial** means at least one required assertion or runtime layer is
still unverified. The original failed baseline remains recorded above. Static
findings are not exploit demonstrations, and unit tests do not prove native
behavior. The source abbreviations below refer to the backend suites above;
“real Firebase” refers to the successful three-script command, not a test double.

| ID | Scenario / essential assertion | Required layer and evidence | Current status |
| --- | --- | --- | --- |
| T-01 | Scan a valid pending request; review uses the server's requester, amount in minor units, NAD currency and expiry, ignoring client substitutes | API integration + payment-review component + two-account browser E2E | **Passed at these layers:** `payments` and real Firebase verify authoritative scan data; `PaymentScreens` ignores forged navigation amount/name; two-account browser imports the generated QR image, reviews server data and completes verification |
| T-02 | Reject changed signature, invalid hex/length, malformed JSON/schema and oversized payload; response contains no stack or secret | QR unit + API integration | **Passed:** `payments` and real Firebase reject tampering; `release.security` adds 0/1/63-character signatures, the 2048/2049-character boundary and oversized HTTP-body rejection with sanitized error shape, correlation ID and no echoed payload/internal details |
| T-03 | Reject expired QR at scan and confirm, including expiry between review and approval | Controlled-clock API + review UI | **Passed API/component:** `payments` rejects expired scan and exact-expiry confirm; `PaymentScreens` uses server time; `PaymentDeviceConfirmation` blocks expiry during the prompt; request countdown tests hide the old QR. Native prompt execution remains unverified |
| T-04 | Completed QR cannot create another transaction; participant retry returns canonical result or safe conflict | API + emulator persistence assertions | **Passed:** `payments` and real Firebase reject used QR/another operation key; identical retry returns the canonical transaction without another write |
| T-05 | Requester cannot scan/confirm own request as payer | API integration | **Passed:** `payments` and real Firebase reject self-scan; `release.security` directly rejects self-confirm on both `/qr/confirm-payment` and `/payments/process-payment` without a prior scan |
| T-06 | Reject negative, zero, NaN/infinity encodings, excessive magnitude/precision and unsafe integers; accepted amounts have exact minor-unit values | Money unit + API boundary cases | **Passed:** `payments` covers invalid encodings, precision, limits and exact minor units; `release.security` rejects unsafe positive/negative integers, huge values and numeric-string `amountMinor` at the API without creating a request |
| T-07 | User B cannot verify/read/consume user A's OTP authorization | API integration, different authenticated accounts | **Passed:** `otp.security` checks status/verification ownership and `payments` checks consume binding; real Firebase wrong-owner verification rejection passed |
| T-08 | Authorization for request X cannot pay request Y or changed amount/purpose | API integration | **Passed:** `payments` and `otp.security` reject changed user/request/purpose/amount/scan grant; real Firebase changed request/amount and foreign-card checks passed |
| T-09 | Consumed OTP cannot authorize another operation; retry of the same completed idempotent operation cannot duplicate state | API + emulator | **Passed:** `payments`, actual local challenge protocol and real Firebase consume once, reject replay and return the same result on retry |
| T-10 | Repeated wrong codes stop at the attempt limit; resend cooldown, destination/user/IP limits hold; new challenge invalidates old authorization as designed | Controlled-clock unit + API integration | **Passed:** `otp.security` covers attempts/cooldown/account windows/supersession; `release.security` exercises shared-IP limits across 21 accounts, untrusted forwarded headers and window reset, plus shared verified-destination cooldown/window limits. Only the destination test's delivery boundary is stubbed; no real SMS is sent |
| T-11 | Concurrent confirmations create exactly one canonical transaction and one projection per participant | Parallel API calls against Firebase emulator, inspect canonical and user records | **Passed:** 8 real Firebase API confirmations returned one ID, one initial commit, one canonical record and matching single-entry participant histories/projections |
| T-12 | Same idempotency key after a timeout returns the same result; different-payload reuse cannot create another transfer | API fault/retry + UI reconciliation | **Passed:** exact retries return one canonical result in API/emulator/browser tests; `release.security` rejects changed card/session/request even with fresh OTP, races distinct requests on one payer key, isolates keys across payers and fails closed for a missing indexed result. Real Firebase repeats the cross-request race. Pre-index exact retries gain a binding; historical limitations are documented in [PAYMENTS_V2.md](../api/PAYMENTS_V2.md) |
| T-13 | Forged, expired, wrong-issuer/audience and revoked tokens fail; startup session validation and HTTP 401 clear authenticated UI | Auth API + native storage adapter/component + web browser | **Passed API/component/web:** `auth` includes a valid-signature wrong-issuer regression, expiry, forgery, wrong audience, missing claims, disabled accounts and revocation; `AuthContext`, storage/API tests and browser reload/logout verify session handling. **Native runtime unverified** |
| T-14 | Cross-user card/profile/transaction reads and mutations fail; removed card cannot be used | API ownership cases | **Passed:** `auth`, `auth.activity` and `payments` ownership/removed-card cases; mixed canonical/legacy rows cannot expose outsider receipts, history or totals; real Firebase foreign-card and stranger-receipt rejection passed |
| T-15 | Unauthenticated or wrong-owner client RTDB writes fail under actual rules; privileged API separately enforces all invariants | Firebase Rules emulator + API integration | **Passed at rules layer:** anonymous reads/writes and authenticated writes to users, transactions, paymentRequests and otpSessions denied by real rules; privileged API checks have the individual coverage/remaining gaps listed here |
| T-16 | Disconnect after submit leaves an uncertain/reconciling result; resume/status query obtains canonical outcome; UI never invents success or failure | Browser network interception + Android offline/background/resume | **Passed browser/component; partial native:** browser aborts the confirmation response after a server commit, observes uncertainty, then obtains the canonical result with one confirmation call. `paymentFlow`/`PaymentScreens` cover offline and focus/resume recovery. Android runtime behavior remains unverified |
| T-17 | Only predefined sandbox instruments accepted; submitted PAN/CVV rejected and absent from database, logs, browser storage, native preferences and receipts | API validation + log/storage inspection + UI/component | **Passed for exercised API/component/browser scope; native inspection outstanding:** API rejects raw-card fields and verifies sanitized storage; catalog-only UI and receipt allowlists pass; `release.security` captures application logs/errors during card rejection, OTP/payment and provider/storage failures and excludes secret payloads. Browser auth checks synthetic credentials in local/sessionStorage/console and no IndexedDB databases. No physical-device preference audit or exhaustive all-flow browser storage audit is claimed |
| T-18 | Payer and requester records share ID, amount, NAD currency and terminal status, with opposite roles; receipt resolves authoritative data | Two-account API + emulator + receipt browser E2E | **Passed API/component/browser:** canonical ID/amount/status and opposing roles match in memory, real Firebase and two-account browser histories; detail rejects forged/foreign receipts; browser downloads the simulated HTML receipt. Native OS sharing remains unverified |
| T-19 | Concurrent requester cancellation and payment produce exactly one allowed terminal outcome and consistent records | Parallel API against Firebase emulator | **Passed:** `payments` and real Firebase race return one 200 and one 409; terminal state and transaction count agree, with no duplicate transaction |
| T-20 | Development explicitly uses local mock outbox; no OTP in API/logs; non-development mock/missing provider fails closed without network SMS | Provider configuration unit + API + unsafe-startup configuration rejection | **Passed at these layers:** `otp.security`/`foundation` reject unsafe mock/provider configuration; private outbox permissions, hash-only storage and no OTP in API pass in memory and real Firebase. `release.security` captures application console/error paths and excludes the actual private challenge, bearer token and provider/storage diagnostics. No real provider or production deployment was exercised |

## Session, API and frontend regression coverage

| Area | Required assertions | Current status |
| --- | --- | --- |
| Native secure session | Token exclusively in SecureStore; restart validates server session before protected navigation; storage failure fails closed; expired/revoked session removed; logout clears token and personal caches | **Adapter/component passed:** `storage`, `AuthContext` and API suites cover secure adapter selection, write failure, server verification, revocation, cache separation and failed-logout recovery. **Native restart/storage runtime unverified** |
| Web cookie session | HttpOnly session cookie; production Secure/SameSite policy; credentials-enabled requests; CSRF/origin enforcement; no auth token in JavaScript storage; reload calls server verification | **API/component/browser passed for exercised scope:** HttpOnly/Strict/path, missing/foreign Origin rejection, no token in web response/document.cookie, verified reload/logout. Final auth browser checks original/replacement passwords, original session token and recovery proof absent from local/sessionStorage/console, with zero IndexedDB databases. Production TLS/Secure-cookie deployment remains unverified |
| Auth forms | Normalized input, password policy, loading/duplicate-submit guards, inline errors and sanitized failures | **Passed component/browser:** `AuthScreens`, form helpers and auth API tests cover input/duplicate guards, normalization, safe errors and recovery capability states; browser registration/login/reset and auth-secret console checks passed. Application backend log/error capture is recorded under T-17/T-20 |
| Recovery | Private proof, expiry, one-time use, throttling, session invalidation and non-enumerating response | **API/component/browser passed:** generic responses, hash-only proof, private outbox, expiry, reuse rejection and old-session revocation; final auth tests cover shared-IP recovery/reset throttling and delivery failure removing unusable proof without exposing failure or changing credentials. No real email provider is configured or exercised |
| API contract | Client methods map to implemented routes; no wallet endpoint; network/401 errors handled; payment writes never automatically retried | **Passed for exercised methods:** API adapter tests and auth/payment/features/reliability browsers call actual routes; offline writes stop before transport and reconnect never replays them; timeouts preserve uncertainty. `/qr/history` is a supported backend compatibility alias, not a required client route. This is not an exhaustive generated client/server contract suite |
| Storage preferences | Only non-sensitive namespaced preferences persisted; account settings isolated across logout/account switch | **Passed adapter/component:** `storage`, `AuthContext`, `ThemeContext` and `NotificationContext` cover namespace cleanup, memory-only personal caches, late-response/account isolation and preference persistence; browser theme/alert reload passed. Native preferences inspected only through mocks |
| Biometric semantics | Availability, enrollment and cancellation handled; local success never substitutes for server OTP | **Passed component:** `PaymentDeviceConfirmation` covers both preference gates, unavailable/unenrolled/web fallback, cancellation and server revalidation after local success, including expired request/removed card/changed amount. Hardware prompt not run |
| Request lifecycle | Reference, server-time countdown, foreground refetch, owned cancellation, new request on regeneration | **Passed API/component/browser:** `RequestScreens`, `paymentFlow`, `payments` and two-account browser cover these states; cancellation race and stale-response protection are asserted. Native QR-image sharing remains unverified |
| Scanner | Camera/gallery share backend validation; callbacks lock; permission denial/torch absence/resume recover safely | **Passed decoder/component/browser-image import:** actual synthetic QR decodes with bundled jsQR; `QRScanScreen`, camera and decoder suites cover locks, cleanup, malformed images and capability gates; browser imports a generated QR. Real camera permissions/focus/native image decoder remain unverified; see [SCANNER.md](SCANNER.md) |
| Dashboard/cards | Server-derived totals and latest/pending records; distinct loading/error/empty states; catalog-only cards; reconcile uncertain mutations | **Passed API/component/browser:** `HomeScreen`, `CardsScreen`, card mapping, payments API and feature browser verify integer totals, no wallet fiction, filters/default/removal and response-loss recovery |
| Activity/receipts | Empty versus error states, filters/pagination, ownership, masked simulation metadata and safe exports | **Passed API/component/browser:** activity model/screens cover date boundaries, pagination overlap and stale responses; receipt export allowlists/escapes data; actual browser download includes canonical ID/disclaimer and omits email. Native share API is mocked; OS share-sheet execution remains unverified |
| Profile/settings | Validated persistent names/photo, contact-verification limits, password proof, theme/alert preferences and honest capabilities | **Passed API/component/browser:** profile/photo preview requires explicit save; contact edits are read-only without verified delivery; wrong password preserves the session and successful change revokes it; theme radios support keys/persistence. Native picker and biometric hardware not run |
| In-app notifications | Owned/deduplicated events, expiry without opening request history, first read marker, account/lifecycle isolation, muted alerts retain history | **Passed API/component/browser:** `notifications` covers atomic expiry/dedup/read ownership; provider/screens cover stale responses, foreground polling and read reconciliation; reliability browser verifies read markers and muted inbox. No push/lock-screen notification delivery is implemented or claimed |
| Accessibility/components | Labels, announced state, focus, disabled/loading controls, error recovery, modal semantics and non-color status | **Passed within tested scope:** native component mocks plus five actual React Native Web/DOM markup tests; browser tab arrows, dialog Tab/Shift+Tab trap/Escape/restore, input associations and theme radios. TalkBack/VoiceOver, spoken announcements and every-screen enlarged-text review remain unverified |

## Device and visual release criteria

These checks require their stated device or environment. Browser screenshots are
not substitutes for Android/iOS, secure storage, biometric or camera testing.

| Target / condition | Required observation | Status |
| --- | --- | --- |
| Android physical device | Install demo build; two-account QR scan/payment; camera permission deny/allow; share; secure restart/logout; biometric cancel | **Not verified:** no device or built APK. SDK tooling/preflight evidence is not runtime acceptance |
| Android emulator | Install/build, compact/large display, back navigation, keyboard, cutouts, background/resume and offline recovery | **Not verified:** SDK/platform/compiler packages, license acceptance and emulator/KVM unavailable; no Gradle/APK success claimed |
| iOS simulator/device | Compatible build; safe areas, keyboard, VoiceOver, secure restart/logout, share/camera on suitable hardware | **Not verified:** macOS/Xcode/device unavailable |
| Compact + large viewport | Login, registration, home, request, review, cards, activity, receipt, profile fit with reachable actions | **Partial browser coverage:** 390×844 captures span the core flow/features; 1280×900 includes auth/profile. Overflow assertions passed for captured screens, not every screen/size combination; no Android size evidence |
| Light + dark + system theme | Screens, modals, status bar and toasts use accessible tokens | **Partial:** theme preference/race/fallback and semantic contrast tests pass; saved dark settings and wide dark login are captured. Full dark/system screen gallery and native status-bar review remain unverified |
| Font scaling | Up to 200% where supported; readable wrapping and reachable actions | **Partial browser only:** final 200% CSS zoom on Settings passed after layout/wrapping fixes, including reaching Save preferences. This does not verify native font scaling, every screen at zoom or full manual readability |
| TalkBack / VoiceOver | Meaningful labels, order, error announcements and dialog focus | **Not verified:** browser ARIA assertions do not establish screen-reader speech or native focus behavior |
| Reduced motion / contrast | OS preference respected; sufficient contrast; status understandable without color | **Partial:** normal/reduced-motion Chromium runs and light/dark token contrast tests passed; component selection/disabled states do not rely on color. Every composition, live announcements and native OS preference behavior remain unverified |
| Portrait / rotation policy | Declared supported orientation and safe areas work | Source declares portrait; **native layout, cutouts, keyboard, hardware back and rotation behavior unverified** |
| Network uncertainty | Disconnect immediately after confirm; resume/retry reconcile without duplicates | **Passed browser/component:** committed-response loss yields uncertainty, then one canonical result; separate pre-send offline draft/reconnect path never replays a write. **Native background/resume unverified** |

## Remaining acceptance work

- The blueprint's Android physical-device **and** emulator requirement remains
  unmet. SecureStore restart, actual camera/gallery/share/biometric operations,
  native offline/background recovery, keyboard/safe areas and TalkBack need
  an installable APK and suitable targets. iOS is unavailable. Build preflight
  exit 2 must not be counted as compilation success.
- Browser credential inspection now covers the exercised auth/recovery journey
  in document.cookie, response bodies, local/sessionStorage and console, with
  no IndexedDB databases. This does not establish absence of every secret in
  every future flow or inspect native storage. Production TLS/Secure-cookie
  deployment and real delivery providers have not been exercised.
- Accessibility still needs spoken screen-reader feedback, complete
  dark/wide/enlarged-text compositions and native font scaling. CSS zoom and
  screenshots cannot close those checks.
- Hosted CI results are tracked in [PR6 checks](https://github.com/ANShishiveni/QR_Pay/pull/6). Local evidence does not substitute for the current hosted result.

## Evidence recording and commands

For each implementation batch, record: task/test IDs, command, working directory,
runtime or device, pass/fail/skip counts, artifact path and remaining limitation.
Do not mark a scenario complete if its necessary layer is still unrun.

Available repeatable commands from the repository root:

```sh
npm ci --no-audit --no-fund
npm --prefix backend ci --no-audit --no-fund
npm --prefix frontend ci --legacy-peer-deps --no-audit --no-fund
npm run check
npm --prefix backend test -- --runInBand --ci
npm run test:frontend
npm run typecheck
npm run test:emulators
EXPO_PUBLIC_API_URL=https://demo-api.example.invalid npm --prefix frontend run build:web
EXPO_PUBLIC_API_URL=https://demo-api.example.invalid npm --prefix frontend run build:bundles
npm run test:browser
```

The browser runner starts disposable localhost services and runs auth, payment,
features and reliability scripts, with reliability in both motion modes. The
placeholder production-export origin is deliberately non-routable; a bundle
using it is build evidence, not a deployed application. See
[SETUP.md](../SETUP.md) for runtime/tool prerequisites and
[NATIVE_ACCEPTANCE.md](NATIVE_ACCEPTANCE.md) for native preflight/build/device
steps. Static checks parse code and apply targeted rules; they do not replace
type checking, runtime authorization, broad secret detection or native manifests.
The CI workflow defines these gates; no remote run is inferred from its presence.

Use `.env.example` placeholders and ephemeral synthetic credentials only.
Read local mock OTP challenges through the operator-only outbox helper, not a
public API or a hardcoded universal code. Do not paste OTPs, tokens or account
passwords into evidence files. Keep native/device gaps explicit in the final
release report even if all available automated suites pass.
