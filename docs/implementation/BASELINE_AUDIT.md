# NamPay 2.0 baseline audit

Audit date: 20 October 2026. Baseline: `998d2ec571289edbf777a52d9edea50652cf257b`, the verified remote `main` HEAD when implementation began. Implementation branch: `feat/nampay-2`. This document records the original source and observed baseline; later changes must not erase the original findings.

The complete NamPay 2.0 implementation blueprint is the scope authority. This remains a Firebase-backed QR-payment **simulation**, with no live transfers, real cards, paid SMS, or destructive production migration authorized. All provider-dependent verification must use isolated fixtures/emulators.

## Evidence and Phase 0 gate

Classification uses the blueprint's four labels: **Confirmed by test**, **Confirmed by code**, **Suspected / needs reproduction**, and **Resolved**. A code-confirmed missing check is not a claim that an exploit was demonstrated against a running service. A build or empty-form check does not demonstrate payment correctness.

| Baseline check | Observed result | Classification |
| --- | --- | --- |
| Frozen dependency installation at root, `backend/`, and `frontend/` | All three installs passed during onboarding. Frontend requires the repository's legacy peer-dependency resolution for its committed lockfile. | Confirmed by test |
| `cd backend && npm test -- --runInBand` | Two suites failed while loading `supertest`; **zero tests executed**. `supertest` is absent from both package manifest and lockfile. | Confirmed by test |
| Test loading with external `supertest` supplied for diagnosis | Reached Firebase initialization and failed on missing Firebase configuration. This was diagnosis, not a passing suite. | Confirmed by test |
| Backend route import: `node -e "require('./backend/routes/auth')"` | `ReferenceError: Cannot access 'jwtSecret' before initialization`, at `backend/routes/auth.js:8`. | Confirmed by test |
| Backend startup | Cannot reach readiness: Firebase requires unavailable service-account configuration before route imports. The independent route import also proves a source defect after that configuration obstacle. | Confirmed by test |
| Web development server and production bundle | Built/served during onboarding; browser rendered Login and Register and rejected empty forms. CDN checks retained valid TLS verification. | Confirmed by test |
| Register/login, QR generation/scan, OTP, two-party simulated payment | Not verified at baseline because the backend cannot start and its suites cannot load. | Suspected / needs reproduction |
| Android camera/biometrics, secure storage, physical-device and iOS behavior | Not verified by the web checks. | Suspected / needs reproduction |
| Remote default branch | Read-only Git access confirmed exact `main` SHA above. | Confirmed by test |
| Open PR inventory / branch protection | GitHub API GraphQL request returned HTTP 403. Git read access does not establish API access. Inventory is unavailable; no token was requested. | Confirmed by test |

**Phase 0 baseline gate:** the original implementation does not meet the working-flow branch of the gate. It meets only the blueprint's alternative of concrete blockers with reproducible failing checks. Phase 0 harness/emulator work must establish isolated startup and meaningful tests before claiming those capabilities. The remaining payment-security and UI requirements belong to subsequent phases. Consult [PROGRESS.md](PROGRESS.md) and [the test matrix](../testing/TEST_MATRIX.md) for current, rather than baseline, results.

No real provider credentials were present during onboarding; variable **names and presence only** were inspected. Required original backend variables are `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `STRIPE_SECRET_KEY`, and `JWT_SECRET`; Twilio uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`. Original Firebase initialization unconditionally parses a service-account PEM; setting emulator host variables alone cannot satisfy this path. Proxy-secret placeholders cannot satisfy local PEM parsing or JWT signing.

## Toolchain and repository inventory

The audit machine reports Node `v24.19.0` and npm `11.9.0`; there is no original Node version pin. The three npm lockfiles use lockfile version 3.

| Layer | Locked baseline versions / commands |
| --- | --- |
| Frontend | Expo 53.0.23; React 19.0.0; React Native 0.79.5; React Native Web 0.20.0; React Navigation native 6.1.18 |
| Web build | `@expo/webpack-config` 18.1.4; webpack 5.101.3; `npm run web`, custom `webpack.dev.js` / `webpack.config.js` |
| Backend | Express 4.21.2; Firebase Admin 13.5.0; Twilio 5.10.1; Stripe 13.11.0; Jest 29.7.0 |
| Root | `start`, `dev`, `client`, `install-all`, `update-ip`; root and backend declare different Stripe major versions |
| Backend | `start`, `dev`, `test`; startup loads `.env` relative to current working directory, so use `backend/` |
| Missing original quality infrastructure | No committed emulator configuration, CI workflow, frontend test script, integration-test script, lint/typecheck scripts, or repository `AGENTS.md` |

The frontend lockfile uses a legacy webpack integration beside Expo 53 and legacy permission/scanner packages. Successful web bundling is evidence of that tested target only; native compatibility and dependency advisory disposition remain separate checks. Do not upgrade the entire stack implicitly.

## Blueprint findings B-01 through B-12

| ID | Classification at baseline | Evidence and consequence | Required follow-up |
| --- | --- | --- | --- |
| B-01 | Confirmed by code | `PaymentConfirmScreen.js` supplies a literal trial phone number; `BiometricAuthScreen.js` has the same fallback. `/otp/send` accepts the client's destination without deriving it from a verified account. No provider call was made. | Resolve destination server-side; explicit development mock with production failure closed. |
| B-02 | Confirmed by code | `utils/asyncStorage.js` uses a process-local `Map`. `AuthContext` trusts token/user presence without server verification; the API's 401 interceptor does nothing. | Native secure persistence, startup verification, expiry/revocation handling and logout cleanup. |
| B-03 | Confirmed by code | `verifyOTPSession` checks existence, verified status and expiry, but does not compare actor, request, amount or purpose and does not consume authorization. OTP verification also accepts a session ID without checking authenticated ownership. Concurrent exploitation is not yet demonstrated. | Bound sessions and atomic one-time consumption; T-07–T-10. |
| B-04 | Confirmed by code | QR confirmation reads `pending`, simulates, marks completed, then writes two history records sequentially. No transaction/idempotency key; no request-to-transaction link. Direct payment likewise writes two separate records. | Race/crash regression tests and atomic canonical transition. |
| B-05 | Confirmed by code | QR uses HMAC-SHA256 but string comparison, arbitrary JSON fields/order, weak amount parsing and unbounded caller TTL. It does load the current request, reject non-pending/expired records and self-payment. | Preserve existing controls; strict payload/amount/TTL validation and constant-time comparison; demonstrate negative cases. |
| B-06 | Confirmed by code | Client declares `/qr/history` and `/users/balance`; neither backend route exists. `/qr/requests` does exist. `PUT /users/profile` is registered twice, with the first handler always replying and hiding the later response model. | Reconcile clients and contract tests; no fabricated balances. |
| B-07 | Confirmed by code | Registration/login sanitize every Firebase-invalid email character; other routes replace only the first dot. Records contain UIDs but live under email keys, while user rules assume UID keys. Transaction and OTP rules permit unsafe client writes described below. | UID compatibility adapter, non-destructive fixtures/migration, denied-write emulator tests. |
| B-08 | Confirmed by test / Confirmed by code | Suites fail before execution. Tests also use expired 2025 cards, fake card IDs, a `200 or 400` success assertion, and nonexistent exported `realtimeDb`; cleanup exceptions are swallowed. Server starts a listener on import. | Isolated testable app, deterministic cards/state and exact assertions; never run cleanup against real data. |
| B-09 | Confirmed by code | `app.json` embeds a private LAN API host; config permits HTTP outside local use; Android requests legacy read/write external-storage permissions; duplicate camera/scanner packages remain. | Environment-driven host, HTTPS policy and least-privilege native configuration. |
| B-10 | Confirmed by code | README claims end-to-end encryption and PCI DSS compliance simulation without supporting implementation/certification evidence. | Accurate prototype/security disclosure across docs and interface. |
| B-11 | Confirmed by code | Repeated JWT middleware; malformed self-referential `jwtSecret` declarations; login logs full token-bearing response, registration logs raw `registrationData` including password and full response. Profile logs personal data. | Consolidate auth; remove sensitive logs; test sanitized responses/logs. No sensitive values are reproduced here. |
| B-12 | Confirmed by code | Card and payment helpers simulate success, while checkout/results say payment successful without consistent simulation disclosure. Card validator accepts broad numeric card inputs; mock method ID includes the last eight digits. A live Stripe helper exists even though current payment routes use simulation. | Predefined test instruments only; no PAN/CVV storage/logging; eliminate live-payment execution path and label all simulation artifacts. |

## Additional source defects and missing behavior

| Finding | Classification | Evidence / scope |
| --- | --- | --- |
| Two unconditional route-import failures | Confirmed by test for auth; Confirmed by code for OTP | `const jwtSecret = jwtSecret` in `routes/auth.js:8` and `routes/otp.js:12`. Environment configuration cannot repair lexical self-reference. |
| Token lifecycle lacks account-state/revocation checks | Confirmed by code | JWT signatures/expiry are checked, but issuer/audience/current user/session version are not. Logout responds without revocation. |
| Password authorities diverge | Confirmed by code | Registration creates Firebase Auth user and RTDB password hash; login checks RTDB hash; password change updates only RTDB hash. |
| Rate-limit failure opens OTP sending | Confirmed by code | `OTPService.canSendOTP` returns `true` on database failure; its successful check and session creation are separate operations. |
| Direct-client privileged record mutation | Confirmed by code | RTDB `transactions/$id` permits every authenticated write. Owners may write their OTP records, including status, and payment request fields. Admin SDK bypasses rules, so API validation is independently required. Emulator rule-bypass tests remain necessary. |
| Default card behavior incomplete | Confirmed by code | Linking always sets `isDefault:false`; removing the default does not select a replacement; default changes read then update. QR scan requires a default card. |
| Missing/invalid card fields may throw | Confirmed by code | Card validators call string methods before type/required checks; existing missing-field tests expect a different error. |
| Mock bank labels become unknown | Confirmed by code | Transfer helper maps PAN-like fixture values, but route calls pass mock payment-method IDs as `number`. |
| Photo upload has misleading middleware | Confirmed by code | A 5MB/image multer instance exists but is never mounted; actual endpoint accepts JSON `photo` and only checks a `data:image/` prefix, within global 10MB JSON limit. |
| Legacy transaction pagination is unstable | Confirmed by code | `/users/transactions` limits a UID-ordered query before timestamp sorting; offset pagination may not retrieve newest records as intended. |
| Backend error details leak internals | Confirmed by code | Most route catches return `details:error.message`; several log whole provider/error objects. |
| Biometric authorization is not server-verifiable | Confirmed by code | MFA service returns a literal `biometric_verified` session marker. Existing backend still requires a stored OTP session; successful biometric payment was not demonstrated. |

## Existing user-facing inventory

| Area | Baseline implementation | Runtime status / gap |
| --- | --- | --- |
| Shell | Loading screen; Login/Register; Home/QR/Profile tabs and stack screens | Web auth shell rendered; no onboarding, four-tab shell or system dark theme |
| Auth | Registration/login forms, custom token/user storage, logout | Empty-form browser checks passed; actual auth blocked at baseline; no recovery flow |
| Home | Profile, statistics and recent activity requests | Server-dependent behavior unverified; totals must remain simulation totals, not balances |
| Request | Amount/description form, server QR display and image sharing code | No safe cancel/status detail endpoint; server request listing exists but client drift remains |
| Scanner | `CameraView`, permission/retry UI and scan lock | No gallery import; native camera/background behavior unverified |
| Review/OTP | Review, confirmation dialog, OTP send/resend/verify and payment call | Literal destination and missing binding; no idempotent reconciliation or canonical receipt |
| Cards | Add/list/default/remove screens | Test-only enforcement/default invariants missing |
| Activity | Client search/type filters and server history | No transaction-detail/receipt screen or server detail endpoint |
| Profile/settings | Name/contact/photo, password and biometric/MFA preferences | Volatile preferences; duplicate backend profile handlers; provider/device settings not proven |
| Reliability/accessibility | Loading/error/toast fragments | No completed offline/reconciliation, screen-reader, large-font, dark-theme or device QA |

## Data preservation and implementation boundaries

The [API contract](../api/CONTRACT.md) preserves original wire names and exact legacy paths before any refactor. No original records may be deleted or silently reinterpreted. In particular, QR `senderId` is the **requester/recipient**, while confirmation's `receiverCardId` belongs to the **payer**. Legacy history uses both `_sender` and `_receiver` suffixes; both views carry the same inner transaction ID.

Phase 1 should introduce a tested UID-aware repository adapter before changing callers, keep original records recoverable, detect ambiguous/colliding email keys, and make transaction consumption/creation one auditable operation. Copying data to a new UID path without compatibility reads and collision tests is not a migration plan. Do not mark any B finding **Resolved** until its implementing change and relevant passing test are linked in the progress record.
