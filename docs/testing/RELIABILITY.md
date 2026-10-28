# Reliability and in-app updates

Phase5 connectivity status is held in memory. Browser online/offline events,
API results and foreground health reads update a visible connection notice.
Known disconnection blocks writes before transport; a health read, foreground
resume or a15-second foreground recovery probe can restore connectivity. No
queued write is replayed. Focused request/activity data refreshes on reconnect.
A request rejected before transport retains its editable draft; a response
lost after transmission continues to use the established uncertain-result path.

The notification provider polls only in the foreground, clears immediately on
account change/logout, ignores late responses, and reconciles read markers from
server state. Alerts can be muted without deleting history. Notifications link
to server-verified request/transaction screens and never authorize a payment.
Inbox reads atomically reconcile due owned request expiry without duplicate
events or updates to other accounts.

Optional device confirmation requires the server preference, this account's
local preference, supported native hardware and enrollment. Cancellation stays
on review. A successful local prompt reloads the server request/card before
continuing to OTP; it cannot bypass server authorization. Unsupported devices
receive an honest optional fallback. OTP foreground reads and result navigation
are restricted to the focused screen. Codes clear on blur/background; an
offscreen completion waits for focus before navigating.

## Verified locally

- Frontend: 368 tests across33 suites, plus TypeScript; focused post-integration
  API/request regressions27/27.
- `node scripts/browser-features-smoke.cjs`: card/account/activity regressions.
- `node scripts/browser-payments-smoke.cjs`: real two-account UI payment; lost
  confirmation response reconciled to one canonical transaction.
- `node scripts/browser-reliability-smoke.cjs` and normal-motion variant:
  offline request never sent; draft retained; reconnect made no write; one
  subsequent explicit creation; keyboard/dialog semantics; owned read markers;
  muted alerts retain unread history; compact/wide and200% browser zoom layout.
- Backend:92 tests across6 suites passed. Notification API regressions include expiry boundary, concurrent deduplication,
  ownership, legacy compatibility, and first read-timestamp preservation.

No hardware biometric, native font scaling, native camera/share or device
screen-reader result is claimed. See `ACCESSIBILITY.md` for the remaining checks.
