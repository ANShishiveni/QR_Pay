# Dashboard, cards and account verification

Phase 4 retains the simulated QR/OTP payment contracts. Home reads completed
integer-minor totals, pending requests and recent transactions from the server.
Cards accepts only catalog identifiers; real card details are never collected.
Card mutations reconcile the server list before reporting a result.

Activity supports direction, status, search and Namibia calendar-date filters,
server pagination, stale-response protection and owned transaction details.
Historical records remain readable. For mixed records, canonical payer/requester
membership is authoritative; a legacy `userId` cannot grant an outsider access.
Receipt export allowlists simulation metadata and excludes contact details,
credentials and verification material. Web can download a self-contained HTML
receipt; native uses the operating system share sheet.

Profile supports names and an explicitly saved photo preview. Email and phone
changes remain read-only because their ownership-verification services are not
available. Settings persist theme, in-app alert and optional device-confirmation
preferences. A wrong current password leaves the session valid; a successful
change revokes all older sessions. Theme radios expose selected state and support
keyboard arrows/Space on web.

## Reproduce the browser check

Start the API with `NODE_ENV=development DEMO_MODE=true DATABASE_MODE=memory
OTP_PROVIDER=mock OTP_OUTBOX_DIR=/workspace/QR_Pay/.local/outbox npm start`
from `backend`. Start the frontend with `EXPO_PUBLIC_API_URL=http://localhost:3000
npm run web -- --localhost`. Then run from the repository root:

```sh
node scripts/browser-features-smoke.cjs
```

The script checks its localhost, development, simulated and memory-database
preconditions before creating synthetic fixtures. It exercises card
add/default/remove, server totals and pending requests, activity filters, owned
detail and downloaded receipt, name/photo consent, persistent theme/alerts,
radio keyboard focus, incorrect password proof and successful password change.
It reads an actual random mock OTP from the private local outbox to create the
transaction fixture; it never prints the code or fixture passwords. The separate
`browser-payments-smoke.cjs` verifies the actual UI payment flow and lost response.

## Evidence — 28 October 2026

- Backend: 90 tests across 5 suites passed, including issuer and mixed ownership
  regressions.
- Browser feature script: passed in Chromium at 390×844, including keyboard theme
  selection, downloaded receipt contents and session behavior.
- Screenshots: `docs/design/screenshots/{home,test-cards,activity-filters,
  transaction-receipt}-light-compact.png` and `settings-dark-compact.png`.
- Frontend: 287 tests across27 suites and TypeScript passed. Component suites cover pagination overlap, stale responses, historical
  timezone boundaries, uncertain card writes, photo limits and sanitized exports.

Native photo picking, biometric hardware, OS share sheets, secure restart and
physical-device accessibility are **not verified** by these browser/component
checks. Account preferences never replace server payment verification.
