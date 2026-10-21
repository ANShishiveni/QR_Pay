function resolveApiHost(value, { development, hostname = 'localhost' } = {}) {
  const fallback = hostname === '127.0.0.1' ? 'http://127.0.0.1:3000' : 'http://localhost:3000';
  if (!value && !development) throw new Error('Configure an HTTPS API host for this build.');
  const url = new URL(value || fallback);
  if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid API host configuration.');
  }
  if (!development && url.protocol !== 'https:') throw new Error('HTTPS is required outside development.');
  if (url.pathname !== '/' && url.pathname !== '') throw new Error('Configure the API host without a path.');
  return url.origin;
}

function sessionExpiry(value) {
  const expiresAt = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('The session has expired. Please sign in again.');
  }
  return expiresAt;
}

function safeApiError(error) {
  const status = error.response?.status;
  const body = error.response?.data;
  const failure = new Error(
    typeof body?.error === 'string'
      ? body.error
      : status ? 'The request could not be completed.' : 'Unable to reach NamPay. Check your connection and try again.'
  );
  failure.code = typeof body?.code === 'string' ? body.code : status ? 'REQUEST_FAILED' : 'NETWORK_UNAVAILABLE';
  failure.isNetworkError = !status;
  // Never forward Axios config/request objects containing credentials/form data.
  if (status) {
    const data = { error: failure.message, code: failure.code };
    for (const key of ['attemptsLeft', 'retryAfter', 'expiresAt', 'resendAt']) {
      if (typeof body?.[key] === 'number') data[key] = body[key];
    }
    failure.response = { status, data };
  }
  return failure;
}

module.exports = { resolveApiHost, sessionExpiry, safeApiError };
