const { resolveApiHost, sessionExpiry, safeApiError } = require('../apiPolicy');

describe('API security policy', () => {
  test('local development keeps the web hostname consistent for cookie sessions', () => {
    expect(resolveApiHost('', { development: true, hostname: '127.0.0.1' })).toBe('http://127.0.0.1:3000');
    expect(resolveApiHost('', { development: true })).toBe('http://localhost:3000');
  });
  test.each([
    '', 'http://localhost:3000', 'http://example.com',
    'https://user:password@example.com', 'https://example.com/api',
    'https://example.com?token=value', 'https://example.com#token', 'file:///tmp/app',
  ])('production rejects unsafe API host %s', value => {
    expect(() => resolveApiHost(value, { development: false })).toThrow();
  });
  test('production accepts an explicit HTTPS origin', () => {
    expect(resolveApiHost('https://api.example.com/', { development: false })).toBe('https://api.example.com');
  });
  test('invalid and expired server sessions cannot become authenticated state', () => {
    expect(() => sessionExpiry('not-a-date')).toThrow();
    expect(() => sessionExpiry(Date.now() - 1)).toThrow();
    expect(sessionExpiry(Date.now() + 10000)).toBeGreaterThan(Date.now());
  });
  test('API failures discard request bodies, tokens and private transport diagnostics', () => {
    const secret = 'sensitive-test-sentinel';
    const failure = safeApiError({
      message: secret, config: { headers: { Authorization: secret }, data: secret }, request: secret,
      response: { status: 429, data: { error: 'Try again later.', code: 'OTP_RATE_LIMITED', attemptsLeft: 0, privateKey: secret } },
    });
    expect(failure.response).toEqual({ status: 429, data: { error: 'Try again later.', code: 'OTP_RATE_LIMITED', attemptsLeft: 0 } });
    expect(JSON.stringify(failure)).not.toContain(secret);
    expect(failure.config).toBeUndefined();
    expect(failure.request).toBeUndefined();
  });
  test('transport errors expose uncertainty rather than a fabricated payment outcome', () => {
    const failure = safeApiError({ code: 'ECONNABORTED', message: 'private transport details' });
    expect(failure.isNetworkError).toBe(true);
    expect(failure.code).toBe('NETWORK_UNAVAILABLE');
    expect(failure.response).toBeUndefined();
    expect(failure.message).not.toContain('private');
  });
});
