const request = require('supertest');
const { createMemoryRepository } = require('../repositories');
const { testContext } = require('./helpers/app');

describe('isolated backend foundation', () => {
  it('imports an app without binding a listener or contacting Firebase', async () => {
    const { app } = testContext({ routes: false });
    const result = await request(app).get('/api/health').expect(200);
    expect(result.body.status).toBe('OK');
    expect(result.body.simulated).toBe(true);
  });

  it('does not echo malformed JSON secrets in error responses', async () => {
    const { app } = testContext({ routes: false });
    const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"password":"private-marker",').expect(400);
    expect(response.body.code).toBe('INVALID_JSON');
    expect(JSON.stringify(response.body)).not.toContain('private-marker');
  });

  it('serializes competing conditional state transitions', async () => {
    const repository = createMemoryRepository({ request: { status: 'pending' } });
    const results = await Promise.all(Array.from({ length: 10 }, () => repository.transaction(root => {
      if (root.request.status !== 'pending') return undefined;
      root.request.status = 'completed';
      return root;
    })));
    expect(results.filter(result => result.committed)).toHaveLength(1);
    expect(await repository.read('request/status')).toBe('completed');
  });

  it('does not leak mutable references or partial failed transactions', async () => {
    const repository = createMemoryRepository({ count: 1 });
    const snapshot = await repository.read();
    snapshot.count = 9;
    await expect(repository.transaction(root => { root.count = 3; throw new Error('abort'); })).rejects.toThrow('abort');
    expect(await repository.read('count')).toBe(1);
  });
});

describe('runtime fail-closed configuration', () => {
  const { runtimeConfig, createApp } = require('../server');
  const { emulatorConfiguration } = require('../config/firebase');
  const { createTestConfig } = require('./helpers/app');
  it('requires strong local signing keys outside an explicit non-production demo', () => {
    expect(() => runtimeConfig({ NODE_ENV: 'production', JWT_SECRET: 'weak' })).toThrow();
    expect(() => runtimeConfig({ NODE_ENV: 'development' })).toThrow();
    expect(runtimeConfig({ NODE_ENV: 'development', DEMO_MODE: 'true', OTP_PROVIDER: 'mock' }).jwtSecret.length).toBeGreaterThanOrEqual(32);
  });
  it('cannot enable mock providers or memory data in production', () => {
    expect(() => runtimeConfig({ NODE_ENV: 'production', DEMO_MODE: 'true', OTP_PROVIDER: 'mock' })).toThrow();
    expect(() => createApp({ repository: createMemoryRepository(), config: createTestConfig({ nodeEnv: 'production', demoMode: false, otpProvider: 'twilio' }) })).toThrow();
  });
  it.each([
    { FIREBASE_DATABASE_EMULATOR_HOST: 'example.com:9000' },
    { FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:0' },
    { FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:99999' },
    { FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000', NODE_ENV: 'production' },
    { FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000', FIREBASE_PROJECT_ID: 'live-project' },
    { FIREBASE_DATABASE_EMULATOR_HOST: undefined, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
  ])('rejects unsafe emulator environment (%s)', overrides => {
    expect(() => emulatorConfiguration({ NODE_ENV: 'development', DEMO_MODE: 'true', FIREBASE_PROJECT_ID: 'demo-nampay', ...overrides })).toThrow();
  });
  it('accepts a loopback-only emulator for an explicit demo project', () => {
    expect(emulatorConfiguration({ NODE_ENV: 'development', DEMO_MODE: 'true', FIREBASE_PROJECT_ID: 'demo-nampay', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' })).toEqual({ host: '127.0.0.1:9000', projectId: 'demo-nampay' });
  });
});

describe('Firebase adapter contract (SDK test double, not emulator evidence)', () => {
  const { createFirebaseRepository } = require('../repositories');
  it('omits the empty root path rejected by the SDK and preserves explicit child paths', async () => {
    const state = { users: { payer: { uid: 'payer' } } };
    const ref = jest.fn(path => {
      if (path === '') throw new Error('Firebase rejects an empty path');
      return { get: async () => ({ val: () => path ? state.users.payer : state }) };
    });
    const repository = createFirebaseRepository({ ref });
    expect(await repository.read()).toEqual(state);
    expect(ref).toHaveBeenLastCalledWith();
    expect(await repository.read('users/payer')).toEqual(state.users.payer);
    expect(ref).toHaveBeenLastCalledWith('users/payer');
  });
  function database() {
    const events = [];
    let data = { count: 1 };
    let cached = false;
    const ref = {
      on: jest.fn(() => events.push('listen')),
      once: jest.fn(async () => { events.push('read'); cached = true; return { val: () => data }; }),
      transaction: jest.fn(async callback => {
        expect(cached).toBe(true);
        events.push('transaction');
        const next = callback(structuredClone(data));
        if (next !== undefined) data = next;
        return { committed: next !== undefined, snapshot: { val: () => data } };
      }),
      off: jest.fn(() => events.push('unlisten')),
    };
    return { ref, events, repository: createFirebaseRepository({ ref: () => ref }) };
  }
  it('primes and retains the cache through the conditional commit', async () => {
    const { repository, events } = database();
    const result = await repository.transaction(root => { root.count += 1; return root; });
    expect(result).toEqual({ committed: true, snapshot: { count: 2 } });
    expect(events).toEqual(['listen', 'read', 'transaction', 'unlisten']);
  });
  it('releases its listener on rejection and keeps a failed update uncommitted', async () => {
    const { repository, events } = database();
    await expect(repository.transaction(root => { root.count = 100; throw new Error('validation'); })).rejects.toThrow('validation');
    expect(events.at(-1)).toBe('unlisten');
    const result = await repository.transaction(root => root);
    expect(result.snapshot.count).toBe(1);
  });
});
