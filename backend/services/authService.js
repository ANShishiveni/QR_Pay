const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const nowMs = config => (config.now || Date.now)();
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const emailKey = email => crypto.createHash('sha256').update(email).digest('hex');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'INVALID_EMAIL', 'Enter a valid email address');
  return email;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    fail(400, 'INVALID_PASSWORD', 'Use a password with at least 12 characters and at most 72 UTF-8 bytes');
  }
  return password;
}

function validateName(value, field) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 60 || /[\u0000-\u001f<>]/.test(value)) {
    fail(400, 'INVALID_NAME', `Enter a valid ${field}`);
  }
  return value.trim();
}

function validatePhone(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') fail(400, 'INVALID_PHONE', 'Use an international phone number');
  let phone = value.replace(/[ ()-]/g, '');
  if (/^0\d{8,9}$/.test(phone)) phone = `+264${phone.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) fail(400, 'INVALID_PHONE', 'Use a valid international phone number');
  return phone;
}

function getUser(state, uid) {
  if (!uid || typeof uid !== 'string') return null;
  const canonical = state.users?.[uid];
  if (canonical) return canonical.uid === uid ? canonical : null;
  const candidates = Object.values(state.users || {}).filter(user => user?.uid === uid);
  return candidates.length === 1 ? candidates[0] : null;
}

function findUserByEmail(state, email) {
  const byUid = new Map();
  for (const value of Object.values(state.users || {})) {
    if (value?.uid && normalizeEmail(value.email) === email) {
      const canonical = getUser(state, value.uid);
      if (canonical && normalizeEmail(canonical.email) === email) byUid.set(canonical.uid, canonical);
    }
  }
  if (byUid.size > 1) return null; // Ambiguous legacy identities must be investigated, never guessed.
  return [...byUid.values()][0] || null;
}

function publicUser(user) {
  return {
    uid: user.uid, email: user.email, firstName: user.firstName || '', lastName: user.lastName || '',
    phoneNumber: user.phoneNumber || '', phoneVerified: user.phoneVerified === true,
    emailVerified: user.emailVerified === true, isVerified: user.emailVerified === true,
    photoUrl: user.photoUrl || null, createdAt: user.createdAt || null,
    preferences: { theme: 'system', notifications: true, biometrics: false, ...(user.preferences || {}) },
  };
}

// A successful password check is the only entry point for the non-destructive legacy copy.
function canonicalUser(state, user, config) {
  state.users ||= {};
  if (!user || (state.users[user.uid] && state.users[user.uid].uid !== user.uid)) fail(409, 'IDENTITY_CONFLICT', 'This account requires a reviewed identity repair');
  if (!state.users[user.uid]) {
    const legacyKey = Object.keys(state.users).find(key => state.users[key]?.uid === user.uid);
    state.users[user.uid] = { ...structuredClone(user), email: normalizeEmail(user.email), status: user.status || 'active', sessionVersion: user.sessionVersion || 0 };
    state.migrations ||= {};
    state.migrations.users ||= {};
    state.migrations.users[user.uid] = { legacyKey: legacyKey || null, copiedAt: new Date(nowMs(config)).toISOString(), strategy: 'copy-on-verified-login' };
  }
  state.emailIndex ||= {};
  state.emailIndex[emailKey(normalizeEmail(user.email))] = user.uid;
  return state.users[user.uid];
}

function issueSession(user, config) {
  const issued = Math.floor(nowMs(config) / 1000);
  const token = jwt.sign({ uid: user.uid, sv: user.sessionVersion || 0, iat: issued }, config.jwtSecret, {
    algorithm: 'HS256', subject: user.uid, issuer: config.jwtIssuer || 'nampay-api', audience: config.jwtAudience || 'nampay-client',
    jwtid: crypto.randomUUID(), expiresIn: config.jwtTtlSeconds || 3600,
  });
  return { token, expiresAt: new Date((issued + (config.jwtTtlSeconds || 3600)) * 1000).toISOString(), user: publicUser(user) };
}

function sessionCookieOptions(config) {
  return { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict', path: '/api', maxAge: (config.jwtTtlSeconds || 3600) * 1000 };
}

function sendSession(req, res, status, message, session) {
  const web = req.get('X-Client-Platform') === 'web';
  if (web) res.cookie('nampay_session', session.token, sessionCookieOptions(req.app.locals.config));
  return res.status(status).json({ message, user: session.user, expiresAt: session.expiresAt, ...(web ? {} : { token: session.token }) });
}

async function register(repository, config, body) {
  if (!body || typeof body !== 'object') fail(400, 'INVALID_INPUT', 'Registration details are required');
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);
  const firstName = validateName(body.firstName, 'first name');
  const lastName = validateName(body.lastName, 'last name');
  const phoneNumber = validatePhone(body.phoneNumber);
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = {
    uid: crypto.randomUUID(), email, firstName, lastName, phoneNumber,
    phoneVerified: false, emailVerified: false, hashedPassword, status: 'active', sessionVersion: 0,
    createdAt: new Date(nowMs(config)).toISOString(), cards: {},
    preferences: { theme: 'system', notifications: true, biometrics: false },
  };
  await repository.transaction(state => {
    if (Object.values(state.users || {}).some(existing => normalizeEmail(existing?.email) === email)) {
      fail(409, 'REGISTRATION_UNAVAILABLE', 'This account could not be created. Try signing in or password recovery.');
    }
    state.users ||= {};
    state.users[user.uid] = user;
    state.emailIndex ||= {};
    state.emailIndex[emailKey(email)] = user.uid;
    return state;
  });
  return issueSession(user, config);
}

async function login(repository, config, body) {
  const email = normalizeEmail(body?.email);
  const password = body?.password;
  if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) fail(400, 'INVALID_INPUT', 'Email and password are required');
  const snapshot = await repository.read();
  const user = findUserByEmail(snapshot || {}, email);
  const valid = await bcrypt.compare(password, user?.hashedPassword || dummyHash);
  if (!valid || !user || (user.status && user.status !== 'active')) fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  let current;
  await repository.transaction(state => {
    const latest = getUser(state, user.uid);
    if (!latest || latest.hashedPassword !== user.hashedPassword || (latest.status && latest.status !== 'active')) {
      fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    current = canonicalUser(state, latest, config);
    return state;
  });
  return issueSession(current, config);
}

function resetAvailable(config) {
  return (config.demoMode && ['development', 'test'].includes(config.nodeEnv)) || typeof config.deliverPasswordReset === 'function';
}

async function writeDemoOutbox(config, name, payload) {
  const directory = config.authOutboxDir || config.otpOutboxDir || path.join(os.tmpdir(), 'nampay-demo-outbox');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  await fs.writeFile(path.join(directory, name), JSON.stringify(payload), { mode: 0o600, flag: 'wx' });
}

async function requestPasswordReset(repository, config, emailInput) {
  const email = normalizeEmail(emailInput);
  const user = findUserByEmail((await repository.read()) || {}, email);
  if (!user || !resetAvailable(config)) return;
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = digest(token);
  const now = nowMs(config);
  await repository.transaction(state => {
    state.passwordResets ||= {};
    for (const [key, entry] of Object.entries(state.passwordResets)) {
      if (entry.userUid === user.uid || entry.expiresAt <= now) delete state.passwordResets[key];
    }
    state.passwordResets[tokenHash] = { userUid: user.uid, expiresAt: now + 15 * 60 * 1000, sessionVersion: user.sessionVersion || 0 };
    return state;
  });
  try {
    if (config.demoMode && ['development', 'test'].includes(config.nodeEnv)) {
      await writeDemoOutbox(config, `reset-${crypto.randomUUID()}.json`, { type: 'password-reset', simulated: true, userUid: user.uid, token, expiresAt: new Date(now + 15 * 60 * 1000).toISOString() });
    } else {
      await config.deliverPasswordReset({ email: user.email, token, expiresAt: new Date(now + 15 * 60 * 1000).toISOString() });
    }
  } catch (error) {
    await repository.set(`passwordResets/${tokenHash}`, null);
    // Public response is intentionally indistinguishable for missing accounts and delivery failures.
  }
}

async function resetPassword(repository, config, token, newPassword) {
  validatePassword(newPassword);
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail(400, 'RESET_INVALID', 'This reset link is invalid or expired');
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  const tokenHash = digest(token);
  await repository.transaction(state => {
    const reset = state.passwordResets?.[tokenHash];
    const user = reset && getUser(state, reset.userUid);
    if (!reset || !user || reset.expiresAt <= nowMs(config) || reset.sessionVersion !== (user.sessionVersion || 0)) {
      fail(400, 'RESET_INVALID', 'This reset link is invalid or expired');
    }
    const target = canonicalUser(state, user, config);
    target.hashedPassword = hashedPassword;
    target.sessionVersion = (target.sessionVersion || 0) + 1;
    target.updatedAt = new Date(nowMs(config)).toISOString();
    for (const [key, entry] of Object.entries(state.passwordResets)) if (entry.userUid === user.uid) delete state.passwordResets[key];
    return state;
  });
}

module.exports = { HttpError, fail, nowMs, normalizeEmail, validateEmail, validatePassword, validateName, validatePhone,
  getUser, findUserByEmail, publicUser, canonicalUser, issueSession, sessionCookieOptions, sendSession,
  register, login, resetAvailable, requestPasswordReset, resetPassword };
