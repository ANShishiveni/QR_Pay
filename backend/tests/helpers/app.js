const crypto = require('crypto');
const { createMemoryRepository } = require('../../repositories');

function createTestConfig(overrides = {}) {
  return {
    nodeEnv: 'test', demoMode: true, otpProvider: 'mock',
    jwtSecret: crypto.randomBytes(48).toString('base64url'),
    jwtIssuer: 'nampay-api', jwtAudience: 'nampay-client', jwtTtlSeconds: 3600,
    allowedOrigins: ['http://localhost:19006'], authLimit: 1000, requestLimit: 10000,
    now: () => Date.now(), ...overrides,
  };
}

function testContext(options = {}) {
  const { createApp } = require('../../server');
  const repository = options.repository || createMemoryRepository(options.seed);
  const config = createTestConfig(options.config);
  const app = createApp({ ...options, repository, config });
  return { app, repository, config };
}

module.exports = { createTestConfig, testContext };
