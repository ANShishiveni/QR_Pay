# NamPay API contract and compatibility baseline

For the running v2 code, use [Implemented Phase 1 contract](#implemented-phase-1-contract--authentication-and-users) below. The original inventory is intentionally retained as a historical audit.

Baseline source: `998d2ec571289edbf777a52d9edea50652cf257b` (20 October 2026 audit). This section describes **code that existed**, including defects; it does not claim the blocked baseline server handled these requests successfully. All paths below include `/api`. Later implementation changes must be documented separately with matching frontend/backend/test changes.

## Shared baseline behavior

- JSON requests/responses. Backend defaults to port 3000. Authenticated routes require `Authorization: Bearer <JWT>`.
- JWTs contain `uid`, `email`, `firstName`, `lastName` and expire after 24 hours. The existing implementation does not verify issuer/audience, active account or revocation; auth/OTP imports fail on self-referential secret declarations.
- Missing/invalid JWT normally returns 401 `{error:"No token provided"}` / `{error:"Invalid token"}`. All protected routes below inherit these errors.
- Global limiter: 100 requests per IP per 15 minutes. Global JSON/form body limit: 10MB. CORS permits configured host and localhost development origins on 3000/19006.
- Most caught route exceptions return 500 `{error,details:error.message}`. This unsafe diagnostic shape is recorded for remediation, not endorsed. Error IDs are not standardized.
- Decimal `amount` is currently a JavaScript number in major NAD units. Timestamps are ISO UTC strings. There is no account balance model.
- All described transfers currently call the mock simulation helper. No route should introduce real settlement.

## Authentication and health

| Method/path | Auth | Input | Success model | Specific errors / behavior |
| --- | --- | --- | --- | --- |
| `GET /health` | None | — | 200 `{status:"OK",timestamp,environment}` | Does not establish provider readiness |
| `POST /auth/register` | None | `{email,password,firstName,lastName,phoneNumber?}` | 201 `{message,token,user:{uid,email,firstName,lastName,phoneNumber}}` | 400 missing required fields or duplicate RTDB email; Firebase user then RTDB user created separately |
| `POST /auth/login` | None | `{email,password}` | 200 `{message,token,user:{uid,email,firstName,lastName,phoneNumber,isVerified}}` | 400 missing credentials; 401 invalid credentials; RTDB bcrypt authentication |
| `GET /auth/verify` | JWT | — | 200 `{valid:true,user:<decoded claims>}` | Does not reload user or revoke token |
| `POST /auth/logout` | JWT | — | 200 `{message}` | No server token invalidation at baseline |

There are no baseline forgot/reset-password endpoints.

## Users and dashboard

| Method/path | Auth | Input | Success model | Specific errors / behavior |
| --- | --- | --- | --- | --- |
| `GET /users/profile` | JWT | — | 200 `{user}` excluding `hashedPassword` | 404 user missing; remaining stored fields, including cards, are returned |
| `PUT /users/profile` | JWT | `{firstName?,lastName?,phoneNumber?}` | 200 `{message,updates:{...accepted fields,updatedAt}}` | First of two registered handlers wins; truthy values only; no verified-contact workflow |
| `GET /users/cards` | JWT | — | 200 `{cards:[{id,last4,brand,bank,isDefault,createdAt}]}` | 404 user missing |
| `GET /users/transactions` | JWT | Query `limit=20`, `offset=0` | 200 `{transactions:[LegacyTransactionView]}` | Filters `userId`, query-limit before timestamp sort; unvalidated pagination |
| `GET /users/stats` | JWT | — | 200 `{stats:{totalTransactions,totalSent,totalReceived,lastTransaction}}` | Major-unit sums by `type=send/receive`; no wallet balance |
| `POST /users/photo` | JWT | `{photo:"data:image/..."}` | 200 `{message,photoUrl}` | 400 missing photo or prefix; actual endpoint is JSON, not multipart |
| `PUT /users/password` | JWT | `{currentPassword,newPassword}` | 200 `{message}` | 400 missing/short/wrong current password; 404 user; updates RTDB hash only, not Firebase Auth or sessions |

The shadowed second `PUT /users/profile` handler requires both names, trims fields and would return `{message,user}`. It is unreachable in normal routing because the first handler replies. The documented baseline response is therefore `{message,updates}`.

`GET /users/balance` is **absent** despite the frontend's `userAPI.getBalance`.

## Test cards and direct simulated payment

| Method/path | Auth | Input | Success model | Specific errors / behavior |
| --- | --- | --- | --- | --- |
| `GET /payments/cards` | JWT | — | 200 `{cards:[{id,last4,brand,bank,cardholderName,isDefault,createdAt}],count}` | Missing card collection becomes empty |
| `POST /payments/link-card` | JWT | `{cardNumber,expMonth,expYear,cvc,cardholderName}` | 200 `{message,card:{id,last4,brand,bank,cardholderName}}` | 400 validation errors; malformed types/missing fields can throw; no strict test-card allowlist |
| `PUT /payments/set-default-card/:cardId` | JWT | Path card ID | 200 `{message}` | 404 own card missing; read then multi-child default update |
| `DELETE /payments/remove-card/:cardId` | JWT | Path card ID | 200 `{message}` | 404 own card missing; removal does not choose a new default |
| `POST /payments/process-payment` | JWT + verified OTP session | `{receiverEmail,amount,description?,senderCardId,sessionId}` | 200 `{message,transaction:{id,amount,currency,receiverName,senderBank,receiverBank,timestamp,status:"completed"}}` | 400 missing fields/nonpositive amount/no recipient default/simulation failure; 404 payer card or recipient missing |
| `GET /payments/history` | JWT | Query `limit=20`, `offset=0`, `type?` (`send`/`receive`) | 200 `{transactions:[LegacyTransactionView],pagination:{total,limit,offset,hasMore}}` | Retrieves own records, filters and sorts before slicing |

Card storage contains `{id,paymentMethodId,last4,brand,bank,cardholderName,isDefault:false,createdAt}`. The mock method ID is not a Stripe token; baseline embeds the last eight PAN digits in that ID, which must be removed. The direct payment endpoint does not bind to a QR request and duplicates confirmation logic. Its compatibility strategy must route through the same protected canonical operation or reject unsupported unbound requests explicitly; it must never remain a weaker bypass.

## QR requests

| Method/path | Auth | Input | Success model | Specific errors / behavior |
| --- | --- | --- | --- | --- |
| `POST /qr/generate` | JWT | `{amount,description?,reference?,expiresIn?}`; default TTL 300 seconds | 200 `{message,qrCode:<PNG data URL>,paymentRequest:{id,amount,currency:"NAD",description,expiresAt,status:"pending"}}` | 400 nonpositive/missing amount; TTL and numeric finiteness insufficiently bounded |
| `POST /qr/scan` | JWT | `{qrData:<JSON string>}` | 200 `{message,paymentRequest:{id,amount,currency,senderName,description,expiresAt},receiverCard:{id,last4,brand,bank}}` | 400 malformed/type/signature/status/expired/self/default-card errors; 404 request or payer account missing |
| `POST /qr/confirm-payment` | JWT + verified OTP session | `{requestId,receiverCardId,sessionId}` | 200 `{message,transaction:{id,amount,currency,senderName,receiverName,senderBank,receiverBank,timestamp,status:"completed"}}` | 400 required fields/non-pending/expired/self/missing requester default/simulation failure; 404 request/payer card/requester missing |
| `GET /qr/requests` | JWT | Query `status="pending"` | 200 `{requests:[LegacyPaymentRequest]}` | Own requester UID only; status exact match, descending creation time; expired pending records are not automatically transitioned |

QR payload is serialized JSON:

```json
{
  "type": "payment_request",
  "token": "<request UUID>",
  "expiresAt": "<ISO UTC>",
  "signature": "<HMAC-SHA256 hex>"
}
```

Baseline signs `JSON.stringify({type,token,expiresAt})` with `JWT_SECRET`; scan signs all received fields except `signature` and compares strings. Scan loads server request amount and expiry; confirm also reloads server state. Those server-authoritative reads must remain after hardening.

Naming is counterintuitive but part of compatibility: `senderId`, `senderEmail`, `senderName` mean the **requester who receives simulated funds**. `receiverCard` / `receiverCardId` identify the **payer's card**; completed request's `receiverId` is the payer. New internals should use `requesterUid` and `payerUid` and serialize these old names only as explicit aliases.

`GET /qr/history`, request-by-ID status, cancellation and transaction-detail/receipt endpoints are absent at baseline. Client `qrAPI.getQRHistory` points to the missing route.

## OTP

| Method/path | Auth | Input | Success model | Specific errors / behavior |
| --- | --- | --- | --- | --- |
| `POST /otp/send` | JWT | `{phoneNumber,purpose?}`; default `payment_verification` | 200 `{success:true,message,sessionId,expiresAt}` | 400 phone validation/provider error; 429 recent pending session; destination is caller-supplied |
| `POST /otp/resend` | JWT | Same as send | Same as send, new session ID | Same limits, no binding to original payment or invalidation of every older authorization |
| `POST /otp/verify` | JWT | `{sessionId,otp:<six digits>}` | 200 `{success:true,message,userId,phoneNumber}` | 400 malformed/missing/wrong/expired/already-verified/exhausted session; owner is not compared to authenticated actor |
| `GET /otp/status/:sessionId` | JWT | Session ID | 200 `{success:true,session:{id,status,attempts,maxAttempts,expiresAt,isExpired,purpose}}` | 404 missing; 403 another owner |
| `POST /otp/cleanup` | JWT with `role:"admin"` | — | 200 `{success:true,message}` | 403 non-admin; removes expired sessions |

Baseline session: `{userId,phoneNumber,otpHash,expiresAt,attempts,maxAttempts:3,status:"pending",purpose,createdAt,verifiedAt?}` at `otpSessions/<sessionId>`. Hash is SHA-256. Session IDs use `crypto.randomUUID`; six digits derive from random bytes. Expiry is five minutes; sending cooldown is one minute for recent pending sessions only.

Payment middleware requires `sessionId`, a stored `status:"verified"`, and unexpired date. It does **not** bind owner/purpose/request/amount or consume the session. There is no valid server-side biometric session marker. A client-only biometric result must never create server authority.

## Original Firebase data and compatibility requirements

| Path | Baseline model / key policy | Compatibility risk |
| --- | --- | --- |
| `users/<emailKey>` | `{uid,email,firstName,lastName,phoneNumber,hashedPassword,createdAt,isVerified,cards,...}` | Auth sanitizes every `.` `#` `$` `[` `]`; other routes replace only first dot. Preserve/resolve historical variants by verified UID, detect ambiguous collisions |
| `users/<emailKey>/cards/<uuid>` | Mock-method metadata described above | Moving users without cards or resolving by untrusted email loses ownership |
| `paymentRequests/<uuid>` | `{id,senderId,senderEmail,senderName,amount,currency,description,reference,status,createdAt,expiresAt,completedAt?,receiverId?,receiverEmail?}` | `senderId` is requester; no canonical transaction ID; immutable original semantics must be retained in migration |
| `transactions/<uuid>` | Payer view with `id:<uuid>,userId,type:"send",amount,currency,receiverEmail,receiverName,description,status,timestamp,senderBank,receiverBank` | Canonical ID is inner `id`, not always path key |
| `transactions/<uuid>_sender` | QR requester's view, `type:"receive"`, sender counterpart fields | Share same inner ID as payer; suffix is not a unique canonical payment |
| `transactions/<uuid>_receiver` | Direct payment recipient view, `type:"receive"` | Both suffix conventions must remain readable and deduplicated correctly per owner |
| `otpSessions/<uuid>` | Legacy unbound OTP session | Legacy sessions cannot safely authorize new payments; invalidate rather than silently upgrade |
| `qr_codes/<id>` | Rules only, no current route writer found | Preserve unknown existing data; do not invent migration/deletion |

RTDB rules grant users access to `users/$uid`, which differs from actual email-key storage; allow any authenticated write to transactions; allow an OTP owner to write their session. Custom application JWTs are not Firebase client credentials. Backend Admin SDK writes bypass these rules, so rules and API authorization must both be tested.

## Planned Phase 1 interfaces — not implemented by this baseline document

The following seam separates auth/data compatibility work from payment/OTP security work while preserving public requests:

```text
identity.verifyToken(req) -> trusted active actor { uid, email, sessionVersion, ... }
userRepository.getByUid(uid) / getByEmail(normalizedEmail)
userRepository.updateProfile(actorUid, validatedPatch)
userRepository.getOwnedCard(actorUid, cardId) / listCards(actorUid)
userRepository.listTransactions(actorUid, page)

verificationService.issue(actorUid, requestId, purpose)
verificationService.verify(actorUid, sessionId, code)
paymentLedger.confirm({ actorUid, requestId, cardId, sessionId, idempotencyKey })
paymentLedger.getRequest(actorUid, requestId)
paymentLedger.cancel({ actorUid, requestId })
```

The identity/data owner should implement UID resolution and non-destructive legacy adapters once; payment code must not reconstruct email keys independently. The payment owner should own request/OTP/canonical transaction invariants together. Keep HTTP `receiverCardId` as an accepted alias for `cardId`, and preserve `requestId`/`sessionId`; update client and contract tests in the same phase when adding required binding fields.

Choose one transactional boundary that can compare actor ownership, current card eligibility, request status/amount/expiry and verified OTP binding, and can consume authorization while creating exactly one canonical outcome. For the isolated prototype, an RTDB transaction at their common ancestor is simple and auditable; document its scalability limit. An aggregate-plus-projection design is also valid only with a committed canonical outcome, idempotent recovery and explicit tests for partial projection. Independent read-then-multi-location-update is **not** sufficient concurrency protection.

Canonical future request/transaction records should use positive bounded safe-integer `amountMinor`, `currency:"NAD"`, `requesterUid`, `payerUid`, `requestId`, one shared `transactionId` and explicit `simulated:true`. Retain derived major-unit `amount` and old display names in a versioned adapter during client transition. Never infer unavailable request IDs for old direct payments; show legacy records as legacy simulated history.

UID migration must be additive and idempotent: validate source ownership against stored UID; retain legacy originals; map all known path variants; reject collisions and mismatched UID claims; test repeated migration and mixed old/new reads against synthetic fixtures. No production data is migrated by this plan.

Future errors should have a stable machine code plus safe message, using 400/401/403/404/409/410/429 appropriately. Mock OTP is permitted only in explicit development/emulator mode. It must expose challenges through test-only infrastructure, not logs, production responses or universal codes. All endpoint and schema changes need tests and an appended implementation contract before being declared released.

---

## Implemented Phase 1 contract — authentication and users

This section supersedes the corresponding **historical baseline** descriptions above for the implementation on `feat/nampay-2`. The original inventory is retained for compatibility review. Root verification on 21 October 2026 reported the complete backend suite passing 87/87 tests and the isolated live two-account simulated-payment smoke passing. These results do not establish physical-device behavior or real Realtime Database emulator readiness; see the progress and emulator documents for those limits.

### Current transport, authentication and errors

- Prefix every path below with `/api`. Send JSON with `Content-Type: application/json`. JSON bodies are limited to 2 MB; URL-encoded bodies to 8 KB.
- Native callers use `X-Client-Platform: native` and `Authorization: Bearer <token>`. Omitting the platform header retains the native token-return behavior for existing API clients.
- Web callers use `X-Client-Platform: web` and credentials-enabled requests. Successful registration/login sets `nampay_session` as an HttpOnly, SameSite=Strict, one-hour cookie scoped to `/api`; `Secure` is required in production. Web JSON responses deliberately omit `token`.
- Cookie-authenticated POST/PUT/DELETE requests require an allowed `Origin`. Development defaults permit `http://localhost:19006` and `http://127.0.0.1:19006`; use the same hostname for the web client and API. Foreign origins and cookie writes without an Origin are rejected with 403 `ORIGIN_DENIED`. Configure `ALLOWED_ORIGINS` for any other deployment.
- JWTs expire after one hour and require expected issuer, audience, subject/UID, expiry/issued-at, session version and session ID. The server checks current account status and revocation. `/auth/verify` returns the current sanitized profile, not stale token profile claims. There is no refresh-token endpoint; an expired session must sign in again.
- Application errors use `{code,error,requestId}` with a safe user-readable error. Every response has `X-Request-ID` and `Cache-Control: no-store`. IP-limit responses use `{code,error}` while retaining the request-ID header. JSON parse errors do not echo submitted fields. Internal failures return a generic 500 `INTERNAL_ERROR`.
- Normal runtime limits: 300 API requests per IP per fifteen minutes, with 20 login/register/recovery attempts per IP per fifteen minutes. Tests may inject larger limits. A 429 response includes the standard rate-limit headers.
- Production requires HTTPS; the API does not silently trust forwarded headers. `TRUST_PROXY=1` selects one trusted proxy hop and must match the actual deployment.

### Public user model

The following is a **shape**, not usable account credentials:

```text
PublicUser {
  uid: string,
  email: normalized string,
  firstName: string,
  lastName: string,
  phoneNumber: string,             // current user's own contact; empty if absent
  phoneVerified: boolean,
  emailVerified: boolean,
  isVerified: boolean,             // compatibility alias for emailVerified
  photoUrl: bounded image data URL | null,
  createdAt: ISO UTC | null,
  preferences: {
    theme: "system" | "light" | "dark",
    notifications: boolean,
    biometrics: boolean            // preference only; never server payment authorization
  }
}
```

Responses do not expose password hashes, session-version internals, reset digests, OTP challenges or card collections inside the profile. New registrations set both contact-verification flags false. A local demo's synthetic OTP destination is not evidence that a supplied real phone belongs to the user.

### Authentication routes

| Method/path | Auth | Accepted input | Success | Important failures / semantics |
| --- | --- | --- | --- | --- |
| `GET /health` | None | — | 200 `{status:"OK",simulated:true,environment,database,timestamp}` | `database` is `memory` or `firebase`; health alone does not validate external providers or an end-to-end payment |
| `GET /auth/capabilities` | None | — | 200 `{passwordRecovery:boolean,simulated:true}` | Recovery is available for explicit local demos or a configured verified-delivery implementation |
| `POST /auth/register` | None | `{email,password,firstName,lastName,phoneNumber?}` | 201 `{message:"Account created",user:PublicUser,expiresAt,token?}` | 400 field validation; 409 `REGISTRATION_UNAVAILABLE` for an existing normalized email; duplicate registration is checked atomically |
| `POST /auth/login` | None | `{email,password}` | 200 `{message:"Signed in",user:PublicUser,expiresAt,token?}` | 400 missing credentials; 401 `INVALID_CREDENTIALS` for wrong password, missing/disabled account or ambiguous legacy identity |
| `GET /auth/verify` | Session | — | 200 `{valid:true,user:PublicUser,expiresAt}` | 401 `AUTH_REQUIRED` or `SESSION_EXPIRED` for missing/invalid/expired/revoked/inactive sessions |
| `POST /auth/logout` | Session | — | 200 `{message:"Signed out"}` and cookie clearing | Revokes this session ID on the server; other existing sessions remain valid until separately revoked or password change/reset |
| `POST /auth/forgot-password` | None | `{email}` | 202 `{message:"If this account can receive recovery instructions, they have been sent."}` | Same public response for unknown account, unavailable delivery and delivery failure; proof is never returned by HTTP |
| `POST /auth/reset-password` | None; reset proof required | `{token,newPassword}` | 200 `{message:"Password reset. Sign in with your new password."}` and cookie clearing | 400 `RESET_INVALID` for malformed/expired/used proof; 400 password validation; resets invalidate all prior account sessions |

Registration normalizes email by trimming/lowercasing and validates its syntax/length. Names are trimmed, 1–60 characters, and reject control characters and angle brackets. Password creation/change/reset requires 12 or more characters and no more than 72 UTF-8 bytes. Existing legacy passwords remain usable for login; changing them applies the new policy. Optional phone input is validated as an international number; local Namibian leading-zero formats are normalized, but contact ownership is not asserted.

Reset proof is a random one-use 256-bit token expiring after fifteen minutes, with only its digest stored in the database. In explicit local demos, synthetic recovery instructions go to a private server-local outbox (`AUTH_OUTBOX_DIR`, falling back to `OTP_OUTBOX_DIR`, then a temporary private directory). Tests inspect their isolated outbox. There is no public reset-token retrieval endpoint. A production mail delivery provider remains unconfigured.

### User/profile/settings routes

All of these routes require a current session and operate only on its UID. Supplying another identity to the profile/transaction list endpoints is rejected; changing an ID in the client does not change ownership.

| Method/path | Accepted input | Success | Important failures / behavior |
| --- | --- | --- | --- |
| `GET /users/profile` | — | 200 `{user:PublicUser,capabilities:{phoneChange:false,emailChange:false}}` | Current profile only; no stored card/secret internals |
| `PUT /users/profile` | `{firstName?,lastName?}`; existing unchanged `email`, `phoneNumber`, or own `uid` may be supplied for compatibility | 200 `{message:"Profile updated",updates:{accepted names},user:PublicUser}` | 400 empty/invalid/unknown fields; 403 another UID; 409 `CONTACT_VERIFICATION_REQUIRED` for a different email/phone |
| `PUT /users/preferences` | Any nonempty subset of `{theme:"system"|"light"|"dark",notifications:boolean,biometrics:boolean}` | 200 `{preferences}` | 400 `INVALID_PREFERENCES` for unknown keys or wrong values; no other account is affected |
| `POST /users/photo` | `{photo:<PNG/JPEG/WebP base64 data URL>}` | 200 `{message:"Profile photo updated",photoUrl}` | JSON rather than multipart; maximum decoded size 1 MB; allowed MIME/signature must agree; SVG/HTML/malformed data are rejected |
| `PUT /users/password` | `{currentPassword,newPassword}` | 200 `{message:"Password changed. Sign in again.",sessionsRevoked:true}` and cookie clearing | 401 `REAUTHENTICATION_FAILED` for wrong current password; new-password policy applies; all older sessions are revoked |
| `GET /users/cards` | — | 200 `{cards:[PublicTestCard]}` | Compatibility alias for the caller's masked test instruments; no PAN/CVV/raw token |

The UI must honor the contact-change capability flags. Unavailable verification is not replaced by updating an unverified number and pretending it is a verified payment destination. A biometrics preference does not exempt a payment from server-side authorization.

### Activity, totals and receipts

`GET /users/transactions` accepts the following query parameters:

| Parameter | Meaning |
| --- | --- |
| `limit` | Integer 1–100; default 20 |
| `offset` | Nonnegative integer; default 0 |
| `type` | `all`, `sent`, `received`, or compatibility aliases `send`, `receive` |
| `role` | The shared activity filter also accepts a role when `type` is absent; use `sent`/`received` |
| `status` | Exact status filter or `all`; omitted means all |
| `search` | Case-insensitive substring over transaction ID, payer/requester names, reference and description; truncated to 120 characters |
| `from`, `to` | Parseable date/timestamps; inclusive comparison against the transaction UTC timestamp |

Response:

```text
{
  transactions: PublicTransaction[],
  pagination: { total, limit, offset, hasMore },
  total,                         // compatibility alias
  nextOffset: number | null      // offset + limit when another page exists
}
```

`PublicTransaction` includes:

```text
{
  id, transactionId, requestId: string | null,
  userId, role: "sent" | "received", type: "send" | "receive",
  amountMinor: positive integer, amount: amountMinor / 100, currency: "NAD",
  status, reference, description,
  createdAt, timestamp, completedAt: ISO UTC | null,
  payerUid: string | null, requesterUid: string | null,
  payerName, requesterName, senderName, receiverName,
  methodLabel, last4: string | null, brand,
  simulated: true,
  notice: "SIMULATED PAYMENT — No real funds transferred",
  legacy: boolean
}
```

The DTO intentionally excludes counterpart email/phone, raw PAN, CVV and stored provider credentials. Canonical sender/recipient views have the same transaction ID and amount, with opposite roles. A retained historical direct transaction may have `requestId:null` and `legacy:true`; no invented QR request is assigned to it. Malformed legacy money records remain retained but are excluded from valid activity totals.

- `GET /users/transactions/:id` returns 200 `{transaction:PublicTransaction,receipt:{...transaction,disclaimer:"SIMULATED PAYMENT — No real funds transferred",simulated:true}}`. A missing transaction or one belonging to another user returns 404 `TRANSACTION_NOT_FOUND`.
- `GET /users/stats` returns `{stats:{totalTransactions,totalSentMinor,totalReceivedMinor,totalSent,totalReceived,simulated:true,currency:"NAD",lastTransaction}}`. Totals include completed/succeeded own records; major-unit totals are derived from integer minor-unit totals. `lastTransaction` is a public DTO or null. There is no available balance or wallet account.
- `/payments/history` and `/payments/transactions/:id` are the corresponding payment-area reads; see [the implemented payment contract](PAYMENTS_V2.md) for their precise response wrappers.

### In-app notifications

- `GET /users/notifications` returns `{notifications:[{id,recipientUid,eventType,requestId?,createdAt,readAt,simulated?}]}` for the current UID, newest first, capped at 100 records.
- `PUT /users/notifications/:id/read` returns `{message:"Notification marked as read"}`. The first read timestamp is retained on retries; an unknown or another user's record returns 404.
- Notifications describe server events. They are not payment authorization or authoritative settlement proof. No push-notification delivery service is implied by these routes.

### Authentication/data compatibility and intentional changes

- Existing register/login/profile/card/history routes remain, with stricter field validation and safe error codes. New native clients keep the original `{token,user}` response concepts; web clients deliberately switch to HttpOnly cookies.
- Existing 24-hour JWTs lack required issuer/audience/session claims and are invalid under this contract. Users must sign in again after upgrade. This is deliberate session invalidation, not a data migration.
- Successful legacy login copies the account to `users/{uid}`, records its prior key in `migrations/users/{uid}`, and retains original records. Canonical data wins thereafter. Colliding/ambiguous identities fail closed rather than overwriting another account or accepting a stale password.
- New account registration uses the application UID/password model backed by RTDB; it does not create or rely on a second Firebase Auth password. Firebase client tokens and NamPay JWTs are separate credential types; the API accepts only NamPay sessions.
- `isVerified` now means the same as `emailVerified`; neither is made true by a mock OTP payment challenge.
- Contact edits are intentionally unavailable until an ownership-verification provider exists. New preference, reset, detail/receipt and notification endpoints are additive.
- Read [security decisions](../security/SECURITY_DECISIONS.md) before any deployment or rollback. No live database migration, production SMS delivery or real card/payment operation was performed by this implementation.

Implemented payment, test-instrument, QR, OTP, idempotency and receipt contracts: [NamPay 2.0 payments](PAYMENTS_V2.md).
