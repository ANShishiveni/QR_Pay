const crypto = require('crypto');
const { parseAmount, validateMinor, httpError, requireId } = require('../utils/paymentValidation');

const SIMULATION_NOTICE = 'SIMULATED PAYMENT — No real funds transferred';
function getUser(root, uid) {
  const canonical = root.users?.[uid];
  if (canonical?.uid === uid) return canonical;
  return Object.values(root.users || {}).find(user => user?.uid === uid) || null;
}
function userName(user) { return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'NamPay demo user'; }
function requestAmount(request) { return request.amountMinor === undefined ? parseAmount(request.amount) : validateMinor(request.amountMinor); }
function requesterUid(request) { return request.requesterUid || request.senderId; }
function derivedStatus(request, now) {
  if (request.status === 'pending' && (!Number.isFinite(Date.parse(request.expiresAt)) || Date.parse(request.expiresAt) <= now)) return 'expired';
  return request.status;
}
function publicRequest(request, now = Date.now()) {
  const amountMinor = requestAmount(request);
  return {
    id: request.id, requesterUid: requesterUid(request), requesterName: request.requesterName || request.senderName || 'NamPay demo user',
    senderName: request.requesterName || request.senderName || 'NamPay demo user', amountMinor, amount: amountMinor / 100,
    currency: 'NAD', reference: request.reference || '', description: request.description || '',
    status: derivedStatus(request, now), createdAt: request.createdAt, expiresAt: request.expiresAt,
    ...(request.completedAt ? { completedAt: request.completedAt } : {}),
    ...(request.transactionId ? { transactionId: request.transactionId } : {}), simulated: true,
  };
}
function activeRequest(root, id, now, { payerUid } = {}) {
  requireId(id, 'Request ID');
  const request = root.paymentRequests?.[id];
  if (!request) throw httpError(404, 'REQUEST_NOT_FOUND', 'Payment request was not found');
  requestAmount(request);
  if (request.currency !== 'NAD') throw httpError(400, 'UNSUPPORTED_CURRENCY', 'Only NAD test requests are supported');
  const status = derivedStatus(request, now);
  if (status === 'expired') throw httpError(410, 'REQUEST_EXPIRED', 'This payment request has expired. Ask for a new QR code');
  if (status !== 'pending') throw httpError(409, status === 'completed' ? 'REQUEST_COMPLETED' : 'REQUEST_UNAVAILABLE', 'This payment request is no longer pending');
  if (payerUid && requesterUid(request) === payerUid) throw httpError(400, 'SELF_PAYMENT', 'You cannot pay your own request');
  return request;
}
function requireScanAccess(root, request, uid) {
  const access = root.requestAccess?.[request.id]?.[uid];
  if (!access || access.expiresAt !== request.expiresAt) throw httpError(403, 'QR_VERIFICATION_REQUIRED', 'Scan or import the signed QR code before approving this request');
}
function addNotification(root, uid, eventType, request, now) {
  const id = `${eventType}_${request.id}`;
  root.notifications ||= {};
  root.notifications[uid] ||= {};
  root.notifications[uid][id] ||= {
    id, recipientUid: uid, eventType, requestId: request.id, createdAt: new Date(now).toISOString(),
    readAt: null, simulated: true,
  };
}
function expireRequests(root, uid, now) {
  for (const request of Object.values(root.paymentRequests || {})) {
    if (requesterUid(request) === uid && request.status === 'pending' && derivedStatus(request, now) === 'expired') {
      request.status = 'expired';
      addNotification(root, uid, 'request_expired', request, now);
    }
  }
  return root;
}
function publicCard(card, id = card.id) {
  return {
    id, testCardId: card.testCardId || null, ownerUid: card.ownerUid || null, brand: card.brand || 'Test card',
    last4: card.last4, bank: card.bankLabel || card.bank || 'Demo issuer', bankLabel: card.bankLabel || card.bank || 'Demo issuer',
    cardholderName: card.cardholderName || '', isDefault: Boolean(card.isDefault),
    expMonth: card.expMonth || null, expYear: card.expYear || null, createdAt: card.createdAt, simulated: true,
  };
}
function publicTransaction(transaction, uid) {
  const canonical = Boolean(transaction.payerUid && transaction.requesterUid);
  const role = canonical ? (transaction.payerUid === uid ? 'sent' : 'received') : (transaction.type === 'send' ? 'sent' : 'received');
  const amountMinor = transaction.amountMinor === undefined ? parseAmount(transaction.amount) : validateMinor(transaction.amountMinor);
  return {
    id: transaction.id, transactionId: transaction.id, requestId: transaction.requestId || null,
    userId: uid, role, type: role === 'sent' ? 'send' : 'receive', amountMinor, amount: amountMinor / 100, currency: 'NAD',
    status: transaction.status, reference: transaction.reference || '', description: transaction.description || '',
    createdAt: transaction.createdAt || transaction.timestamp, timestamp: transaction.completedAt || transaction.timestamp || transaction.createdAt,
    completedAt: transaction.completedAt || transaction.timestamp || null,
    payerUid: transaction.payerUid || null, requesterUid: transaction.requesterUid || null,
    payerName: transaction.payerName || transaction.senderName || 'Demo payer',
    requesterName: transaction.requesterName || transaction.receiverName || 'Demo recipient',
    senderName: transaction.payerName || transaction.senderName || 'Demo payer',
    receiverName: transaction.requesterName || transaction.receiverName || 'Demo recipient',
    methodLabel: transaction.methodLabel || 'Legacy simulated test card',
    last4: transaction.last4 || null, brand: transaction.brand || 'Test card',
    simulated: true, notice: SIMULATION_NOTICE, legacy: !canonical,
  };
}
function getUserTransactions(root, uid) {
  const result = new Map();
  for (const [key, transaction] of Object.entries(root.transactions || {})) {
    if (!transaction || (transaction.payerUid !== uid && transaction.requesterUid !== uid && transaction.userId !== uid)) continue;
    try {
      const normalized = publicTransaction({ ...transaction, id: transaction.id || key }, uid);
      if (!result.has(normalized.id) || !normalized.legacy) result.set(normalized.id, normalized);
    } catch {
      // Malformed historical money records remain retained, but are never counted as valid amounts.
    }
  }
  return [...result.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)) || a.id.localeCompare(b.id));
}
function filterTransactions(transactions, query = {}) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) throw httpError(400, 'INVALID_PAGINATION', 'Pagination is invalid');
  const type = query.type || query.role;
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase().slice(0, 120) : '';
  const from = query.from ? Date.parse(query.from) : null;
  const to = query.to ? Date.parse(query.to) : null;
  if ((query.from && !Number.isFinite(from)) || (query.to && !Number.isFinite(to))) throw httpError(400, 'INVALID_DATE', 'Date filter is invalid');
  const filtered = transactions.filter(t => (!type || type === 'all' || type === t.type || type === t.role)
    && (!query.status || query.status === 'all' || t.status === query.status)
    && (!search || [t.id, t.payerName, t.requesterName, t.reference, t.description].join(' ').toLowerCase().includes(search))
    && (from === null || Date.parse(t.timestamp) >= from) && (to === null || Date.parse(t.timestamp) <= to));
  return { transactions: filtered.slice(offset, offset + limit), pagination: { total: filtered.length, limit, offset, hasMore: offset + limit < filtered.length } };
}
function operationFingerprint({ uid, requestId, cardId, sessionId, key }) {
  return crypto.createHash('sha256').update(JSON.stringify([uid, requestId, cardId, sessionId, key])).digest('hex');
}
module.exports = {
  SIMULATION_NOTICE, getUser, userName, requesterUid, requestAmount, derivedStatus, publicRequest, activeRequest,
  requireScanAccess, addNotification, expireRequests, publicCard, publicTransaction, getUserTransactions,
  filterTransactions, operationFingerprint,
};
