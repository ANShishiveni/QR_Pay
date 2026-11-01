const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { TwilioService } = require('./twilioService');
const { getUser, activeRequest, requireScanAccess, requestAmount } = require('./paymentState');
const { httpError, requireId } = require('../utils/paymentValidation');

const PURPOSE = 'payment_verification';
const COOLDOWN_MS = 60_000;
const WINDOW_MS = 15 * 60_000;
const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const services = new WeakMap();

function hashCode(secret, sessionId, code) {
  return crypto.createHmac('sha256', secret).update(`nampay-otp-v2\0${sessionId}\0${code}`).digest('hex');
}
function sameHash(expected, actual) {
  return /^[a-f0-9]{64}$/.test(expected || '') && /^[a-f0-9]{64}$/.test(actual || '') &&
    crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

class OTPService {
  constructor({ repository, config, deliver } = {}) {
    if (!repository || !config?.jwtSecret) throw new Error('OTP requires an explicit repository and configuration');
    this.repository = repository;
    this.config = config;
    this.deliverOverride = deliver;
    this.outboxDir = config.otpOutboxDir || path.join(os.tmpdir(), 'nampay-private-outbox');
  }
  now() {
    const now = (this.config.now || Date.now)();
    if (!Number.isFinite(now)) throw httpError(503, 'CLOCK_UNAVAILABLE', 'Verification is temporarily unavailable');
    return now;
  }
  provider() {
    if (this.config.otpProvider === 'mock') {
      if (!this.config.demoMode || !['development', 'test'].includes(this.config.nodeEnv) ||
          !(this.repository.kind === 'memory' || this.config.useEmulators === true)) {
        throw httpError(503, 'OTP_PROVIDER_UNAVAILABLE', 'Local verification requires an isolated demo environment');
      }
      return 'mock';
    }
    if (this.config.otpProvider === 'twilio') return 'twilio';
    throw httpError(503, 'OTP_PROVIDER_UNAVAILABLE', 'The verification provider is unavailable');
  }
  destination(user, provider) {
    if (provider === 'mock') return `demo:${user.uid}`;
    if (user.phoneVerified !== true || !/^\+[1-9]\d{7,14}$/.test(user.phoneNumber || '')) {
      throw httpError(403, 'VERIFIED_PHONE_REQUIRED', 'Verify an account phone number before requesting a code');
    }
    return user.phoneNumber;
  }
  file(sessionId) { return path.join(this.outboxDir, `otp-${requireId(sessionId)}.json`); }
  async removeDelivery(sessionId) {
    try { await fs.unlink(this.file(sessionId)); } catch (failure) {
      if (failure.code !== 'ENOENT') {
        // Cleanup failure cannot reopen or reauthorize a consumed challenge.
      }
    }
  }
  async deliver(message, destination, provider) {
    if (this.deliverOverride) return this.deliverOverride(message, destination, provider);
    if (provider === 'twilio') {
      this.twilio ||= new TwilioService(this.config);
      return this.twilio.sendOTP(destination, message.code);
    }
    await fs.mkdir(this.outboxDir, { recursive: true, mode: 0o700 });
    await fs.chmod(this.outboxDir, 0o700);
    const file = await fs.open(this.file(message.sessionId), 'wx', 0o600);
    try { await file.writeFile(`${JSON.stringify(message)}\n`, 'utf8'); }
    finally { await file.close(); }
  }
  async issue({ userUid, requestId, purpose = PURPOSE, ip = 'unknown' }) {
    requireId(userUid, 'User ID');
    requireId(requestId, 'Request ID');
    if (purpose !== PURPOSE) throw httpError(400, 'OTP_PURPOSE_INVALID', 'The verification purpose is invalid');
    const provider = this.provider();
    const now = this.now();
    const sessionId = crypto.randomUUID();
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challengeHash = hashCode(this.config.jwtSecret, sessionId, code);
    let destination;
    let oldSessionIds = [];
    const result = await this.repository.transaction(root => {
      oldSessionIds = [];
      const user = getUser(root, userUid);
      if (!user || (user.status && user.status !== 'active')) throw httpError(401, 'AUTH_INVALID', 'Your session is no longer valid');
      const request = activeRequest(root, requestId, now, { payerUid: userUid });
      requireScanAccess(root, request, userUid);
      destination = this.destination(user, provider);
      const scopes = [['user', userUid, 5], ['destination', destination, 5], ['ip', String(ip), 20]];
      const rates = root.otpRateLimits ||= {};
      for (const [scope, identity, max] of scopes) {
        const key = `${scope}_${crypto.createHash('sha256').update(identity).digest('hex')}`;
        const existing = rates[key];
        const rate = existing && now - existing.windowStartedAt < WINDOW_MS
          ? existing : { windowStartedAt: now, count: 0, lastSentAt: null };
        if (rate.count >= max || (scope !== 'ip' && rate.lastSentAt !== null && now - rate.lastSentAt < COOLDOWN_MS)) {
          throw httpError(429, 'OTP_RATE_LIMITED', 'Please wait before requesting another verification code');
        }
        rates[key] = { windowStartedAt: rate.windowStartedAt, count: rate.count + 1, lastSentAt: now };
      }
      const sessions = root.otpSessions ||= {};
      for (const old of Object.values(sessions)) {
        if (old.userUid === userUid && old.requestId === requestId && ['pending', 'verified'].includes(old.status)) {
          old.status = 'superseded';
          old.supersededAt = new Date(now).toISOString();
          oldSessionIds.push(old.id);
        }
      }
      sessions[sessionId] = {
        id: sessionId, userUid, userId: userUid, requestId, amountMinor: requestAmount(request), purpose,
        challengeHash, attempts: 0, maxAttempts: MAX_ATTEMPTS, status: 'pending',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(Math.min(now + TTL_MS, Date.parse(request.expiresAt))).toISOString(), provider,
      };
      return root;
    });
    const session = result.snapshot?.otpSessions?.[sessionId];
    if (!result.committed || !session) throw httpError(503, 'OTP_UNAVAILABLE', 'Verification is temporarily unavailable');
    await Promise.all(oldSessionIds.map(id => this.removeDelivery(id)));
    try {
      await this.deliver({ simulated: provider === 'mock', sessionId, userUid, requestId, purpose, code, expiresAt: session.expiresAt }, destination, provider);
    } catch {
      await this.repository.transaction(root => {
        const current = root.otpSessions?.[sessionId];
        if (current?.status === 'pending') current.status = 'delivery_failed';
        return root;
      });
      await this.removeDelivery(sessionId);
      throw httpError(503, 'OTP_DELIVERY_FAILED', 'The verification code could not be delivered. Please try again later.');
    }
    return {
      success: true, sessionId, expiresAt: session.expiresAt, resendAt: new Date(now + COOLDOWN_MS).toISOString(), provider,
      maskedDestination: provider === 'mock' ? 'Local demo inbox' : `••••${destination.slice(-4)}`,
      message: provider === 'mock' ? 'A test code was delivered to the local demo inbox' : 'A code was sent to your verified account phone',
    };
  }
  async verify({ userUid, sessionId, otp }) {
    requireId(userUid, 'User ID');
    requireId(sessionId, 'Session ID');
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) throw httpError(400, 'OTP_INPUT_INVALID', 'Enter the six-digit verification code');
    const now = this.now();
    let failure;
    const result = await this.repository.transaction(root => {
      failure = null;
      const session = root.otpSessions?.[sessionId];
      if (!session || session.userUid !== userUid) throw httpError(404, 'OTP_SESSION_NOT_FOUND', 'Verification session not found');
      if (session.purpose !== PURPOSE) throw httpError(403, 'OTP_BINDING_INVALID', 'This verification cannot authorize the payment');
      // Preserve terminal audit states: expiry cannot turn a consumed or revoked
      // authorization back into a different lifecycle state.
      if (session.status !== 'pending' || !Number.isInteger(session.attempts) || session.attempts >= MAX_ATTEMPTS || session.maxAttempts !== MAX_ATTEMPTS) {
        throw httpError(session.status === 'blocked' ? 429 : 409, 'OTP_SESSION_UNAVAILABLE', 'Request a new verification code');
      }
      if (!Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now) {
        session.status = 'expired';
        failure = httpError(410, 'OTP_EXPIRED', 'This verification code has expired');
        return root;
      }
      const request = activeRequest(root, session.requestId, now, { payerUid: userUid });
      requireScanAccess(root, request, userUid);
      if (session.amountMinor !== requestAmount(request)) throw httpError(403, 'OTP_BINDING_INVALID', 'This verification cannot authorize the payment');
      session.attempts += 1;
      if (!sameHash(session.challengeHash, hashCode(this.config.jwtSecret, sessionId, otp))) {
        if (session.attempts >= MAX_ATTEMPTS) session.status = 'blocked';
        failure = httpError(session.status === 'blocked' ? 429 : 400, 'OTP_INVALID', 'The verification code is incorrect');
        failure.attemptsLeft = Math.max(0, MAX_ATTEMPTS - session.attempts);
        return root;
      }
      session.status = 'verified';
      session.verifiedAt = new Date(now).toISOString();
      return root;
    });
    if (!result.committed) throw httpError(503, 'OTP_UNAVAILABLE', 'Verification is temporarily unavailable');
    const session = result.snapshot.otpSessions[sessionId];
    if (session.status !== 'pending') await this.removeDelivery(sessionId);
    if (failure) throw failure;
    return { success: true, sessionId, requestId: session.requestId, status: 'verified', expiresAt: session.expiresAt };
  }
  async status({ userUid, sessionId }) {
    requireId(userUid, 'User ID');
    requireId(sessionId, 'Session ID');
    const session = await this.repository.read(`otpSessions/${sessionId}`);
    if (!session || session.userUid !== userUid) throw httpError(404, 'OTP_SESSION_NOT_FOUND', 'Verification session not found');
    const isExpired = !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= this.now();
    return { success: true, session: {
      id: session.id, requestId: session.requestId, purpose: session.purpose,
      status: isExpired && ['pending', 'verified'].includes(session.status) ? 'expired' : session.status,
      attempts: session.attempts, maxAttempts: session.maxAttempts, expiresAt: session.expiresAt, isExpired,
    } };
  }
}
function getOtpService(app) {
  if (!services.has(app)) services.set(app, new OTPService({ repository: app.locals.repository, config: app.locals.config }));
  return services.get(app);
}
module.exports = { OTPService, getOtpService, hashCode, sameHash, PURPOSE, MAX_ATTEMPTS, COOLDOWN_MS };
