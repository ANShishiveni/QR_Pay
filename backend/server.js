const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('node:crypto');
const path = require('node:path');
const { createMemoryRepository, createFirebaseRepository } = require('./repositories');

function runtimeConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const demoMode = env.DEMO_MODE === 'true';
  const otpProvider = env.OTP_PROVIDER || '';
  if (nodeEnv === 'production' && (demoMode || otpProvider === 'mock' || env.DATABASE_MODE === 'memory')) {
    throw new Error('Mock providers and in-memory data are forbidden in production');
  }
  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret && demoMode && ['development', 'test'].includes(nodeEnv)) {
    jwtSecret = crypto.randomBytes(48).toString('base64url');
  }
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
  return {
    nodeEnv, demoMode, otpProvider, jwtSecret, qrSecret: env.QR_SIGNING_SECRET || jwtSecret,
    jwtIssuer: 'nampay-api', jwtAudience: 'nampay-client', jwtTtlSeconds: 3600,
    allowedOrigins: (env.ALLOWED_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006').split(',').map(value => value.trim()),
    authLimit: 20, requestLimit: 300, now: () => Date.now(),
    trustProxy: env.TRUST_PROXY === '1' ? 1 : false,
    otpOutboxDir: env.OTP_OUTBOX_DIR, authOutboxDir: env.AUTH_OUTBOX_DIR || env.OTP_OUTBOX_DIR,
    useEmulators: !!require('./config/firebase').emulatorConfiguration(env),
  };
}

function createApp({ repository, config = runtimeConfig(), routes = true } = {}) {
  if (!repository) throw new Error('An explicit repository is required');
  if (!config.jwtSecret || Buffer.byteLength(config.jwtSecret) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
  if (config.nodeEnv === 'production' && (config.demoMode || config.otpProvider === 'mock' || repository.kind === 'memory')) {
    throw new Error('Mock providers and in-memory data are forbidden in production');
  }
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy || false);
  app.locals.repository = repository;
  app.locals.config = config;
  app.locals.outbox = new Map();
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    res.setHeader('Cache-Control', 'no-store');
    if (config.nodeEnv === 'production' && !req.secure) {
      return res.status(400).json({ code: 'HTTPS_REQUIRED', error: 'A secure connection is required', requestId: req.id });
    }
    next();
  });
  app.use(helmet());
  const allowedOrigins = new Set(config.allowedOrigins || []);
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(Object.assign(new Error('This origin is not allowed'), { status: 403, code: 'ORIGIN_DENIED' }));
    },
  }));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.cookie?.includes('nampay_session=')) {
      if (!req.headers.origin || !allowedOrigins.has(req.headers.origin)) {
        return res.status(403).json({ code: 'ORIGIN_DENIED', error: 'A trusted origin is required', requestId: req.id });
      }
    }
    next();
  });
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: config.requestLimit || 300, standardHeaders: true, legacyHeaders: false,
    message: { code: 'RATE_LIMITED', error: 'Too many requests. Please try again later.' } }));
  app.use(express.json({ limit: '2mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '8kb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'OK', simulated: true, environment: config.nodeEnv,
    database: repository.kind, timestamp: new Date((config.now || Date.now)()).toISOString() }));
  if (routes) {
    const selected = routes === true ? ['auth', 'users', 'payments', 'qr', 'otp'] : routes;
    for (const name of selected) {
      if (!['auth', 'users', 'payments', 'qr', 'otp'].includes(name)) throw new Error('Unknown route group');
      const module = require(`./routes/${name}`);
      app.use(`/api/${name}`, module.router || module);
    }
  }
  app.use((req, res) => res.status(404).json({ code: 'NOT_FOUND', error: 'Route not found', requestId: req.id }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
    const code = status === 500 ? 'INTERNAL_ERROR' : error.type === 'entity.parse.failed' ? 'INVALID_JSON' : error.code || 'INVALID_INPUT';
    const message = error.type === 'entity.parse.failed' ? 'The request body must contain valid JSON' : error.type === 'entity.too.large' ? 'The request body is too large' : error.message;
    if (status >= 500) console.error(JSON.stringify({ requestId: req.id, code }));
    return res.status(status).json({ code, error: status >= 500 ? 'The request could not be completed' : message, requestId: req.id });
  });
  return app;
}

function startServer(env = process.env) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  const config = runtimeConfig(env);
  let repository;
  if (env.DATABASE_MODE === 'memory') {
    if (!config.demoMode || !['development', 'test'].includes(config.nodeEnv)) throw new Error('Memory data requires an explicit local demo');
    repository = createMemoryRepository();
  } else {
    const { initializeFirebase, getFirebaseServices } = require('./config/firebase');
    initializeFirebase();
    repository = createFirebaseRepository(getFirebaseServices().realtimeDb);
  }
  const app = createApp({ repository, config });
  const server = app.listen(Number(env.PORT || 3000), env.HOST || '127.0.0.1', () => {
    console.log(`NamPay simulated-payment API listening on port ${server.address().port}`);
  });
  return { app, server, repository };
}

if (require.main === module) {
  try { startServer(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { createApp, startServer, runtimeConfig };
