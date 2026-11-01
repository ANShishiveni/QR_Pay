const jwt = require('jsonwebtoken');
const { getUser, publicUser, nowMs, HttpError } = require('../services/authService');

function getToken(req) {
  if (req.headers.authorization) {
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization);
    return match?.[1] || null;
  }
  const cookie = (req.headers.cookie || '').split(';').find(part => part.trim().startsWith('nampay_session='));
  if (!cookie) return null;
  try { return decodeURIComponent(cookie.trim().slice('nampay_session='.length)); } catch { return null; }
}

async function verifyToken(req, res, next) {
  const token = getToken(req);
  if (!token) return next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue'));
  const { config, repository } = req.app.locals;
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'], issuer: config.jwtIssuer || 'nampay-api', audience: config.jwtAudience || 'nampay-client',
      clockTimestamp: Math.floor(nowMs(config) / 1000),
    });
    if (typeof decoded !== 'object' || decoded.sub !== decoded.uid || !/^[A-Za-z0-9_-]{1,128}$/.test(decoded.uid || '') ||
        !Number.isInteger(decoded.sv) || !Number.isInteger(decoded.exp) || !Number.isInteger(decoded.iat) ||
        decoded.exp <= decoded.iat || decoded.exp - decoded.iat > (config.jwtTtlSeconds || 3600) ||
        decoded.iat > Math.floor(nowMs(config) / 1000) + 30 || !/^[a-f0-9-]{36}$/.test(decoded.jti || '')) throw new Error('Invalid claims');
  } catch { return next(new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Sign in again.')); }
  try {
    const state = (await repository.read()) || {};
    const user = getUser(state, decoded.uid);
    if (!user || (user.status && user.status !== 'active') || decoded.sv !== (user.sessionVersion || 0) || state.revokedSessions?.[decoded.jti]) {
      return next(new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Sign in again.'));
    }
    req.user = publicUser(user);
    req.auth = decoded;
    req.authToken = token;
    return next();
  } catch (error) { return next(error); }
}

module.exports = { verifyToken, getToken };
