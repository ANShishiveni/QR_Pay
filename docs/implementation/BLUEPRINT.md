# NamPay 2.0 — Codex Implementation Blueprint

**Execution-ready product requirements, technical remediation plan, UI/UX specification, acceptance criteria and testing checklist**  
**Repository:** https://github.com/ANShishiveni/QR_Pay  
**Prepared:** 16 October 2026  
**Target:** Modern, professional Android-first React Native application with iOS support where compatible  
**Delivery mode:** Incremental implementation in the existing repository; preserve the original payment workflow  
**Classification:** Demonstration / sandbox QR-payment prototype — **NOT** a live banking product

> **START HERE — INSTRUCTIONS FOR CODEX**
>
> You are the implementation engineer for the repository named above. Read **this entire specification** and inspect the current default branch before changing files. Your task is to **execute the plan in phased, testable changes**, not merely summarize it. Preserve the established user journeys, Firebase-backed prototype architecture and simulated payment semantics. Work in a feature branch or phase branches; do not force-push, rewrite Git history, introduce live payments, or use real credentials. Implement the highest-priority unblocked tasks first, verify each one, and maintain a machine-readable progress log as described in Section 16. Avoid asking the user to restate information already specified here. If access to a provider or device is unavailable, use safe mocks/emulators, document the blocker and complete all independent work. No task is complete without passing relevant tests and satisfying its acceptance criteria.

---

## 1. Executive brief and non-negotiable scope

### 1.1 Product objective

Transform the existing QR_Pay / NamPay prototype into **NamPay 2.0**, a polished, maintainable, accessible fintech-style application with complete and dependable account, QR request, scan, simulated payment, transaction and card-management flows. Make the user experience professional and visually modern. **Do not replace or fundamentally alter the functional concept of the existing system.**

### 1.2 Core journey — preserve exactly this business intent

1. A recipient creates an amount-based, time-limited payment request.
2. The recipient displays or shares its QR code.
3. A payer scans or imports the QR code.
4. The server validates request authenticity, ownership rules, current status and expiry.
5. The payer reviews amount, recipient and chosen **test** card.
6. The payer completes server-validated authentication appropriate to the sandbox environment.
7. A single simulated payment is recorded atomically with corresponding sender/recipient transaction views.
8. Both parties see accurate status, history and a clearly labelled **simulated** receipt.

**Do not:** turn this into a custodial wallet, connect real bank accounts, represent test payments as real settlement, invent balances, disable security controls for a demonstration, or migrate databases without an explicit compatibility plan.

### 1.3 Product and engineering rules

- **Prototype semantics remain intact.** Use mock/sandbox payments only; render “DEMO / SIMULATED PAYMENT” clearly on checkout, confirmation and receipts.
- **Security before styling.** Authentication, replay protection, data integrity and safe storage are release blockers.
- **Keep the system recognizable.** Retain Node/Express and Firebase Realtime Database unless compelling documented evidence requires a small migration.
- **Keep historical data usable.** Changes to user IDs, transaction keys, request models and Firebase paths require tested compatibility or migration logic.
- **Modernize incrementally.** Upgrade framework/dependencies through compatible, tested steps rather than blindly pinning the newest major release.
- **Avoid unnecessary external dependencies.** Prefer stable, maintained libraries already used by the project.
- **Never commit secrets, private keys or example credentials that actually work.** Expired/revoked provider credentials must not be restored.
- **Use least privilege.** User permissions, camera, gallery and notification permissions are requested only at the time they are needed.
- **Default to safe behavior on failures.** Failed OTP/rate-limit/auth/payment checks must never silently allow a transaction.
- **Do not use unsourced bank branding or claim partnerships with FNB, Standard Bank, Bank Windhoek or Nedbank.** In prototype mode, mock bank names are labels only.

### 1.4 Final acceptance outcome

On two independent test accounts/devices, a tester can register/login, link supported **test-only** cards, generate a N$ QR request, scan or import it, inspect details, authenticate using an approved sandbox method, complete a **single simulated** payment, view consistent records on both accounts, open/share a receipt, and log out/in without unexpected data loss. All negative flows listed in Section 14 are blocked, tested and user-friendly.

---

## 2. Source-of-truth repository audit (16 October 2026)

**Read these paths before implementation.** The table reflects direct static inspection of the default branch. “Implemented” means code exists; it does **not** establish that the feature passes runtime tests.

| Domain | Existing implementation | Observation / gap |
|---|---|---|
| Application shell | `frontend/App.js` | Three tabs (Home, QR, Profile); payment, card, history and settings are stack screens. |
| UI/theme | `frontend/src/styles/theme.js` | Green/orange palette and numerous screen-specific styles; no cohesive modern design system. |
| Registration and login | `frontend/src/screens/auth/{LoginScreen,RegisterScreen}.js`, `backend/routes/auth.js` | Existing flow; forgot/reset password not found. |
| Auth state/storage | `frontend/src/context/AuthContext.js`, `frontend/src/utils/asyncStorage.js` | Custom `Map`-backed storage is volatile; do not use it for persistent secure tokens. |
| OTP | `frontend/src/screens/auth/OTPVerificationScreen.js`, `backend/routes/otp.js`, `backend/services/otpService.js`, `backend/middleware/otpAuth.js` | OTP exists; recheck session identity, purpose, payment binding and one-time consumption. |
| Biometric | `frontend/src/screens/auth/BiometricAuthScreen.js`, `frontend/src/services/biometricService.js` | UI and local-auth code exist; server-side payment authorization linkage needs validation. |
| QR creation | `frontend/src/screens/qr/QRGenerateScreen.js`, `backend/routes/qr.js` | Five-minute dynamic QR request and sharing exist; active-status/cancellation lifecycle is incomplete. |
| QR scan | `frontend/src/screens/qr/QRScanScreen.js`, `backend/routes/qr.js` | Camera scanning exists; gallery import, better feedback and recovery absent. |
| Payment review | `frontend/src/screens/payment/PaymentConfirmScreen.js` | Review exists, but OTP navigation contains a hardcoded trial phone number. |
| Payments | `backend/routes/payments.js`, `backend/config/stripe.js` | Mock card/payment-method and cross-bank simulation; do not call these real transfers. |
| Transaction history | `frontend/src/screens/profile/TransactionsScreen.js`, `backend/routes/users.js` | Filters/search exist; detail screens and receipts not found. |
| Profile/cards/settings | `frontend/src/screens/profile/*` | Functional foundation exists; visual consistency and several settings behaviors need work. |
| API contract | `frontend/src/config/api.js` vs `backend/routes/*.js` | Frontend includes `/qr/history`; backend exposes `/qr/requests`. Frontend declares `/users/balance`; route existence must be verified. |
| Firebase | `backend/config/firebase.js`, `backend/database.rules.json` | Check identity and path consistency; backend often uses `email.replace('.', '_')`, while rules show `$uid`-centric paths. |
| App configuration | `frontend/app.json`, frontend/backend `package.json` | Old local IP and some legacy configuration/dependencies; review permissions and compatibility. |
| Tests | `backend/tests/{auth,payments}.test.js`, `TESTING_GUIDE.md` | Limited/outdated coverage; test examples include expired dates and tolerated failures. |
| Project docs | `README.md`, `frontend/README.md`, `docs/Configuration.md` | Overconfident claims (“bulletproof,” encryption, PCI simulation) need precise prototype language. |

**Repository baseline:** React Native + Expo, React Navigation, React Native Paper, Axios; Node.js/Express; Firebase Realtime Database/Auth-related setup; QR creation/scanning; Stripe-sandbox-related mock simulation; OTP via Twilio integration. Do not assume the README’s features are fully integrated until tested.

### 2.1 Known concrete defects to investigate and remediate

**B-01 — Hardcoded trial phone number.** `frontend/src/screens/payment/PaymentConfirmScreen.js` currently navigates to OTP with a literal trial phone number; the biometric fallback also contains a literal fallback. Derive a verified destination from server-side account records. The expired Twilio trial cannot be a required production dependency.

**B-02 — Volatile token storage.** `frontend/src/utils/asyncStorage.js` implements a `Map`, so it does not provide persistent mobile authentication. Use platform-appropriate secure storage for tokens and supported storage for non-sensitive preferences.

**B-03 — OTP binding/replay risk.** `backend/middleware/otpAuth.js` checks `status === 'verified'` and expiry; its visible logic does not establish binding to `req.user.uid`, payment ID, amount, purpose and one-time consumption. Implement these server-side checks.

**B-04 — QR state race.** `backend/routes/qr.js` reads a pending request, simulates transfer, updates status and writes records in separate steps. Two concurrent confirmations may race. Introduce a single idempotent state transition and reliable record creation/recovery.

**B-05 — QR validation robustness.** HMAC signatures are generated/verified in `backend/routes/qr.js`, with direct string comparison; validate strict schema, enforce reasonable TTL/amount bounds, use timing-safe comparisons for valid equal-length signature buffers, and resolve the request server-side.

**B-06 — Frontend/backend endpoint drift.** Frontend route `/qr/history` should be reconciled with backend `/qr/requests`. Inventory all routes, correct stale clients and add contract tests. Do not hide missing endpoints with fabricated local data.

**B-07 — Identity model mismatch.** Backend reads user cards via email-derived paths, while Firebase security rules refer to UID paths. First determine which paths are actually used, then align safely without silently orphaning existing data.

**B-08 — Unreliable current tests.** Payment tests include a “200 or 400” success allowance, a fake card ID and historical expiry values. Replace with deterministic emulator-backed assertions that prove behavior rather than simply avoiding failures.

**B-09 — Environment/config drift.** `frontend/app.json` embeds a development LAN IP and requests legacy storage permissions. Adopt environment-driven hosts, production HTTPS enforcement and minimal platform permissions.

**B-10 — Security and marketing claims.** README mentions end-to-end encryption and PCI DSS compliance simulation. Document actual controls only; do not imply PCI certification or real bank-grade security.

**B-11 — Remaining operational code hygiene.** Redundant/different auth verification implementations, potential verbose personal-data console logs and unused packages/screens should be consolidated after baseline tests.

**B-12 — Existing test-mode behavior.** Make “Demo mode,” test cards and simulated responses explicit across UI, API, documentation and receipts; do not process raw real payment-card data for a mock transfer.

### 2.2 Classification protocol

Codex must tag each finding in `docs/implementation/BASELINE_AUDIT.md` as **Confirmed by test**, **Confirmed by code**, **Suspected / needs reproduction**, or **Resolved**. Do not treat a static observation as proof of an exploitable vulnerability without testing.

---

## 3. User personas and core journeys

| Persona | Goal | UX requirement |
|---|---|---|
| Payer | Scan a received QR and complete a safe simulated payment | Minimal steps, clear recipient and amount, deliberate approval, helpful error recovery. |
| Requester | Generate and share a payment request | Fast amount entry, readable QR, expiry and request status, simple sharing. |
| Returning user | Review activity and account settings | Quick access to recent activity, cards, security and profile. |
| Demo presenter/tester | Demonstrate core flow without paid third-party services | Deterministic sandbox fixtures, documented emulator setup, obvious demo labeling. |

### 3.1 Core UX principles

1. **Clarity over decoration:** amount, recipient, status and confirmation action are visually dominant.
2. **Trust through transparency:** never imply simulated settlement is a real balance transfer.
3. **Accessible by default:** screen readers, contrast, touch targets, keyboard and reduced motion.
4. **Progressive disclosure:** advanced settings live in Profile; Home exposes frequent actions.
5. **Recoverable failures:** preserve user input, retry safely and explain what to do next.
6. **Privacy by design:** mask card details and phone numbers; omit sensitive fields from logs/analytics.

---

## 4. Design system and responsive UI specification

### 4.1 Visual direction

Adopt a **premium, restrained fintech** identity. Avoid heavy gradients on every screen. Use a light default theme and system-aware dark mode.

| Token | Light value / guidance | Dark value / guidance |
|---|---|---|
| Brand navy | `#11263D` | `#E7EFF9` as foreground on dark surfaces |
| Brand emerald | `#087F70` | `#40C8AD` |
| App background | `#F6F8FA` | `#0B1420` |
| Surface | `#FFFFFF` | `#142131` |
| Primary text | `#142230` | `#F4F7FA` |
| Secondary text | `#59697A` | `#AAB9CA` |
| Border | `#DDE5EC` | `#2B3C50` |
| Success | Accessible emerald | Accessible emerald |
| Warning | Accessible amber | Accessible amber |
| Error | Accessible red | Accessible red |

Typography: choose a platform-safe, highly readable typeface (Inter if properly bundled/compatible; otherwise native system fonts). Use a restrained scale (e.g., headline 28–32sp, section 20–24sp, body 15–17sp, label 12–14sp), respecting system font scaling. Use 4/8-point spacing rhythm, 12–20px card radii, subtle separators, safe areas and keyboard-aware forms. Tap targets should generally be at least **44 × 44 points**; verify platform accessibility guidance. Avoid color-only status indicators.

### 4.2 Reusable components (build before screen refactors)

`AppScreen`, `AppHeader`, `AppButton`, `AppTextField`, `PhoneField`, `MoneyInput`, `AmountDisplay`, `FormError`, `AppCard`, `MaskedCard`, `TransactionRow`, `StatusBadge`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `ConfirmBottomSheet`, `SecurityPrompt`, `RequestCountdown`, `DemoModeBadge`, `PaymentResult`, `ReceiptView`, `OfflineBanner`.

Centralize variants and states: default, focused, disabled, loading, validation error, success, pending and destructive. Components must work in light/dark themes and not depend on screen-specific color hardcoding.

### 4.3 Navigation information architecture

```text
Splash / App initialization
  └── First-launch onboarding (once, skippable)
  └── Unauthenticated: Login → Register / Forgot Password / Reset flow
  └── Authenticated: bottom navigation
        Home          → dashboard / recent activity / pending requests
        Payments      → Request QR / Scan QR / payment request details
        Activity      → filters / transaction details / receipts
        Profile       → account / test cards / security / settings / help

Payment deep flow:
Request QR → Active QR → Shared or Cancelled / Expired / Paid
Scan QR (camera or gallery) → Validate → Review → Verify → Processing → Result → Receipt
```

Keep navigation state recoverable after app backgrounding, network loss and authentication expiry. Never allow a deep link to skip server-side verification.

---

## 5. Feature specifications and acceptance criteria

### F-01 — Splash, onboarding and app startup (P1)

**Build:** branded splash, three lightweight onboarding panels, Skip/Get Started, first-launch flag, no unnecessary permissions at startup. Show initialization loading/error states when checking saved sessions.

**Accept when:** onboarding only appears when relevant; returning users are not forced through onboarding; invalid saved sessions route to Login; splash does not hang during network failure; TalkBack/VoiceOver reads meaningful labels.

### F-02 — Login, register, password recovery and session management (P0/P1)

**Preserve:** current registration and login intent and account data.

**Build:** refined forms, show/hide password, normalized email input, password guidance, inline errors, API loading/disabled states, secure token storage, startup token validation, explicit session expiry handling, safe logout; recovery using a verified email/provider workflow and server-issued expiry-limited reset tokens (or Firebase Auth equivalent if justified).

**Accept when:** no secrets in persistent plaintext; reload retains a valid mobile session; expired/revoked session redirects to Login; wrong credentials never reveal whether an account exists beyond reasonable UX tradeoffs; successful reset invalidates appropriate old sessions; recovery cannot be completed without proving account ownership.

### F-03 — Home dashboard (P1)

**Build:** greeting, Demo label, prominent Scan QR / Request Payment actions, small summary of **simulated** sent and received totals (not available balance), pending request preview, last five activities, pull to refresh, skeletons and empty/error states.

**Accept when:** statistics match server records; refreshing cannot duplicate entries; no fictional wallet; primary actions reachable within one or two taps; informative state when no transactions exist.

### F-04 — QR creation and request lifecycle (P0/P1)

**Preserve:** amount-based payment request, reference/description and currently intended five-minute expiry.

**Build:** validated N$ amount input, optional reference, server-created QR, large scannable code, real server-derived countdown, share image securely, active/pending/paid/expired/cancelled statuses, list of user's requests, safe request cancellation, regenerate-new-request option.

**Accept when:** amounts are positive, finite, bounded and rounded deterministically in minor units; malformed TTL cannot bypass expiry; expired/paid/cancelled requests are rejected; user cannot cancel another user's request; status updates while screen is open; sharing works with appropriate permissions; QR includes no unnecessary PII.

### F-05 — QR camera scan and import from gallery (P1)

**Build:** scanner with camera permission at point of use, framing overlay, torch if available, scan-once UI lock, import QR image from gallery, unified backend validation, clear invalid/expired/used/self-payment messages, retry.

**Accept when:** only valid signed requests can proceed; duplicate scanner callbacks do not navigate twice; image input follows the same backend checks as camera input; permissions denied show clear guidance; scanner works after background/resume.

### F-06 — Payment review, verification and simulated confirmation (P0/P1)

**Preserve:** recipient-requested QR, payer selection of test card and explicit verification before completing simulation.

**Build:** recipient and amount hierarchy, masked card chooser, reference, expiry, clear **Confirm simulated payment** action, loading state, OTP/biometric coordination, idempotency request ID, definitive success/failure result screens.

**Accept when:** client cannot change server-authoritative amount/recipient; user approves the current live request; one request results in at most one completed simulated payment; auth belongs to the same payer/request/purpose and can only authorize once; errors preserve a safe path back; no fake success after backend failure.

### F-07 — Cards and sandbox instruments (P0/P1)

**Build:** clean masked card visuals, brand/last4, default badge, add/test-card flow, remove confirmation, prevention of invalid expiry and invalid test numbers, clear test-only labeling.

**Accept when:** exactly one default instrument if at least one exists (or documented empty/default behavior); removed cards are inaccessible; backend enforces ownership; CVV/raw PAN never stored or logged; a mock payment-method ID cannot be misrepresented as a real Stripe token.

### F-08 — Activity, details and simulated receipts (P1)

**Build:** Activity bottom tab, All/Sent/Received/Status filters, date/search, pagination, detail screen with transaction ID, payer/recipient, N$, timestamp, method and status; export/share a PDF or shareable view labelled **Simulated / No real funds transferred**.

**Accept when:** each user sees only own transaction views; counterpart records agree on amount/status/reference; receipt IDs resolve server-side; exports omit unnecessary PII; no empty state is mistaken for a network failure.

### F-09 — Profile, appearance, accessibility, security settings (P1/P2)

**Build:** profile photo, editable name/contact fields subject to validation and verification, account actions, password change, biometrics preference, notification preference, light/dark/system theme, Help/FAQ, About and privacy disclosure.

**Accept when:** updates persist, sensitive changes reauthenticate, email/phone changes use verification where required, logout clears local credentials and sensitive cached data; inaccessible features are not rendered as functional buttons.

### F-10 — In-app notifications and lifecycle feedback (P2)

**Build:** an in-app notification/activity inbox for request created/paid/expired, and optional device notifications gated by consent and available infrastructure. Avoid promising push notifications unless the delivery backend is implemented.

**Accept when:** notifications are deduplicated, attributable to the right user, hide sensitive content on lock screen where feasible, and cannot serve as sole authority for payment state.

### F-11 — Connectivity and reliability (P1/P2)

**Build:** offline banner, non-destructive retry, resilient loading, request cancellation, auth retry/refresh policy, clear payment-unknown states, app lifecycle recovery, focus refetch.

**Accept when:** losing connectivity never yields a false “paid” status; retries use the same idempotency key; app can reconcile uncertain outcomes with authoritative server request/transaction status.

---

## 6. Security and data-integrity requirements (release blockers)

### SEC-01 — User identity and token lifecycle

- Choose one coherent auth/token verification model and document it; do not mix unverifiable JWT claims and Firebase identity assumptions.
- Store tokens securely on native; avoid browser `localStorage` for sensitive long-lived tokens unless deliberate and threat-modeled. Handle web separately if web support is retained.
- Validate token issuer/signature/expiry, current user status and expected claims on the server.
- Use stable UID references, not lossy email replacements; protect/migrate existing records after auditing real schema.

### SEC-02 — Verified OTP protocol

- Never use a hardcoded Twilio trial phone number; the trial has expired.
- Introduce an explicit `OTP_PROVIDER=mock|twilio` (or equivalent) with **mock allowed only in emulator/development**. Production must fail securely if a real provider is absent.
- Server determines verified destination from the user's account, not arbitrary client input for payment approval.
- Session must bind `userId`, `purpose`, `requestId`, `amountMinor`, `expiresAt`, `attempts` and status; require authenticated-owner match.
- Use CSPRNG for OTP; hash at rest; constant-time comparison where applicable; rate-limit per user/destination/IP; enforce resend cooldown and maximum attempts.
- Consume OTP/payment authorization **once**, atomically, and reject replay, cross-user and cross-purpose attempts.
- Do not treat on-device biometric success as equivalent to server-side payment authorization unless backed by a secure, server-verifiable protocol. Biometrics may unlock a locally stored credential only where threat-modeled and tested.

### SEC-03 — QR request and payment atomicity

- Canonical payment model: `requestId`, `requesterUid`, `amountMinor`, `currency=NAD`, `reference`, `status`, `createdAt`, `expiresAt`, `payerUid?`, `transactionId?`, `version?`.
- Validate and sign minimal QR payload (request ID/token + expiry + signature), then load current record server-side.
- Use transactional/conditional state transition `pending -> processing -> completed` with safe reconciliation of interrupted operations. Handle `expired`, `cancelled`, `failed` explicitly.
- Implement server-side idempotency keyed to request/operation; never rely on disabling the button alone.
- Ensure sender/recipient records are consistent; use Firebase multi-location updates or an auditable settlement record and idempotent projection; design for crash/retry recovery.
- Prevent self-payment, negative/NaN/infinite/overflow amounts, expired requests, replay and cross-user card use.

### SEC-04 — Cards, payment sandbox and privacy

- **Do not collect or process real cards in this demonstration.** Provide predefined documented test card inputs or test-provider components only; reject/live-gate production-looking flows as needed.
- Never store or log CVV, PAN, Firebase private keys, OTPs, authorization headers or session tokens.
- Clearly label mock bank mapping. Never assert PCI DSS compliance or real settlement.
- Keep secrets in protected environment variables; use `.env.example` with placeholders only.

### SEC-05 — Firebase rules and API protection

- Audit Firebase Realtime Database rules against actual UID and data path layout; close permissive writes and enforce user ownership.
- Restrict client access as needed; privileged backend service-account writes must still enforce authorization because Admin SDK bypasses Firebase rules.
- Validate API schemas, apply abuse limits to login, OTP, QR and payment endpoints, sanitize logs/error responses and enforce HTTPS outside local development.
- Introduce request IDs / correlation IDs without sensitive payload logging.

### SEC-06 — Dependency and supply-chain controls

- Perform `npm audit` (or equivalent) on each package root; classify findings by exploitability, do not blindly apply breaking `--force` upgrades.
- Verify supported Expo/React Native/React Navigation versions **at implementation time**; do not trust old README compatibility claims.
- Remove obsolete/duplicated dependencies and unneeded sensitive permissions.
- Add CI checks for lint, typecheck, tests, secret scanning, lockfile integrity and dependency advisories where feasible.

---

## 7. API contract and migration constraints

Codex must generate `docs/api/CONTRACT.md` with **actual** routes, expected payloads, auth requirements, response models and errors before refactoring network code.

| Current API area | Observed path(s) | Planned action |
|---|---|---|
| Authentication | `/api/auth/register`, `/login`, `/verify`, `/logout` | Preserve behavior, correct session validation; extend secure reset flow as needed. |
| User profile | `/api/users/profile`, `/password`, `/photo` | Preserve; validate ownership, input types, uploads and error handling. |
| Cards | `/api/payments/cards`, `/link-card`, `/set-default-card/:cardId`, `/remove-card/:cardId` | Preserve, harden and label test-only. |
| QR | `/api/qr/generate`, `/scan`, `/confirm-payment`, `/requests` | Preserve; add safe status/cancel capabilities. Reconcile stale frontend `/qr/history`. |
| Payments | `/api/payments/process-payment`, `/history` | Keep mock semantics; clarify relationship to QR-confirm flow, avoid duplicate implementations. |
| OTP | `/api/otp/send`, `/verify`, `/resend`, `/status/:sessionId` | Bind to user/purpose/request; mock provider in dev only. |
| Dashboard | `/api/users/transactions`, `/stats` | Preserve; confirm no `users/balance` endpoint before displaying balance. |

**Compatibility policy:** Prefer new endpoints and adapters over breaking changes; if route signatures change, update frontend, backend, tests and docs in one phase. Maintain a migration note with before/after example payloads. Avoid releasing frontend and backend versions that cannot communicate.

**Response conventions:** consistent status/error codes (`400` invalid input, `401` unauthenticated, `403` unauthorized, `404` absent, `409` already processed/conflict, `410` expired where appropriate, `429` throttled, `5xx` internal), stable error identifiers, no internal stack traces in API replies.

---

## 8. Data model and transaction invariants

### 8.1 Suggested canonical entities (adapt, do not blindly replace)

```text
User(uid, emailVerified, phoneVerified, firstName, lastName, profilePhotoUrl?, status)
TestCard(id, ownerUid, mockMethodId, brand, last4, bankLabel, isDefault, createdAt)
PaymentRequest(id, requesterUid, amountMinor, currency, reference?, status,
               createdAt, expiresAt, payerUid?, transactionId?, version)
VerificationSession(id, userUid, purpose, requestId, amountMinor,
                    challengeHash, attempts, expiresAt, verifiedAt?, consumedAt?)
SimulatedTransaction(id, requestId, payerUid, requesterUid, amountMinor,
                     currency, status, createdAt, completedAt?, methodLabel)
UserTransactionView(id, ownerUid, role=sent|received, transactionId, status)
Notification(id, recipientUid, eventType, requestId?, createdAt, readAt?)
```

Do **not** write a fake wallet balance into this model. If legacy records have different field names, use a compatibility adapter or script verified against an anonymized fixture.

### 8.2 Must-always-hold invariants

- `amountMinor` is a positive safe integer within a documented prototype limit.
- Currency is `NAD` for this version.
- Only requester can cancel a pending request.
- Only eligible payer with a test card can approve; requester cannot pay self.
- Request can only transition once into completed state; duplicate requests return same result or a safe conflict.
- Every completed transaction links back to one request, one payer and one recipient.
- Both users' views share the same canonical transaction ID and amount.
- A verification session cannot authorize a different user, amount or request.
- Failed or expired requests never generate a `completed` transaction.

---

## 9. Recommended technology evolution

### 9.1 Preserve where sensible

React Native/Expo, React Navigation, React Native Paper (or compatible stable UI layer), Axios, Express, Firebase Realtime Database and the sandbox simulation architecture.

### 9.2 Target improvements

- Migrate application code **incrementally** to TypeScript with strict compiler checks after compatibility is stabilized.
- Adopt reusable design tokens and modern theme APIs; avoid screen-level hard-coded colors.
- Use a maintained query/cache layer (e.g., TanStack Query) only if it reduces complexity; distinguish server state from local UI state.
- Choose supported form validation and schema validation libraries only where they replace duplicated form logic.
- Introduce secure storage on native, and explicitly document web tradeoffs if web is kept.
- Reevaluate deprecated Expo scanning/permissions packages and remove unnecessary webpack/browser polyfills if no longer required.
- Pin versions to a validated dependency matrix in lockfiles. **Do not automatically jump to a just-released SDK without an upgrade matrix and regression suite.**

### 9.3 Recommended feature-oriented layout

```text
frontend/src/
  app/{navigation,providers,config}/
  components/{ui,layout,forms,feedback}/
  features/{auth,home,qr,payments,cards,activity,profile,settings}/
  services/{api,storage,notifications}/
  theme/{colors,typography,spacing,index}/
  hooks/ types/ utils/ assets/
backend/
  config/ middleware/ routes/ services/ validation/ repositories/ tests/
docs/
  implementation/ api/ design/ security/ testing/
```

Respect working imports during migration; separate behavioral code changes from mechanical file moves when possible.

---

## 10. Phased implementation backlog — execute in this order

**Priority legend:** P0 = must fix before shipping core flow; P1 = essential professional experience; P2 = polish/support; P3 = optional future enhancement.

### PHASE 0 — Baseline, inventory and safe workspace (P0)

**Task P0-01.** Inspect latest default branch, open PRs, package scripts, Firebase schema, environment examples, all screens and routes. Record actual feature status and discrepancies from this specification.

**Task P0-02.** Set up reproducible development via Docker/Node scripts where appropriate and Firebase Emulator (preferred). Provide test-only fixture accounts, QR data and cards; prohibit real SMS/card operations.

**Task P0-03.** Fix current test harness: ensure backend module is testable without starting uncontrolled listeners; isolate emulator state; replace outdated card expiries and nondeterministic tests.

**Task P0-04.** Create route contract and baseline snapshots of current major screens. Record toolchain versions and current warnings.

**Deliverables:** `docs/implementation/BASELINE_AUDIT.md`, `docs/api/CONTRACT.md`, `docs/testing/TEST_MATRIX.md`, functioning local test instructions, initial smoke tests.

**Exit gate:** Can install, launch, register/login, generate/scan a QR and run a minimal backend test suite in an isolated test environment—or document a concrete blocker plus reproducible failing tests without inventing success.

### PHASE 1 — Security, data integrity and core flow stabilization (P0)

**Task P1-01.** Replace `Map` auth-token storage; implement secure persistence, startup verification, expiry and logout cleanup.

**Task P1-02.** Remove literal trial phone numbers; introduce a verified-destination resolver and safe emulator/mock OTP provider with no production bypass.

**Task P1-03.** Bind OTP sessions to user + purpose + request + amount; consume authorization atomically and reject replay.

**Task P1-04.** Make simulated payment confirmation idempotent and concurrency-safe; reconcile intermediate states and counterpart records.

**Task P1-05.** Audit UID/path mismatch and Firebase rules; preserve/migrate test fixtures with documented strategy.

**Task P1-06.** Harden QR signatures, TTL and amount validation, status checks, request ownership, logging and API error responses.

**Task P1-07.** Align frontend API client with backend endpoints. Remove any unsupported balance claims and stale direct-IP configuration.

**Task P1-08.** Add regression tests for all security invariants (see Section 14).

**Deliverables:** tests + security fixes + updated emulator fixtures + `docs/security/SECURITY_DECISIONS.md`.

**Exit gate:** All negative payment/auth/QR test cases pass, including concurrent confirmations and OTP replay; no real provider credentials required for test execution.

### PHASE 2 — Design tokens, UI components, app shell (P1)

**Task P2-01.** Define light/dark tokens, typography, spacing, elevation and component states. Create a documented component catalog.

**Task P2-02.** Introduce consistent four-tab navigation (Home, Payments, Activity, Profile), with stack subflows and protected screens.

**Task P2-03.** Build onboarding and polished auth loading/empty/error screens; respect screen readers and reduced-motion preferences.

**Task P2-04.** Refactor repetitive UI into reusable controls without altering server contracts.

**Deliverables:** component library, navigation, onboarding, screenshots of light/dark examples, design notes.

**Exit gate:** consistent components and navigation across sample screens; device size and accessibility checks pass.

### PHASE 3 — QR request and payment journey redesign (P1)

**Task P3-01.** Redesign Request QR entry/active views and server-backed status countdown.

**Task P3-02.** Implement QR request listing, safe cancellation and regeneration as new request.

**Task P3-03.** Redesign camera scanning; add gallery QR import where supported.

**Task P3-04.** Redesign review with amount/recipient/method/expiry, explicit demo label and confirm guard.

**Task P3-05.** Integrate OTP or approved sandbox verification, payment processing, result states and retry/reconciliation.

**Deliverables:** complete screenshot/flow set; working two-account cross-device demonstration.

**Exit gate:** two users can complete and review exactly one simulated transaction; negative QR and OTP flows remain blocked.

### PHASE 4 — Dashboard, cards, activity and receipts (P1)

**Task P4-01.** Build new dashboard and request overview based on real server records.

**Task P4-02.** Redesign test-card list, masked details, default action, add/remove confirmation.

**Task P4-03.** Add activity filters, transaction details, pagination and shareable simulated receipt.

**Task P4-04.** Refactor profile and settings with usable account, security and appearance controls.

**Deliverables:** polished main tabs and account experience.

**Exit gate:** correct stats, ownership-restricted transactions, clear receipt disclaimer, consistent cards and settings.

### PHASE 5 — Reliability, accessibility and optional notifications (P2)

**Task P5-01.** Add offline banners, skeletons, API error mapping, retry controls and background-resume reconciliation.

**Task P5-02.** Build in-app status notifications and user notification settings; push only if complete infra exists.

**Task P5-03.** Audit screen readers, font scaling, contrast, motion, touch sizes, safe areas and keyboard behavior.

**Task P5-04.** Add controlled micro-interactions without obstructing core tasks or increasing motion unnecessarily.

**Deliverables:** accessibility report and resilient UX states.

**Exit gate:** no incorrect payment outcome under simulated network loss; accessibility checklist passes.

### PHASE 6 — QA, documentation, CI and demo release (P0/P1)

**Task P6-01.** Expand frontend unit/component tests, backend integration tests and end-to-end payment-flow tests.

**Task P6-02.** Run dependency/security scans, static checks, secret scanning and source review; resolve/highlight material findings.

**Task P6-03.** Test on at least one Android physical device and emulator; iOS simulator/device if available. Add web coverage only if web is officially supported.

**Task P6-04.** Update README, Setup, API docs, architecture, demo-mode disclosure, test instructions, feature inventory, screenshot gallery and release notes.

**Task P6-05.** Produce a versioned demo build using EAS or equivalent, without production provider keys or public test credentials.

**Deliverables:** build artifact/configuration, passing CI, reproducible tests, final checklists, release notes and unresolved-risk summary.

**Exit gate:** all mandatory criteria in Sections 1, 6, 8, 14 and 15 pass; no critical unresolved vulnerabilities; product is accurately described as a sandbox prototype.

---

## 11. Screen-by-screen UX detail and interface states

| Screen | Primary controls | Mandatory states |
|---|---|---|
| Splash | Logo / loading | initializing, offline validation failure |
| Onboarding | Skip, Next, Get Started | first launch, completed, revisiting optional |
| Login | email, password, Sign In, Forgot Password | empty, invalid, loading, auth failure |
| Registration | name, email, verified phone as needed, password | inline validation, duplicate, success |
| Home | Scan QR, Request, recent transactions | first-use empty, refreshing, partial network failure |
| Payments hub | Request QR, Scan QR, pending requests | none, pending, expired, paid |
| QR create | amount, optional reference, Generate | invalid amount, loading, created |
| QR active | code, countdown, Share, Cancel, Regenerate | pending, expiring, paid, expired, cancelled |
| Scanner | camera, torch, gallery, retry | permission denied, detecting, invalid, expired, processing |
| Payment review | recipient, N$, masked test card, Confirm | valid, expiring, expired, missing card, duplicate tap |
| OTP | six-digit input, countdown, resend, verify | sending, wrong code, throttled, expired, accepted |
| Payment result | status, reference, receipt action | processing, completed, failed, uncertain/reconciling |
| Cards | cards, Add, Default, Remove | none, adding, invalid, changed, removal failure |
| Activity | tabs/filters/search, item details | no results, pagination, network error |
| Receipt | complete simulation metadata, Share | available, loading, export error |
| Profile/settings | account, security, theme, help, logout | loading, invalid update, updated, logged out |

### 11.1 Content design and Namibian localization

- Currency label: **N$** with `NAD` in data/API; format with two decimals; do not round via floating-point assumptions in financial state transitions.
- Date/time: locale-aware, appropriate to Africa/Windhoek when a specific local presentation is needed; store UTC timestamps internally.
- Contact numbers: accept validated Namibian formats with international-code support; avoid fixed examples in production UI.
- Use plain English and short action labels. Errors should explain resolution steps without leaking infrastructure information.
- “Payment successful” messages must say **“Simulated payment completed”** or equivalent where real-money confusion is possible.

---

## 12. UX interaction and visual acceptance standards

- A first-time user sees a complete primary flow without scrolling through unnecessary explanations.
- After login, request/scan actions are visually prominent on Home.
- Amount/recipient/test-mode disclosures remain visible during confirmation.
- Confirmation controls disable immediately, but server idempotency remains authoritative.
- Error recovery retains safe input; payment-specific retry requires current server status reconciliation.
- Any dialog or bottom sheet has keyboard focus management and screen-reader announcements.
- Skeletons and refresh indicators do not shift the layout unpredictably.
- Dark mode covers all screens, status bars, modals, SVGs, charts and toast components.
- Android back, gesture navigation, keyboard appearance, device rotation where supported and cutout safe areas work.
- Screen capture screenshots must show realistic **synthetic** example data, never real account/card/phone data.

---

## 13. Codex engineering operating procedure

### 13.1 Start of execution

1. Open the repository; determine current default branch, existing branch protection and unmerged work. Do not overwrite collaborator changes.
2. Confirm exact versions, run available install/lint/test commands and save baseline outcomes. Do not claim passes without actually running commands.
3. Create `docs/implementation/PROGRESS.md`, `docs/implementation/DECISIONS.md` and `docs/implementation/BASELINE_AUDIT.md`.
4. Execute phases **in order**; work on one small coherent feature batch at a time.
5. When unable to access live external accounts, use mocks/emulators and mark the limitation. Do not request personal credentials in chat or hardcode them in code.

### 13.2 PR and change discipline

- Prefer small reviewable commits/PRs grouped by task IDs. Use branches; do not force-push/rewrite history or merge destructive changes without user approval.
- Prefer incremental screen refactors. Commit snapshots or visual regression fixtures where useful.
- Each PR description contains **Task IDs, behavior preserved, interfaces changed, tests run/results, screenshots, known issues and manual QA**.
- Maintain an audit trail when moving data or modifying auth/payment paths.
- Update documentation with the implementation; do not defer until the end.

### 13.3 Decision and blocker policy

- Resolve minor implementation choices autonomously within this spec.
- **Stop and request explicit approval** for enabling real payments, introducing production SMS charges, collecting real card details, destructive production data migrations, deleting transaction history, force-pushing rewritten Git history, or changing the core business model.
- If a required credential/device is unavailable, isolate work using fixtures and continue all other tasks.
- Never report an unrun test as successful. When evidence is missing, state “Not verified” and next step.

### 13.4 Definition of done per task

Each task requires: implemented behavior, validation against acceptance criteria, tests, documentation if contracts changed, appropriate error/empty/loading states, accessibility checks, screenshots for visual work, and a clear progress entry. Failed mandatory checks leave the task **Blocked** or **Needs work**, not Done.

---

## 14. Testing plan and required negative scenarios

### 14.1 Minimum automated layers

| Layer | Required coverage |
|---|---|
| Unit | Amount parsing, QR expiry/signature helper, validators, money formatting, user/card mapping, status transitions. |
| Component | Login/register, QR form, masked card, payment review, loading/empty/error, receipt, accessibility labels. |
| API integration | Auth/register/login, cards, QR request lifecycle, OTP binding, payment idempotency, transaction reads, ownership. |
| Emulator integration | Firebase rules/UID schema, concurrent updates, simulated auth/send/receive. |
| End-to-end | Two users: create request, share/scan, verify, complete, check both histories; representative error flows. |
| Static & supply chain | Lint, typecheck, dependency audit, secret checks and config validation. |

### 14.2 Security / correctness test cases (all P0)

| ID | Scenario | Required result |
|---|---|---|
| T-01 | Payer scans valid pending QR | Review shows correct server-authoritative amount and requester. |
| T-02 | Tampered QR signature | Rejected without exposing internal details. |
| T-03 | QR is expired | Payment cannot proceed. |
| T-04 | QR already completed | Cannot pay again; shows existing result or safe conflict. |
| T-05 | Same user creates and pays own request | Rejected. |
| T-06 | Negative, zero, NaN, infinite or huge amount | Rejected server-side. |
| T-07 | OTP for user A used by user B | Rejected. |
| T-08 | OTP for request X used on request Y | Rejected. |
| T-09 | OTP reused after a successful payment | Rejected. |
| T-10 | OTP wrong repeatedly / resend abused | Account/session throttled appropriately. |
| T-11 | Two concurrent confirms for same request | Exactly one canonical simulated transaction. |
| T-12 | Client retries after timeout | Same result; no duplicate transfer. |
| T-13 | Auth token expired or forged | Unauthorized request rejected. |
| T-14 | User attempts another user's card or profile | Rejected. |
| T-15 | Client attempts a Firebase rule-bypassing write | Rejected as applicable; backend remains responsible for privileged writes. |
| T-16 | Network disconnects after request is submitted | UI reconciles state; never falsely claims success/failure. |
| T-17 | Card input contains real-looking PAN/CVV | No sensitive data persisted or logged; test-only mode enforced. |
| T-18 | Receiver and payer activity after completed payment | Same amount, transaction ID and status; opposing sent/received roles. |
| T-19 | Cancellation races with payment | Exactly one allowed terminal outcome. |
| T-20 | No SMS provider configured | Dev emulator uses explicitly marked mock; non-dev fails closed. |

### 14.3 Visual and device QA

Check compact and large Android displays, safe area, 200% text scaling where supported, dark theme, color contrast, TalkBack/VoiceOver, portrait screens, screen-reader order, offline mode, background/resume and camera permission denial. iOS support is validated when suitable hardware/simulator is available; do not invent iOS test results.

### 14.4 CI quality gates

Use repository-appropriate commands (`npm ci`, `npm test`, lint, typecheck, native/web checks), with adjusted scripts where missing. Require deterministic mocks/emulators and separate unit from device/E2E suites. Prefer a buildable artifact as evidence over “works on my machine” text.

---

## 15. Release checklist / product acceptance gate

A NamPay 2.0 release candidate is acceptable **only if all mandatory items below are verified**:

- [ ] Existing two-account QR-to-payment prototype workflow works end to end.
- [ ] OTP is bound to payer, amount, request and purpose; never hardcoded to trial number.
- [ ] One QR request cannot create more than one completed simulated payment.
- [ ] No live-money, real-bank or certified PCI claims are made.
- [ ] No raw PAN/CVV/secrets/OTP/token leaks in repository, storage or logs.
- [ ] Native session persistence and logout behavior are secure and tested.
- [ ] Firebase UID/data access rules and server-side authorization are consistent.
- [ ] Feature screens share design tokens, support dark mode and include accessible states.
- [ ] Activity, transaction details and simulated receipts reflect canonical records.
- [ ] API contract matches deployed frontend/backend code; no broken missing routes.
- [ ] Tests T-01 through T-20 pass or are explicitly documented as non-applicable with justification.
- [ ] At least Android smoke/device verification completed; iOS stated honestly if not tested.
- [ ] README, developer setup, mock provider setup, API and release documentation updated.
- [ ] No high/critical unmitigated security finding remains without explicit acknowledged exception.
- [ ] Final implementation report lists completed features, screenshots, test results and remaining limitations.

---

## 16. Execution tracking artifacts and handoff output

### 16.1 Required files Codex should maintain in the repository

```text
docs/implementation/BASELINE_AUDIT.md
docs/implementation/PROGRESS.md
docs/implementation/DECISIONS.md
docs/implementation/RELEASE_NOTES_2_0.md
docs/api/CONTRACT.md
docs/design/DESIGN_SYSTEM.md
docs/security/SECURITY_DECISIONS.md
docs/testing/TEST_MATRIX.md
```

`PROGRESS.md` should be a live checklist grouped by phase/task ID, showing `Not started / In progress / Done / Blocked / Needs verification`, a commit/PR link, tests and next action. Codex must resume from this file rather than repeating completed tasks.

### 16.2 Example progress record

```text
P1-03 — Bind OTP session to payment and payer
Status: Done
Changes: backend/middleware/otpAuth.js; backend/services/otpService.js
Compatibility: existing QR confirm API retains requestId and sessionId
Evidence: auth/payment integration tests passing; negative cases T-07/T-08/T-09
Notes: Test provider only; production SMS provider not configured
PR/Commit: <link>
```

### 16.3 Final response format required from Codex

1. **Implemented:** phases and key user-visible improvements.
2. **Verified:** exact commands executed, test counts/results, devices/builds tested.
3. **Changed contracts/data:** route, schema and migration notes.
4. **Security:** issues fixed, remaining risks and demo-mode restrictions.
5. **Artifacts:** PRs, branch, build outputs, screenshots and documentation paths.
6. **Outstanding work:** blockers with clear next actions; no false completeness claims.

---

## 17. Out-of-scope features and approval-required changes

**Not authorized by this plan:** real cross-bank settlement, real card capture, live Stripe charges, real merchant acquisition, new custodial wallet balances, cryptocurrency, loans, investments, production KYC, international remittance, unapproved cloud billing, personal data export to third parties, production database deletion, provider credential rotation, or Git-history force rewrite.

These are separate projects or high-impact operational actions; require explicit approval before development or execution.

---

## 18. First executable instructions for Codex

**After reading this document, start working immediately in the repository.** Do not produce only another high-level roadmap. Run baseline inspection and tests; write the required audit/progress documents; fix the Phase 1 security and payment-integrity issues; then implement the UI/UX and missing features phase by phase while continuously testing. Create reviewable PRs/commits, never commit credentials, and keep the prototype's simulated payment functionality intact. If a phase is blocked, record why and continue with independent tasks. Report honestly what has and has not been verified.

**Reminder:** This blueprint is intentionally self-contained. Codex should consult current official dependency documentation and current repository state during implementation, and should treat static code observations as issues to validate rather than assuming runtime behavior. No changes to the repository were made when this blueprint was authored.
