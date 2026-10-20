# NamPay API contract and compatibility baseline

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
