# NamPay 2.0 test matrix

Updated: 20 October 2026. Source: implementation blueprint, sections 14–15.
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

## Phase 1 frontend evidence

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
`git diff --check` passed after this batch. Android/iOS device storage and the
real browser cookie round trip remain separate checks; these tests do not mark
either of those capabilities verified.

`npx --no-install jest --runInBand --ci src/config/__tests__/api.test.js`
also passed: **1 suite, 3 tests**. An Axios test adapter verifies request-bound
OTP payloads, no automatic retry after a payment timeout, and HTTP 401 session
invalidation. No external network calls occur in these tests.

## Required security and correctness scenarios

All scenarios below are P0. Initial status is **Not verified** because the original
API could not start. Static findings are not exploit demonstrations. A passing
unit/mock test does not by itself prove the Firebase emulator or native layer.

| ID | Scenario / essential assertion | Required layer and evidence | Current status |
| --- | --- | --- | --- |
| T-01 | Scan a valid pending request; review uses the server's requester, amount in minor units, NAD currency and expiry, ignoring client substitutes | API integration + payment-review component + two-account E2E | Not verified |
| T-02 | Reject changed signature, invalid hex/length, malformed JSON/schema and oversized payload; response contains no stack or secret | QR unit + API integration | Not verified |
| T-03 | Reject expired QR at scan and confirm, including expiry between review and approval | Controlled-clock API + review UI | Not verified |
| T-04 | Completed QR cannot create another transaction; participant retry returns canonical result or safe conflict | API + emulator persistence assertions | Not verified |
| T-05 | Requester cannot scan/confirm own request as payer | API integration | Not verified |
| T-06 | Reject negative, zero, NaN/infinity encodings, excessive magnitude/precision and unsafe integers; accepted amounts have exact minor-unit values | Money unit + API boundary cases | Not verified |
| T-07 | User B cannot verify/read/consume user A's OTP authorization | API integration, different authenticated accounts | Not verified |
| T-08 | Authorization for request X cannot pay request Y or changed amount/purpose | API integration | Not verified |
| T-09 | Consumed OTP cannot authorize another operation; retry of the same completed idempotent operation cannot duplicate state | API + emulator | Not verified |
| T-10 | Repeated wrong codes stop at the attempt limit; resend cooldown, destination/user/IP limits hold; new challenge invalidates old authorization as designed | Controlled-clock unit + API integration | Not verified |
| T-11 | Concurrent confirmations create exactly one canonical transaction and one projection per participant | Parallel API calls against Firebase emulator, inspect canonical and user records | Not verified |
| T-12 | Same idempotency key after a timeout returns the same result; different-payload reuse cannot create another transfer | API fault/retry + UI reconciliation | Not verified |
| T-13 | Forged, expired, wrong-issuer/audience and revoked tokens fail; startup session validation and HTTP 401 clear authenticated UI | Auth API + native storage adapter/component + web browser | Not verified |
| T-14 | Cross-user card/profile/transaction reads and mutations fail; removed card cannot be used | API ownership cases | Not verified |
| T-15 | Unauthenticated or wrong-owner client RTDB writes fail under actual rules; privileged API separately enforces all invariants | Firebase Rules emulator + API integration | Not verified |
| T-16 | Disconnect after submit leaves an uncertain/reconciling result; resume/status query obtains canonical outcome; UI never invents success or failure | Browser network interception + Android offline/background/resume | Not verified |
| T-17 | Only predefined sandbox instruments accepted; submitted PAN/CVV rejected and absent from database, logs, browser storage, native preferences and receipts | API validation + log/storage inspection + UI/component | Not verified |
| T-18 | Payer and requester records share ID, amount, NAD currency and terminal status, with opposite roles; receipt resolves authoritative data | Two-account API + emulator + receipt E2E | Not verified |
| T-19 | Concurrent requester cancellation and payment produce exactly one allowed terminal outcome and consistent records | Parallel API against Firebase emulator | Not verified |
| T-20 | Development explicitly uses local mock outbox; no OTP in API/logs; non-development mock/missing provider fails closed without network SMS | Provider configuration unit + API + production-start rejection | Not verified |

## Session, API and frontend regression coverage

| Area | Required assertions | Current status |
| --- | --- | --- |
| Native secure session | Token exclusively in SecureStore; restart validates server session before protected navigation; storage failure fails closed; expired/revoked session removed; logout clears token and personal caches | Not verified on native |
| Web cookie session | HttpOnly session cookie; production Secure/SameSite policy; credentials-enabled requests; CSRF/origin enforcement; no auth token in localStorage, sessionStorage or IndexedDB; reload calls server verification | Not implemented at baseline |
| Auth forms | Normalized input, password policy, loading/duplicate-submit guards, inline errors, safe messages; no password/token/PII request logging | Empty registration validation only passed at baseline |
| Recovery | Ownership proven before reset; expiry, one-time use, throttling and session invalidation; non-enumerating response | Not implemented at baseline |
| API contract | All client methods map to real routes; no `/users/balance` or stale `/qr/history`; network/401 errors handled; payment writes never automatically retried | Not verified |
| Storage preferences | Only non-sensitive namespaced preferences persisted; account-specific preferences cannot leak across logout/account switch | Not verified |
| Biometric semantics | Hardware availability and cancel handled; local biometric success never invents server authorization or bypasses OTP | Not verified |
| Request lifecycle | Optional reference; countdown derived from server time; foreground status refetch; cancellation ownership; regeneration creates a new request | Not verified |
| Scanner | Camera and gallery use the same backend validation; callbacks lock immediately; permission denial/torch absence/resume recover safely | Not verified |
| Activity/receipts | Empty versus error states; filters/pagination; participant ownership; consistent masked simulation metadata; share export excludes secrets and unnecessary PII | Not verified |
| Accessibility/components | Labels, state announcements, focus order, disabled/loading states, visible error recovery, modal focus, no color-only state | Not verified |

## Device and visual release criteria

These checks require their stated device or environment. Browser screenshots are
not substitutes for Android/iOS, secure storage, biometric or camera testing.

| Target / condition | Required observation | Status |
| --- | --- | --- |
| Android physical device | Install demo build; two-account QR scan/payment; camera permission deny/allow; share; secure restart/logout; biometric cancel | Not verified — device unavailable |
| Android emulator | Install/build, compact/large display, back navigation, keyboard, cutouts, background/resume and offline recovery | Not verified |
| iOS simulator/device | Compatible build; safe areas, keyboard, VoiceOver, secure restart/logout, share/camera on suitable hardware | Not verified — macOS/device unavailable |
| Compact + large viewport | Login, registration, home, request, review, cards, activity, receipt, profile fit with reachable actions | Baseline login/registration browser evidence only |
| Light + dark + system theme | All screens, modals, status bar and toasts use consistent accessible tokens | Not implemented at baseline |
| Font scaling | Up to 200% where supported; text wraps and actions remain reachable | Not verified |
| TalkBack / VoiceOver | Meaningful labels, order, error announcements and dialog focus | Not verified |
| Reduced motion / contrast | OS preference respected; sufficient text/control contrast; status understandable without color | Not verified |
| Portrait / rotation policy | Declared supported orientation works and safe areas remain correct | Not verified |
| Network uncertainty | Disconnect immediately after confirm; background/resume and retry reconcile server state without duplicates | Not verified |

## Evidence recording and commands

For each implementation batch, record: task/test IDs, command, working directory,
runtime or device, pass/fail/skip counts, artifact path and remaining limitation.
Do not mark a scenario complete if its necessary layer is still unrun.

Planned repeatable gates (activate only when scripts exist):

1. Frozen dependency installation in all package roots.
2. Backend unit/API suite with local mock OTP and isolated state.
3. Firebase emulator integration and rules tests with a `demo-*` project.
4. Frontend unit/component tests for storage, API/session, money and key forms.
5. Web bundle/build and browser smoke plus two-account E2E.
6. Lint/typecheck, dependency audit, secret/config checks.
7. Android build and physical-device smoke; iOS where available.

Use `.env.example` placeholders and ephemeral synthetic credentials only.
Read local mock OTP challenges through the operator-only outbox helper, not a
public API or a hardcoded universal code. Do not paste OTPs, tokens or account
passwords into evidence files. Keep native/device gaps explicit in the final
release report even if all available automated suites pass.
