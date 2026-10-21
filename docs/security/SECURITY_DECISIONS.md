# NamPay 2.0 security decisions

Status: Phase 1 implementation; automated isolated tests provide evidence. Real Realtime Database emulator concurrency/rules verification remains blocked by the emulator JAR download returning HTTP 403. A passing memory adapter test is not proof of Firebase behavior. This application remains a simulated-payment prototype.

## Identity and authentication

The Express API is the sole authentication and authorization boundary. It issues one-hour HS256 JWTs with fixed issuer `nampay-api`, audience `nampay-client`, subject/UID consistency, a unique session ID, and a server-side session version. The API checks the current account status and session version on every authenticated request. A logged-out session is revoked by ID; password changes and successful recovery increment the account session version, revoking all older sessions. Secrets must contain at least 32 bytes. An explicit development/test demo may generate a random process-local signing key; restarting that demo invalidates existing sessions unless a protected environment signing key is supplied.

New accounts use stable random UIDs and an email hash index; they are stored in Realtime Database. Existing Firebase Auth UIDs are retained when a legacy account signs in. New accounts do not create a second Firebase Auth password record. Firebase Auth tokens are not accepted interchangeably with NamPay session JWTs. Existing Firebase Auth data is neither deleted nor silently modified. Firebase client rules deny direct access to the database; Firebase Admin writes must still enforce API ownership checks.

Passwords use bcrypt with cost 12. New passwords require at least 12 characters and no more than 72 UTF-8 bytes to avoid silent bcrypt truncation. Legacy password verification continues to accept existing shorter passwords, while newly changed/reset passwords follow the new policy. Login rejects ambiguous duplicate-email identities instead of guessing. Error responses omit provider internals, stack traces and account details. Login/register/recovery have an IP-based attempt limit in addition to the overall API limit.

### Native and web sessions

Native clients receive a bearer token for storage in platform SecureStore. Web clients send `X-Client-Platform: web`, receive an HttpOnly cookie (`nampay_session`, `SameSite=Strict`, `Path=/api`, `Secure` outside local development), and do not receive a token in the JSON response. The frontend does not persist web bearer tokens in localStorage. Cookie-authenticated mutations require an explicitly allowed Origin; unrelated origins are rejected by CORS. Production requests require HTTPS. Reverse-proxy trust is disabled unless the deployment explicitly selects one trusted hop.

Keep the web client and API on the same site. For local development, use `localhost` consistently on both ports. Cross-site deployments require a deliberate cookie/CSRF review; do not weaken these controls to make a deployment appear functional.

## Non-destructive UID compatibility

Legacy users were keyed by lossy email replacements, while their records already contained Firebase UIDs. The new adapter searches normalized email/UID records, favors an existing canonical `users/{uid}` record, and copies an email-keyed account to that UID path only after successful password verification. Password hashes, card metadata, profile data and UID are preserved. The original email-keyed record remains untouched. An audit entry under `migrations/users/{uid}` records the original key and copy time. No production migration has been run.

Once the canonical account exists, its password/session fields are authoritative. The adapter never falls back to the stale legacy password after a password reset/change. Ambiguous duplicate emails fail closed and require a reviewed repair. New accounts cannot reuse any existing normalized legacy email. Historical transaction paths and keys remain retained; read adapters normalize legacy amount/role fields and include only the current user's historical records. Invalid historical money records are preserved but excluded from calculated totals.

Rollback is not a database reset. Before deploying, take an access-controlled database snapshot and review the UID-copy inventory against anonymized fixtures. Revert code only after assessing writes created since deployment. Do not delete canonical users or transaction history to return to the old version. If a legacy application must read new UID-keyed records, build a tested compatibility export into a separate staging copy. Retained legacy password hashes are historical records, not an alternate authentication path; remove them only through a separately reviewed retention migration after compatibility support ends.

## Password recovery and contact changes

Recovery returns a generic 202 response regardless of account existence or delivery availability. The database retains only a SHA-256 digest of a random 256-bit, fifteen-minute, one-use reset proof, bound to the UID and current session version. Reset completion requires the proof and invalidates old sessions. The production delivery interface must send proof through an account-ownership channel; no production delivery provider is configured here.

Explicit local demos deliver synthetic reset instructions to a server-local outbox (directory mode 0700, files 0600). This outbox is not served by the application and must never be published or committed. Tests read their isolated private outbox rather than exposing proof through a public HTTP route. Provider failures invalidate the pending proof and keep the generic response. Public API replies and logs do not expose reset tokens.

Name changes and validated preferences are supported. Phone/email changes fail with `CONTACT_VERIFICATION_REQUIRED` because the demo has no verified contact-change provider. The UI must display this limitation rather than implying that entering a phone number proves ownership. Uploaded profile images accept bounded PNG/JPEG/WebP data with matching signatures; SVG/HTML and invalid data are rejected.

## Data integrity and payment authorization

All payments are simulated. The API accepts predefined test instruments and rejects raw card/CVV capture. QR data carries minimal signed request information; the server remains authoritative for amount, ownership, expiry and status. OTP authorization is bound to payer, purpose, request and amount, rate-limited and consumed once in the same conditional transition as simulated payment creation. Biometrics are not server-side payment proof.

The repository exposes a synchronous root-state conditional transaction. The local memory implementation serializes these operations for deterministic tests. Firebase uses a real Realtime Database transaction; a temporary root listener primes and retains the SDK cache before invoking the updater. Validation exceptions abort the operation, and listeners are removed in `finally`. A single atomic commit records the request terminal state, consumed authorization, canonical transaction, opposing user views and idempotency result. It must never call a payment/SMS provider from a retryable transaction callback.

A whole-database transaction is a deliberate small-prototype tradeoff: it reduces partial-settlement risk but has poor contention/scalability characteristics. It is not an approved architecture for a production payment system. Realtime Database emulator concurrency, failure recovery and rule tests must pass before claiming Firebase-backed readiness.

## Runtime isolation and observability

Memory storage requires explicit local demo configuration and is forbidden in production. Emulators require a `demo-` project, loopback hosts, non-production mode and explicit `DEMO_MODE=true`; mixing an Auth emulator with a live database is rejected. Real credentials are required outside emulator mode. Mock OTP is forbidden in production and uses server-selected synthetic destinations for the local demo. It must not mark an unverified real phone as verified.

API replies carry generated request IDs. Logs include only the request ID and stable internal error classification; they exclude request bodies, credentials, JWTs, OTPs, PAN/CVV, private keys and provider response objects. Responses are not cacheable. Rate limits and input size bounds apply before route execution.

## Evidence and remaining verification

- `backend/tests/auth.test.js`: credential/session lifecycle, normalization/validation, concurrent registration, cookie/Origin behavior, profile ownership, password changes, recovery expiry/replay, non-destructive legacy migration.
- `backend/tests/auth.activity.test.js`: authoritative minor-unit totals, private transaction/receipt reads, opposing roles, pagination/filtering, notification ownership and ambiguous legacy identities.
- `backend/tests/foundation.test.js`: import without listeners, conditional memory commits/rollback, fail-closed runtime flags, and Firebase adapter cache/listener ordering with an SDK test double.
- Payment/OTP tests cover the shared authorization and settlement invariants separately; see `docs/testing/TEST_MATRIX.md` for actual run results.
- Not verified here: real provider delivery, physical-device SecureStore/biometrics, real Realtime Database emulator transactions/rules while its artifact is inaccessible, production security posture or PCI compliance. No live payment operation or SMS was performed.
