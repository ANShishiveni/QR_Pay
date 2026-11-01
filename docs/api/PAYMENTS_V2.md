# Implemented NamPay 2.0 payment, QR and verification contract

These implemented contracts supersede the corresponding baseline tables in
`CONTRACT.md`. Paths are prefixed with `/api`. All routes require a current
server-validated session: a native bearer token or the web HttpOnly session
cookie. Web mutations require the configured Origin. Responses are JSON;
errors have `{code,error,requestId}` and no provider details or stack trace.

## Money and synthetic instruments

`amountMinor` is an integer number of cents, bounded to **1–1,000,000**
(N$0.01–N$10,000). Alternatively, `amount` accepts an ordinary decimal string
or finite number with at most two decimal places. Exponential notation and
implicit fractional-cent rounding are rejected. When both fields are sent,
they must agree. New records use integer cents; returned `amount` is a display
compatibility value. Currency is `NAD`.

`GET /payments/test-instruments` returns
`{instruments:[{id,brand,last4,bankLabel}],simulated:true}`. Current allowlisted
IDs are `demo-visa` and `demo-mastercard`. The labels “Demo issuer A/B” do not
claim a bank relationship.

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /payments/cards` | — | 200 `{cards:[TestCard],count,simulated:true}` |
| `POST /payments/link-card` | `{testCardId,cardholderName?,expMonth?,expYear?}` | **201** `{message,card:TestCard,simulated:true}` |
| `PUT /payments/set-default-card/:cardId` | — | 200 `{message}` |
| `DELETE /payments/remove-card/:cardId` | — | 200 `{message}` |

`TestCard` exposes `id,testCardId,ownerUid,brand,last4,bank,bankLabel,
cardholderName,isDefault,expMonth,expYear,createdAt,simulated:true`. It does not
expose a processor token. `bank` is a compatibility alias for the demo issuer
label. Missing expiry defaults to December three years after the server's
current year; supplied expiry must be current and at most ten years ahead.

Raw `cardNumber`, `number`, `pan`, `cvc` and `cvv` fields are rejected, even if
the supplied number is a known test number. Duplicate test instrument IDs
return 409. Default selection and deletion are transactional; one default
remains whenever the account has at least one instrument. Only an owned,
unexpired allowlisted instrument may authorize payment. Legacy card metadata
remains readable; it must be replaced with a predefined instrument before use
in a new simulation.

## Request creation, scanning and lifecycle

| Method/path | Request | Response |
| --- | --- | --- |
| `POST /qr/generate` | `{amount?,amountMinor?,currency?,reference?,description?,expiresIn?}` | **201** `{message,qrCode,qrData,paymentRequest:PaymentRequest,serverTime}` |
| `POST /qr/scan` | `{qrData:<JSON string>}` | 200 `{paymentRequest:PaymentRequest,cards:[TestCard],receiverCard:TestCard|null,serverTime}` |
| `GET /qr/requests` | Optional `status`; omitted or `all` returns all own requests | 200 `{requests:[PaymentRequest],serverTime}` |
| `GET /qr/history` | Compatibility alias for `/qr/requests` | Same response |
| `GET /qr/requests/:requestId` | — | 200 `{paymentRequest:PaymentRequest,serverTime,transaction?,qrData?,qrCode?}` |
| `POST /qr/requests/:requestId/cancel` | — | 200 `{paymentRequest:PaymentRequest,serverTime}` |

`expiresIn` defaults to 300 and, when provided, must be an integer from 60 to
300 seconds. Reference is limited to 80 characters; description to 160.
`qrCode` is a PNG data URL. `qrData` is the JSON string that can be shared or
scanned and contains only:

```json
{
  "version": 2,
  "type": "payment_request",
  "token": "<request UUID>",
  "expiresAt": "<ISO UTC timestamp>",
  "signature": "<64 lowercase hex characters>"
}
```

The HMAC covers the canonical envelope. Validation rejects extra fields,
malformed signatures, changed expiry and mismatched server records. Equal-size
signature buffers use constant-time comparison. The original unversioned
minimal envelope is supported with its original signing secret and expiry;
legacy unbound OTP sessions are not accepted for new payments.

`PaymentRequest` exposes `id,requesterUid,requesterName,senderName,amountMinor,
amount,currency,reference,description,status,createdAt,expiresAt,simulated:true`
and, when present, `completedAt,transactionId`. `senderName` is explicitly a
legacy alias for the **requester**. Status is `pending`, `expired`, `cancelled`
or `completed`; completion means simulation only. Listing reconciles expired
own requests and creates a deduplicated expiry notification.

Successful signed scanning creates a server-side access grant for that actor
and exact request expiry. This grant is required for verification and payment.
A payer without a card can scan and review; confirmation still requires an
eligible owned test instrument. `receiverCard` is the old name for the payer's
default card, not the recipient's instrument. A requester does not need a card
to receive a simulated receipt because no real card credit or settlement occurs.

Only the requester, actual payer, or a successful scanner can read request
status. Receipt details are returned only to the actual participants. A pending
request's QR image/data is reissued only to its requester. Only the requester
can cancel; cancelling an already-cancelled own request is safe to retry. An
expired request returns 410; an unavailable terminal state returns 409.
Regeneration creates a new request and signature, never reopens the old one.

## Verification protocol

| Method/path | Request | Response |
| --- | --- | --- |
| `POST /otp/send` | `{requestId,purpose?:"payment_verification"}` | 200 `{success:true,sessionId,expiresAt,resendAt,provider,maskedDestination,message}` |
| `POST /otp/resend` | Same as send | Same response with a new session ID |
| `POST /otp/verify` | `{sessionId,otp:<six-digit string>}` | 200 `{success:true,sessionId,requestId,status:"verified",expiresAt}` |
| `GET /otp/status/:sessionId` | — | 200 `{success:true,session:{id,requestId,purpose,status,attempts,maxAttempts,expiresAt,isExpired}}` |

The client cannot supply a destination or any additional issue/verify fields.
The server resolves either a verified account phone for Twilio or `demo:<uid>`
for the explicit local mock provider. The mock does **not** claim phone-number
ownership. It is permitted only in nonproduction explicit demo mode using
memory storage or configured Firebase emulators.

Mock codes are CSPRNG-generated and delivered to
`OTP_OUTBOX_DIR/otp-<sessionId>.json` with directory mode 0700 and file mode
0600. The developer/test operator reads this local file; there is no public
HTTP endpoint for code retrieval, fixed universal code or OTP log output.
The database stores a keyed challenge hash, not the code. Successful
verification, terminal verification failures and superseding a session remove
its local delivery file.

Sessions bind actor UID, `payment_verification` purpose, request ID, current
integer amount and expiry. Expiry is the earlier of five minutes or request
expiry. There are at most five incorrect attempts. Account/destination cooldown
is 60 seconds regardless of pending/verified state, with at most five issues
per 15 minutes; the IP limit is twenty issues per window. Resending invalidates
older pending/verified sessions for that actor/request. Attempt increments,
blocking and successful verification are atomic. Missing/unavailable storage
or providers fail closed.

Wrong codes return 400 `{success:false,code:"OTP_INVALID",error,attemptsLeft,
requestId}`; the final incorrect attempt returns 429. Cross-account session
reads/verifications return 404. Expired pending sessions return 410. Consumed,
superseded and verified sessions cannot be verified again. The old cleanup
HTTP endpoint was removed. Local biometrics alone never supply server payment
authority.

## Atomic simulation and recovery

Both `POST /qr/confirm-payment` and `POST /payments/process-payment` accept:

```json
{
  "requestId": "<request UUID>",
  "cardId": "<owned test instrument UUID>",
  "sessionId": "<verified session UUID>",
  "idempotencyKey": "<stable 16–128 character operation key>"
}
```

`receiverCardId` and `senderCardId` remain accepted aliases for `cardId`.
`Idempotency-Key` is an alternative header when the body key is absent. Keys
contain ASCII letters, digits, underscore or hyphen. Unbound recipient/email
and amount-only transfers are intentionally rejected; the compatibility direct
payment path has exactly the same protection as QR confirmation.

Success is 200 `{message:"Simulated payment completed",simulated:true,
idempotent:boolean,transaction:Transaction}`. A single root transaction checks
current ownership, scan access, request status/expiry, test instrument validity
and all OTP bindings, consumes the authorization, and writes the canonical
transaction and both participant projections. Cancellation shares that
transaction boundary. Simulation has no remote charge or partial settlement;
processing and completion timestamps are recorded in the same atomic commit.
This whole-root transaction is deliberately bounded to the prototype and is
not a production-scale payment architecture.

An exact authenticated retry with the same request, payer, card, session and
operation key returns the original transaction with `idempotent:true`, including
a retry after a lost HTTP response. Each payer's committed key is also bound to
that exact operation across requests: changing the request, card or verification
session returns 409 `IDEMPOTENCY_KEY_REUSED`, even when the replacement request
has its own valid verification. Different payers have independent key spaces.
The key's SHA-256 digest and operation fingerprint are recorded atomically with
the result; raw keys are neither persisted nor returned. If an indexed canonical
result is missing, retries fail closed with 503 `PAYMENT_RESULT_UNAVAILABLE`.
A different operation/key or payer cannot reuse a completed request.
Clients preserve the operation key and reconcile
uncertain outcomes with `GET /qr/requests/:id`; they must not infer failure from
a timeout or generate a fresh key as an automatic retry.

New state uses `paymentRequests/<id>`, `transactions/<id>` and
`userTransactions/<uid>/<id>`, plus `paymentOperations/<payerUid>/<keyDigest>`;
both projections share amount, status and
canonical ID. Existing historical transaction suffix keys remain readable and
are deduplicated by inner transaction ID for the appropriate owner. Originals
are not deleted or rewritten. Recipient-card absence no longer blocks a
simulation because no bank or card settlement is attempted.

Canonical transactions written before the key index retain their original exact
retry behavior. An exact retry adds the missing key binding without rewriting
the transaction. A historical operation fingerprint cannot reveal the original
key digest; cross-request reuse of a pre-index key cannot be detected until its
original exact retry supplies that key. Newly committed operations have the
binding from their first commit.

## Activity and receipts

`GET /payments/history` supports `limit` (1–100, default 20), nonnegative
`offset`, `type` or `role` (`send/sent`, `receive/received`, `all`), `status`,
`search` and ISO-parsable `from`/`to`. It returns
`{transactions:[Transaction],pagination:{total,limit,offset,hasMore}}`.
`GET /payments/transactions/:transactionId` returns `{transaction:Transaction}`
only to a participant, otherwise 404.

`Transaction` exposes `id,transactionId,requestId,userId,role,type,amountMinor,
amount,currency,status,reference,description,createdAt,timestamp,completedAt,
payerUid,requesterUid,payerName,requesterName,senderName,receiverName,methodLabel,
last4,brand,simulated:true,notice,legacy`. No card number, CVV, OTP, authorization
hash, private operation fingerprint or unnecessary participant contact details
are exposed. The notice is **“SIMULATED PAYMENT — No real funds transferred”**.
Historical records have `legacy:true`; unavailable request references are null,
not invented. These records never produce or imply a spendable account balance.
