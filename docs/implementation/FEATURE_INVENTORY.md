# Implemented feature inventory

This inventory maps the NamPay 2.0 blueprint to the current code. “Implemented”
means the flow exists and has the linked automated/browser coverage; it does
not imply native-device acceptance or production readiness. Current execution
results and unresolved release checks belong in the
[test matrix](../testing/TEST_MATRIX.md) and [progress log](PROGRESS.md).

NamPay is a sandbox demonstration. Requests and receipts represent simulated
payments, Home displays historical totals, and no screen exposes a spendable
balance. Test instruments are predefined synthetic choices. There is no real
card capture, live money transfer or push-notification service.

## Feature map

| Blueprint feature | Current behavior | Primary implementation / evidence |
| --- | --- | --- |
| F-01 · Startup and onboarding | Three introduction panels, Skip/Get started, first-launch preference, branded initialization and server session check. Camera/gallery/biometric permissions are not requested at startup. | [App.js](../../frontend/App.js), [OnboardingScreen](../../frontend/src/screens/auth/OnboardingScreen.js), [auth browser check](../../scripts/browser-auth-smoke.cjs) |
| F-02 · Account and sessions | Registration/login validation, password visibility, duplicate-submit guards, normalized email, startup/resume verification, native SecureStore bearer token, web HttpOnly cookie, revocation and expiry. Recovery checks capability and requires a one-use server token; the available demo delivery is a private local outbox. | [AuthContext](../../frontend/src/context/AuthContext.js), [auth screens](../../frontend/src/screens/auth), [auth service](../../backend/services/authService.js), [security decisions](../security/SECURITY_DECISIONS.md) |
| F-03 · Home | Greeting and demo badge, Scan/Request actions, authoritative integer-cent sent/received totals, three pending request previews, latest five activities, independent loading/error sections and pull/focus/resume refresh. No balance or float fallback. | [HomeScreen](../../frontend/src/screens/main/HomeScreen.js), [Home tests](../../frontend/src/screens/main/__tests__/HomeScreen.test.js), [feature evidence](../testing/FEATURES.md) |
| F-04 · QR requests | Exact-cent amount parsing, optional reference/note, five-minute signed requests, server-clock countdown, owned list/detail, cancellation confirmation, terminal states, new-request regeneration, QR sharing/download. Request creation does not require a card. Ambiguous creation directs the user to existing requests. | [request screens](../../frontend/src/screens/qr), [request tests](../../frontend/src/screens/qr/__tests__/RequestScreens.test.js), [payment contract](../api/PAYMENTS_V2.md) |
| F-05 · Camera and image scan | Explicit Start camera action, permission recovery, local image import, bounded decoding, one shared scan lock, cleanup on blur/background, server signature/expiry/self-payment checks before review. Web uses bundled jsQR; native uses Expo Camera. | [QRScanScreen](../../frontend/src/screens/qr/QRScanScreen.js), [scanner components](../../frontend/src/components/qr), [scanner evidence](../testing/SCANNER.md) |
| F-06 · Review and confirmation | Reloaded recipient/amount, owned masked card choice, request-bound OTP and resend limits, optional local device confirmation, one stable idempotency key, uncertain-result reconciliation and canonical simulated result. Biometrics cannot replace OTP authorization. | [payment flow controller](../../frontend/src/features/payments/paymentFlow.js), [payment screens](../../frontend/src/screens/payment), [OTP screen](../../frontend/src/screens/auth/OTPVerificationScreen.js), [two-account browser check](../../scripts/browser-payments-smoke.cjs) |
| F-07 · Test cards | Server catalog choices only, masked brand/last four, add/remove confirmation, server-selected default, expired/legacy warnings and list reconciliation after every mutation. Lost responses do not produce optimistic success. No PAN/CVV/expiry-entry form. | [CardsScreen](../../frontend/src/screens/profile/CardsScreen.js), [card tests](../../frontend/src/screens/profile/__tests__/CardsScreen.test.js), [card API](../../backend/routes/payments.js) |
| F-08 · Activity and receipts | All/Sent/Received/status filters, search and Namibia calendar-date range, server pagination, deduplicated refresh, authorized transaction detail and historical records. Receipts disclose simulation and exclude private verification/contact fields. Web shares text or downloads HTML; native shares text through the OS. | [activity model/feed](../../frontend/src/features/activity), [TransactionDetailScreen](../../frontend/src/screens/profile/TransactionDetailScreen.js), [receipt exports](../../frontend/src/services/receipts), [feature evidence](../testing/FEATURES.md) |
| F-09 · Profile and settings | Editable names, selected-photo preview before explicit upload, PNG/JPEG/WebP validation up to 1 MiB, password change with current proof, light/dark/system appearance, in-app alert and optional device-confirmation preferences, Help/FAQ and About/privacy. Email/phone are read-only without verified delivery. | [profile screens](../../frontend/src/screens/profile), [photo adapters](../../frontend/src/features/profile), [profile/settings tests](../../frontend/src/screens/profile/__tests__/ProfileSettings.test.js), [accessibility evidence](../testing/ACCESSIBILITY.md) |
| F-10 · In-app updates | Owned created/expired/payment events, deterministic deduplication, unread markers, foreground polling, resume/reconnect refresh and immediate clearing on account changes. Muting badges preserves inbox/history. Opening an update reloads an authorized record. | [NotificationContext](../../frontend/src/context/NotificationContext.js), [notification model](../../frontend/src/features/notifications), [NotificationsScreen](../../frontend/src/screens/profile/NotificationsScreen.js), [notification API tests](../../backend/tests/notifications.test.js) |
| F-11 · Connectivity and recovery | Visible connection notice, read-only recovery probes, writes blocked before transport when known offline, retained form drafts, focused refresh and stale-response guards. Transmitted writes are reconciled; they are never silently queued/replayed. | [NetworkContext](../../frontend/src/context/NetworkContext.js), [API client](../../frontend/src/config/api.js), [focused resource hook](../../frontend/src/screens/qr/useFocusedResource.js), [reliability evidence](../testing/RELIABILITY.md) |

## Navigation and compatibility

The visible tabs are **Home, Payments, Activity and Profile**. The protected
stack contains request generation/list/detail, scanner, payment review/OTP/result,
test cards, transaction details, profile editing, settings/password change,
notifications and Help/About. Authentication and protected history use separate
navigation groups so logout removes the authenticated stack.

`QR` remains an alias of `QRGenerate`; `Transactions` remains a stack entry to
the Activity screen. The legacy `BiometricAuth` route is retained, but the current
payment journey uses the capability-gated prompt in `PaymentConfirm` followed by
server OTP. A route payload never proves payment completion or card ownership.

Backend compatibility preserves verified legacy account UIDs, copies older
email-keyed users without deleting originals, reads historical transactions and
accepts the documented signed-envelope/card-field aliases. It does not reopen
expired QR codes, authorize legacy unbound OTP sessions or re-enable direct
amount/recipient-only payments. See the
[architecture](../architecture/ARCHITECTURE.md) for the record model and atomic
completion boundary.

## Verified behavior and evidence limits

Automated coverage exists at four different levels; they are not interchangeable:

| Evidence | What it establishes |
| --- | --- |
| Backend Jest suites | Authentication, ownership, OTP binding, atomic/idempotent simulation, card/default behavior, history, notification expiry and read markers. |
| Frontend Jest/component suites | Validation, safe mappings, lifecycle/race handling, controlled failure states, semantics, masking and export contents. Native modules are mocked where required. |
| [Actual Firebase emulator checks](../testing/EMULATORS.md) | Repository CRUD/rollback/concurrency, direct-client rule denial, real API startup and concurrent simulated confirmations producing one transaction. |
| Browser scripts and [screenshots](../design/SCREENSHOTS.md) | Synthetic account journeys, actual web QR image import, response-loss reconciliation, cards/history/profile/settings, cookie behavior, offline drafts, inbox and selected keyboard/layout checks in Chromium. |

The browser payment flow uses two independent synthetic accounts and reads a
server-generated mock OTP from the private local operator outbox. It does not
return codes through the public API, fabricate a payment record or use a fixed
universal verification code.

## Available only with limits, or not provided

- **Native verification remains outstanding:** Android/iOS secure restart,
  physical camera/gallery, actual biometric enrollment/cancellation, native share
  sheets, keyboards/safe areas/rotation, TalkBack/VoiceOver and enlarged native
  text have not been demonstrated by browser or mocked component checks.
- **Native torch controls are unavailable.** Web exposes a torch action only
  when its video track reports support. The installed native Expo Camera API
  does not expose a capability query, so the UI does not promise a working torch.
- **Email/phone ownership changes are unavailable.** The backend advertises
  those capabilities as false and rejects changed contact fields. Optional
  registration phone input is not a verified delivery destination.
- **Recovery is a local demo flow.** No production email recovery provider or
  real SMS delivery was enabled or verified. Optional provider code does not
  establish operational delivery capability.
- **No device push notifications.** Inbox alerts exist only inside the app;
  there is no push registration, lock-screen delivery or push permission prompt.
- **Receipts are shareable text/HTML, not generated PDFs.** Every export is
  explicitly simulated and cannot serve as proof of bank settlement.
- **No persistent payment queue.** Drafts and confirmation state stay in memory
  while their screen/flow remains mounted; they are not restored after process
  death. Reopening requires fresh server reads; no stored OTP or hidden write is
  replayed.
- **Visual coverage is incomplete.** Dark screenshots currently cover wide login
  and compact settings, not every flow. The 200% CSS-zoom capture has no horizontal
  overflow but shows mid-word heading wraps; that remains a readability review.
  Browser CSS zoom is not native font scaling or a screen-reader check.
- **No production/live-finance claim.** Test cards, demo issuer labels, simulated
  receipts and historical totals are not processor tokens, bank accounts,
  spendable balances or settled transfers. Deployment, app-store publication and
  production compliance are not established by local checks.
