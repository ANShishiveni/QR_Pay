const express = require('express');
const crypto = require('crypto');
const { verifyToken } = require('../middleware/auth');
const { TEST_INSTRUMENTS } = require('../config/stripe');
const { validateTestCard } = require('../utils/cardValidation');
const { route, httpError, requireId } = require('../utils/paymentValidation');
const { getUser, publicCard, getUserTransactions, filterTransactions } = require('../services/paymentState');
const { confirmPayment } = require('../services/paymentService');

const router = express.Router();
router.use(verifyToken);
router.get('/test-instruments', (req, res) => res.json({ instruments: TEST_INSTRUMENTS, simulated: true }));
router.get('/cards', route(async (req, res) => {
  const user = getUser(await req.app.locals.repository.read(), req.user.uid);
  const cards = Object.entries(user?.cards || {}).map(([id, card]) => publicCard(card, id));
  res.json({ cards, count: cards.length, simulated: true });
}));
router.post('/link-card', route(async (req, res) => {
  const { repository, config } = req.app.locals;
  const now = config.now();
  const { instrument, expMonth, expYear, cardholderName } = validateTestCard(req.body, now);
  const id = crypto.randomUUID();
  const result = await repository.transaction(root => {
    const user = getUser(root, req.user.uid);
    if (!user) throw httpError(404, 'USER_NOT_FOUND', 'Account was not found');
    user.cards ||= {};
    if (Object.values(user.cards).some(card => card.testCardId === instrument.id)) {
      throw httpError(409, 'TEST_CARD_ALREADY_ADDED', 'This test instrument is already linked');
    }
    const defaultId = Object.entries(user.cards).find(([, card]) => card.isDefault)?.[0] || Object.keys(user.cards).sort()[0];
    for (const [cardId, card] of Object.entries(user.cards)) card.isDefault = cardId === defaultId;
    user.cards[id] = {
      id, ownerUid: req.user.uid, testCardId: instrument.id, mockMethodId: `sim_${id}`,
      brand: instrument.brand, last4: instrument.last4, bankLabel: instrument.bankLabel,
      cardholderName, expMonth, expYear, isDefault: !defaultId, createdAt: new Date(now).toISOString(), simulated: true,
    };
    return root;
  });
  res.status(201).json({ message: 'Test instrument linked', card: publicCard(getUser(result.snapshot, req.user.uid).cards[id]), simulated: true });
}));
router.put('/set-default-card/:cardId', route(async (req, res) => {
  const id = requireId(req.params.cardId, 'Test card ID');
  await req.app.locals.repository.transaction(root => {
    const cards = getUser(root, req.user.uid)?.cards || {};
    if (!cards[id]) throw httpError(404, 'CARD_NOT_FOUND', 'Test instrument was not found');
    for (const [cardId, card] of Object.entries(cards)) card.isDefault = cardId === id;
    return root;
  });
  res.json({ message: 'Default test instrument updated' });
}));
router.delete('/remove-card/:cardId', route(async (req, res) => {
  const id = requireId(req.params.cardId, 'Test card ID');
  await req.app.locals.repository.transaction(root => {
    const cards = getUser(root, req.user.uid)?.cards || {};
    if (!cards[id]) throw httpError(404, 'CARD_NOT_FOUND', 'Test instrument was not found');
    delete cards[id];
    const defaultId = Object.entries(cards).find(([, card]) => card.isDefault)?.[0] || Object.keys(cards).sort()[0];
    for (const [cardId, card] of Object.entries(cards)) card.isDefault = cardId === defaultId;
    return root;
  });
  res.json({ message: 'Test instrument removed' });
}));
// Compatibility endpoint delegates to the same request-bound settlement path;
// recipient/amount-only direct transfers no longer bypass QR/OTP verification.
router.post('/process-payment', route(async (req, res) => {
  res.json(await confirmPayment({ ...req.app.locals, uid: req.user.uid, body: req.body, idempotencyHeader: req.get('Idempotency-Key') }));
}));
router.get('/history', route(async (req, res) => {
  const root = await req.app.locals.repository.read();
  res.json(filterTransactions(getUserTransactions(root, req.user.uid), req.query));
}));
router.get('/transactions/:transactionId', route(async (req, res) => {
  const id = requireId(req.params.transactionId, 'Transaction ID');
  const root = await req.app.locals.repository.read();
  const transaction = getUserTransactions(root, req.user.uid).find(item => item.id === id);
  if (!transaction) throw httpError(404, 'TRANSACTION_NOT_FOUND', 'Transaction was not found');
  res.json({ transaction });
}));
module.exports = router;
