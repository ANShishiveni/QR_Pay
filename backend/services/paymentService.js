const crypto = require('crypto');
const { httpError, requireId } = require('../utils/paymentValidation');
const { isUsableTestCard } = require('../utils/cardValidation');
const {
  activeRequest, requireScanAccess, requestAmount, requesterUid, getUser, userName,
  publicTransaction, operationFingerprint, addNotification,
} = require('./paymentState');

async function confirmPayment({ repository, config, uid, body, idempotencyHeader }) {
  const requestId = requireId(body.requestId, 'Request ID');
  const cardId = requireId(body.cardId || body.receiverCardId || body.senderCardId, 'Test card ID');
  const sessionId = requireId(body.sessionId, 'Verification session ID');
  const key = body.idempotencyKey || idempotencyHeader;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw httpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A stable payment operation key is required');
  }
  const fingerprint = operationFingerprint({ uid, requestId, cardId, sessionId, key });
  // IDs and timestamps are generated outside the retryable transaction callback.
  const transactionId = crypto.randomUUID();
  const now = config.now();
  const timestamp = new Date(now).toISOString();
  let idempotent = false;
  const result = await repository.transaction(root => {
    const existing = root.paymentRequests?.[requestId];
    if (existing?.status === 'completed') {
      const transaction = root.transactions?.[existing.transactionId];
      if (transaction?.payerUid === uid && transaction.operationFingerprint === fingerprint) {
        idempotent = true;
        return root;
      }
      throw httpError(409, 'REQUEST_COMPLETED', 'This request already has a completed simulated payment');
    }
    idempotent = false;
    const request = activeRequest(root, requestId, now, { payerUid: uid });
    requireScanAccess(root, request, uid);
    const amountMinor = requestAmount(request);
    if ((body.amountMinor !== undefined && body.amountMinor !== amountMinor)
      || (body.amount !== undefined && Number(body.amount) !== amountMinor / 100)
      || (body.receiverUid !== undefined && body.receiverUid !== requesterUid(request))) {
      throw httpError(400, 'PAYMENT_DETAILS_MISMATCH', 'Payment details must match the current request');
    }
    const payer = getUser(root, uid);
    const recipient = getUser(root, requesterUid(request));
    if (!payer || !recipient || payer.status === 'disabled' || recipient.status === 'disabled') {
      throw httpError(409, 'ACCOUNT_UNAVAILABLE', 'A payment participant is unavailable');
    }
    const card = payer.cards?.[cardId];
    if (!card || card.ownerUid !== uid) throw httpError(403, 'CARD_NOT_OWNED', 'Choose one of your own test instruments');
    if (!isUsableTestCard(card, now)) throw httpError(400, 'TEST_CARD_REQUIRED', 'Add a current predefined test instrument before continuing');
    const session = root.otpSessions?.[sessionId];
    if (!session || (session.userUid || session.userId) !== uid || session.requestId !== requestId
      || session.purpose !== 'payment_verification' || session.amountMinor !== amountMinor) {
      throw httpError(403, 'OTP_BINDING_MISMATCH', 'Verification does not belong to this payment');
    }
    if (!Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now) {
      throw httpError(410, 'OTP_EXPIRED', 'Verification expired. Request a new code');
    }
    if (session.status !== 'verified' || session.consumedAt) {
      throw httpError(409, 'OTP_NOT_AVAILABLE', 'This verification is unverified or has already been used');
    }
    const transaction = {
      id: transactionId, requestId, payerUid: uid, requesterUid: requesterUid(request),
      payerName: userName(payer), requesterName: userName(recipient), amountMinor, currency: 'NAD',
      reference: request.reference || '', description: request.description || '', status: 'completed',
      createdAt: timestamp, completedAt: timestamp, timestamp,
      cardId, last4: card.last4, brand: card.brand, methodLabel: `${card.brand} test card •••• ${card.last4}`,
      simulated: true, version: 2, operationFingerprint: fingerprint,
    };
    // Simulation has no external side effect: one commit records processing,
    // completion, consumed authorization, and both views. There is no partial
    // settlement state to recover after process death; an exact retry reconciles.
    request.status = 'completed';
    request.processingAt = timestamp;
    request.completedAt = timestamp;
    request.payerUid = uid;
    request.transactionId = transactionId;
    request.version = 2;
    session.status = 'consumed';
    session.consumedAt = timestamp;
    session.transactionId = transactionId;
    delete session.challengeHash;
    root.transactions ||= {};
    root.transactions[transactionId] = transaction;
    root.userTransactions ||= {};
    for (const [ownerUid, role] of [[uid, 'sent'], [requesterUid(request), 'received']]) {
      root.userTransactions[ownerUid] ||= {};
      root.userTransactions[ownerUid][transactionId] = {
        id: transactionId, transactionId, ownerUid, role, amountMinor, currency: 'NAD', status: 'completed', completedAt: timestamp,
      };
      addNotification(root, ownerUid, 'payment_completed', request, now);
    }
    return root;
  });
  const committedRequest = result.snapshot.paymentRequests[requestId];
  return {
    message: 'Simulated payment completed', simulated: true, idempotent,
    transaction: publicTransaction(result.snapshot.transactions[committedRequest.transactionId], uid),
  };
}
module.exports = { confirmPayment };
