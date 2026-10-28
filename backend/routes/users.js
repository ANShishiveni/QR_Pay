const express = require('express');
const bcrypt = require('bcryptjs');
const { verifyToken } = require('../middleware/auth');
const auth = require('../services/authService');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.use(verifyToken);

function rejectOtherIdentity(req) {
  if ((req.body?.uid && req.body.uid !== req.user.uid) || (req.query.uid && req.query.uid !== req.user.uid)) {
    auth.fail(403, 'NOT_OWNER', 'You may only access your own account');
  }
}

router.get('/profile', asyncRoute(async (req, res) => {
  rejectOtherIdentity(req);
  res.json({ user: req.user, capabilities: { phoneChange: false, emailChange: false } });
}));

router.put('/profile', asyncRoute(async (req, res) => {
  rejectOtherIdentity(req);
  const { repository, config } = req.app.locals;
  const body = req.body || {};
  if (Object.keys(body).some(key => !['firstName', 'lastName', 'email', 'phoneNumber', 'uid'].includes(key))) {
    auth.fail(400, 'INVALID_INPUT', 'Only name fields can be edited here');
  }
  if ((body.email !== undefined && auth.normalizeEmail(body.email) !== req.user.email) ||
      (body.phoneNumber !== undefined && auth.validatePhone(body.phoneNumber) !== req.user.phoneNumber)) {
    auth.fail(409, 'CONTACT_VERIFICATION_REQUIRED', 'Contact changes require a verified delivery provider, which is not enabled in this demo');
  }
  const changes = {};
  if (body.firstName !== undefined) changes.firstName = auth.validateName(body.firstName, 'first name');
  if (body.lastName !== undefined) changes.lastName = auth.validateName(body.lastName, 'last name');
  if (!Object.keys(changes).length) auth.fail(400, 'INVALID_INPUT', 'Enter a name to update');
  let user;
  await repository.transaction(state => {
    const current = auth.getUser(state, req.user.uid);
    user = auth.canonicalUser(state, current, config);
    Object.assign(user, changes, { updatedAt: new Date(auth.nowMs(config)).toISOString() });
    return state;
  });
  res.json({ message: 'Profile updated', updates: changes, user: auth.publicUser(user) });
}));

router.put('/preferences', asyncRoute(async (req, res) => {
  const body = req.body || {};
  if (!Object.keys(body).length || Object.keys(body).some(key => !['theme', 'notifications', 'biometrics'].includes(key)) ||
      (body.theme !== undefined && !['system', 'light', 'dark'].includes(body.theme)) ||
      (body.notifications !== undefined && typeof body.notifications !== 'boolean') ||
      (body.biometrics !== undefined && typeof body.biometrics !== 'boolean')) {
    auth.fail(400, 'INVALID_PREFERENCES', 'Choose valid appearance and notification preferences');
  }
  const { repository, config } = req.app.locals;
  let user;
  await repository.transaction(state => {
    user = auth.canonicalUser(state, auth.getUser(state, req.user.uid), config);
    user.preferences = { theme: 'system', notifications: true, biometrics: false, ...user.preferences, ...body };
    return state;
  });
  res.json({ preferences: user.preferences });
}));

router.post('/photo', asyncRoute(async (req, res) => {
  const { photo } = req.body || {};
  if (typeof photo !== 'string' || photo.length > 1400000) auth.fail(400, 'INVALID_PHOTO', 'Choose a PNG, JPEG, or WebP photo under 1 MB');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
  if (!match) auth.fail(400, 'INVALID_PHOTO', 'Choose a PNG, JPEG, or WebP photo');
  const bytes = Buffer.from(match[2], 'base64');
  const valid = (match[1] === 'png' && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ||
    (match[1] === 'jpeg' && bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) ||
    (match[1] === 'webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP');
  if (!valid || bytes.length > 1024 * 1024) auth.fail(400, 'INVALID_PHOTO', 'The photo format could not be verified');
  const { repository, config } = req.app.locals;
  await repository.transaction(state => {
    const user = auth.canonicalUser(state, auth.getUser(state, req.user.uid), config);
    user.photoUrl = photo;
    user.updatedAt = new Date(auth.nowMs(config)).toISOString();
    return state;
  });
  res.json({ message: 'Profile photo updated', photoUrl: photo });
}));

router.put('/password', asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  auth.validatePassword(newPassword);
  if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword) > 72) auth.fail(400, 'INVALID_INPUT', 'Enter your current password');
  const { repository, config } = req.app.locals;
  const before = auth.getUser((await repository.read()) || {}, req.user.uid);
  if (!before || !(await bcrypt.compare(currentPassword, before.hashedPassword))) auth.fail(401, 'REAUTHENTICATION_FAILED', 'The current password is incorrect');
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await repository.transaction(state => {
    const current = auth.getUser(state, req.user.uid);
    if (current.hashedPassword !== before.hashedPassword) auth.fail(409, 'ACCOUNT_CHANGED', 'Your account changed. Please sign in again.');
    const user = auth.canonicalUser(state, current, config);
    user.hashedPassword = hashedPassword;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.updatedAt = new Date(auth.nowMs(config)).toISOString();
    return state;
  });
  const { maxAge, ...options } = auth.sessionCookieOptions(config);
  res.clearCookie('nampay_session', options);
  res.json({ message: 'Password changed. Sign in again.', sessionsRevoked: true });
}));

router.get('/cards', asyncRoute(async (req, res) => {
  const { getUser, publicCard } = require('../services/paymentState');
  const state = (await req.app.locals.repository.read()) || {};
  const cards = Object.entries(getUser(state, req.user.uid)?.cards || {}).map(([id, card]) => publicCard ? publicCard({ ...card, id }) : {
    id, brand: card.brand, last4: card.last4, bank: card.bank, isDefault: !!card.isDefault, createdAt: card.createdAt, simulated: true,
  });
  res.json({ cards });
}));

function activity(req, state) {
  const { getUserTransactions } = require('../services/paymentState');
  return getUserTransactions(state, req.user.uid);
}

router.get('/transactions', asyncRoute(async (req, res) => {
  rejectOtherIdentity(req);
  const { filterTransactions } = require('../services/paymentState');
  if (req.query.type && !['all', 'sent', 'received', 'send', 'receive'].includes(req.query.type)) auth.fail(400, 'INVALID_FILTER', 'Choose a valid activity filter');
  const result = filterTransactions(activity(req, (await req.app.locals.repository.read()) || {}), req.query);
  res.json({ ...result, total: result.pagination.total,
    nextOffset: result.pagination.hasMore ? result.pagination.offset + result.pagination.limit : null });
}));

router.get('/transactions/:id', asyncRoute(async (req, res) => {
  const transaction = activity(req, (await req.app.locals.repository.read()) || {}).find(item => item.id === req.params.id || item.transactionId === req.params.id);
  if (!transaction) auth.fail(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
  res.json({ transaction, receipt: { ...transaction, disclaimer: 'SIMULATED PAYMENT — No real funds transferred', simulated: true } });
}));

router.get('/stats', asyncRoute(async (req, res) => {
  const items = activity(req, (await req.app.locals.repository.read()) || {});
  const completed = items.filter(item => item.status === 'completed' || item.status === 'succeeded');
  const sent = completed.filter(item => ['sent', 'send'].includes(item.role || item.type));
  const received = completed.filter(item => ['received', 'receive'].includes(item.role || item.type));
  const totalSentMinor = sent.reduce((sum, item) => sum + item.amountMinor, 0);
  const totalReceivedMinor = received.reduce((sum, item) => sum + item.amountMinor, 0);
  res.json({ stats: { totalTransactions: completed.length, totalSentMinor, totalReceivedMinor,
    totalSent: totalSentMinor / 100, totalReceived: totalReceivedMinor / 100, simulated: true, currency: 'NAD',
    lastTransaction: [...completed].sort((a, b) => Date.parse(b.completedAt || b.timestamp || b.createdAt) - Date.parse(a.completedAt || a.timestamp || a.createdAt))[0] || null } });
}));

router.get('/notifications', asyncRoute(async (req, res) => {
  const { expireRequests } = require('../services/paymentState');
  const { repository, config } = req.app.locals;
  const now = auth.nowMs(config);
  const { snapshot: state } = await repository.transaction(root => expireRequests(root, req.user.uid, now));
  const notifications = Object.entries(state.notifications?.[req.user.uid] || {}).map(([id, item]) => ({ ...item, id }));
  notifications.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  res.json({ notifications: notifications.slice(0, 100) });
}));
router.put('/notifications/:id/read', asyncRoute(async (req, res) => {
  const { repository, config } = req.app.locals;
  await repository.transaction(state => {
    const entry = state.notifications?.[req.user.uid]?.[req.params.id];
    if (!entry) auth.fail(404, 'NOT_FOUND', 'Notification not found');
    entry.readAt ||= new Date(auth.nowMs(config)).toISOString();
    return state;
  });
  res.json({ message: 'Notification marked as read' });
}));

module.exports = router;
