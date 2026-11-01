const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { verifyToken } = require('../middleware/auth');
const { amountFromBody, textField, httpError, route, requireId } = require('../utils/paymentValidation');
const {
  getUser, userName, requesterUid, publicRequest, activeRequest, expireRequests, addNotification,
  publicCard, publicTransaction,
} = require('../services/paymentState');
const { isUsableTestCard } = require('../utils/cardValidation');
const { secureQrData, validateQrData } = require('../services/qrSignature');
const { confirmPayment } = require('../services/paymentService');

const router = express.Router();
router.use(verifyToken);
router.post('/generate', route(async (req, res) => {
  const { repository, config } = req.app.locals;
  const now = config.now();
  const amountMinor = amountFromBody(req.body);
  if (req.body.currency !== undefined && req.body.currency !== 'NAD') throw httpError(400, 'UNSUPPORTED_CURRENCY', 'Only NAD is supported');
  const ttl = req.body.expiresIn === undefined ? 300 : req.body.expiresIn;
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 300) throw httpError(400, 'INVALID_EXPIRY', 'Request expiry must be between 60 and 300 seconds');
  const paymentRequest = {
    id: crypto.randomUUID(), requesterUid: req.user.uid, requesterName: userName(req.user),
    amountMinor, currency: 'NAD', reference: textField(req.body.reference, 'Reference', 80),
    description: textField(req.body.description, 'Description', 160), status: 'pending',
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + ttl * 1000).toISOString(), version: 2,
  };
  const qrData = JSON.stringify(secureQrData(paymentRequest, config));
  const qrCode = await QRCode.toDataURL(qrData, { width: 360, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#11263D', light: '#FFFFFF' } });
  await repository.transaction(root => {
    if (!getUser(root, req.user.uid)) throw httpError(404, 'USER_NOT_FOUND', 'Account was not found');
    root.paymentRequests ||= {};
    root.paymentRequests[paymentRequest.id] = paymentRequest;
    addNotification(root, req.user.uid, 'request_created', paymentRequest, now);
    return root;
  });
  res.status(201).json({ message: 'Demo payment request created', qrCode, qrData, paymentRequest: publicRequest(paymentRequest, now), serverTime: new Date(now).toISOString() });
}));
router.post('/scan', route(async (req, res) => {
  const { repository, config } = req.app.locals;
  const now = config.now();
  const data = validateQrData(req.body.qrData, config);
  const result = await repository.transaction(root => {
    const request = activeRequest(root, data.token, now, { payerUid: req.user.uid });
    if (request.expiresAt !== data.expiresAt) throw httpError(400, 'INVALID_QR', 'The QR code does not match this request');
    root.requestAccess ||= {};
    root.requestAccess[request.id] ||= {};
    root.requestAccess[request.id][req.user.uid] = { expiresAt: request.expiresAt, scannedAt: new Date(now).toISOString() };
    return root;
  });
  const cards = Object.entries(getUser(result.snapshot, req.user.uid)?.cards || {})
    .filter(([, card]) => isUsableTestCard(card, now)).map(([id, card]) => publicCard(card, id));
  res.json({ paymentRequest: publicRequest(result.snapshot.paymentRequests[data.token], now), cards,
    receiverCard: cards.find(card => card.isDefault) || cards[0] || null, serverTime: new Date(now).toISOString() });
}));
router.post('/confirm-payment', route(async (req, res) => {
  res.json(await confirmPayment({ ...req.app.locals, uid: req.user.uid, body: req.body, idempotencyHeader: req.get('Idempotency-Key') }));
}));
const listRequests = route(async (req, res) => {
  const { repository, config } = req.app.locals;
  const now = config.now();
  const result = await repository.transaction(root => expireRequests(root, req.user.uid, now));
  const requests = Object.values(result.snapshot.paymentRequests || {})
    .filter(request => requesterUid(request) === req.user.uid)
    .map(request => publicRequest(request, now))
    .filter(request => !req.query.status || req.query.status === 'all' || request.status === req.query.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ requests, serverTime: new Date(now).toISOString() });
});
router.get('/requests', listRequests);
router.get('/history', listRequests); // Compatibility alias for the previous stale client route.
router.get('/requests/:requestId', route(async (req, res) => {
  const id = requireId(req.params.requestId, 'Request ID');
  const { repository, config } = req.app.locals;
  const now = config.now();
  const root = await repository.read();
  const request = root.paymentRequests?.[id];
  if (!request || (requesterUid(request) !== req.user.uid && request.payerUid !== req.user.uid && !root.requestAccess?.[id]?.[req.user.uid])) {
    throw httpError(404, 'REQUEST_NOT_FOUND', 'Payment request was not found');
  }
  const response = { paymentRequest: publicRequest(request, now), serverTime: new Date(now).toISOString() };
  if (request.transactionId && (requesterUid(request) === req.user.uid || request.payerUid === req.user.uid)) {
    response.transaction = publicTransaction(root.transactions[request.transactionId], req.user.uid);
  }
  if (requesterUid(request) === req.user.uid && response.paymentRequest.status === 'pending') {
    response.qrData = JSON.stringify(secureQrData(request, config));
    response.qrCode = await QRCode.toDataURL(response.qrData, { width: 360, margin: 3 });
  }
  res.json(response);
}));
router.post('/requests/:requestId/cancel', route(async (req, res) => {
  const id = requireId(req.params.requestId, 'Request ID');
  const { repository, config } = req.app.locals;
  const now = config.now();
  const result = await repository.transaction(root => {
    const request = root.paymentRequests?.[id];
    if (!request || requesterUid(request) !== req.user.uid) throw httpError(404, 'REQUEST_NOT_FOUND', 'Payment request was not found');
    if (request.status === 'cancelled') return root;
    activeRequest(root, id, now);
    request.status = 'cancelled';
    request.cancelledAt = new Date(now).toISOString();
    addNotification(root, req.user.uid, 'request_cancelled', request, now);
    return root;
  });
  res.json({ paymentRequest: publicRequest(result.snapshot.paymentRequests[id], now), serverTime: new Date(now).toISOString() });
}));
module.exports = router;
