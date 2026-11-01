const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const auth = require('../services/authService');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: req => req.app.locals.config.authLimit || 20,
  standardHeaders: true, legacyHeaders: false, message: { code: 'AUTH_RATE_LIMITED', error: 'Too many attempts. Please try again later.' } });

router.get('/capabilities', (req, res) => res.json({ passwordRecovery: auth.resetAvailable(req.app.locals.config), simulated: true }));
router.post('/register', authLimiter, asyncRoute(async (req, res) => {
  const { repository, config } = req.app.locals;
  const session = await auth.register(repository, config, req.body);
  return auth.sendSession(req, res, 201, 'Account created', session);
}));
router.post('/login', authLimiter, asyncRoute(async (req, res) => {
  const { repository, config } = req.app.locals;
  const session = await auth.login(repository, config, req.body);
  return auth.sendSession(req, res, 200, 'Signed in', session);
}));
router.get('/verify', verifyToken, (req, res) => res.json({ valid: true, user: req.user, expiresAt: new Date(req.auth.exp * 1000).toISOString() }));
router.post('/logout', verifyToken, asyncRoute(async (req, res) => {
  const { repository, config } = req.app.locals;
  await repository.transaction(state => {
    state.revokedSessions ||= {};
    const now = Math.floor(auth.nowMs(config) / 1000);
    for (const [id, expiresAt] of Object.entries(state.revokedSessions)) if (expiresAt < now) delete state.revokedSessions[id];
    state.revokedSessions[req.auth.jti] = req.auth.exp;
    return state;
  });
  const { maxAge, ...options } = auth.sessionCookieOptions(config);
  res.clearCookie('nampay_session', options);
  res.json({ message: 'Signed out' });
}));
router.post('/forgot-password', authLimiter, asyncRoute(async (req, res) => {
  await auth.requestPasswordReset(req.app.locals.repository, req.app.locals.config, req.body?.email);
  res.status(202).json({ message: 'If this account can receive recovery instructions, they have been sent.' });
}));
router.post('/reset-password', authLimiter, asyncRoute(async (req, res) => {
  await auth.resetPassword(req.app.locals.repository, req.app.locals.config, req.body?.token, req.body?.newPassword);
  const { maxAge, ...options } = auth.sessionCookieOptions(req.app.locals.config);
  res.clearCookie('nampay_session', options);
  res.json({ message: 'Password reset. Sign in with your new password.' });
}));

module.exports = { router, verifyToken };
