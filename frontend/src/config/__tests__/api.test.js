import { Platform } from 'react-native';
import apiClient, { authAPI, otpAPI, qrAPI, userAPI } from '../api';
import sessionStorage from '../../services/storage/sessionStorage';
import { onSessionExpired } from '../../services/sessionEvents';
import { getNetworkStatus, setNetworkStatus } from '../../services/networkStatus';

jest.mock('../../services/storage/sessionStorage', () => ({
  __esModule: true, default: { getToken: jest.fn(), clearToken: jest.fn() },
}));

beforeEach(() => {
  setNetworkStatus('unknown');
  sessionStorage.getToken.mockResolvedValue('test-only-bearer');
  sessionStorage.clearToken.mockResolvedValue(undefined);
});

test('known disconnection blocks a write before transport and read recovery never replays it', async () => {
  const adapter = jest.fn(async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));
  apiClient.defaults.adapter = adapter;
  setNetworkStatus('unreachable');
  await expect(qrAPI.generateQR({ amountMinor: 100 })).rejects.toMatchObject({ code: 'NETWORK_UNAVAILABLE', requestNotSent: true });
  expect(adapter).not.toHaveBeenCalled();
  await qrAPI.getRequests();
  expect(getNetworkStatus()).toBe('reachable');
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(adapter.mock.calls[0][0].method).toBe('get');
  await qrAPI.generateQR({ amountMinor: 100 });
  expect(adapter).toHaveBeenCalledTimes(2);
});

test('request-bound verification sends no client-supplied phone destination', async () => {
  const adapter = jest.fn(async config => ({
    data: { success: true }, status: 200, statusText: 'OK', headers: {}, config,
  }));
  apiClient.defaults.adapter = adapter;
  await otpAPI.sendOTP('synthetic-request');
  const config = adapter.mock.calls[0][0];
  expect(config.url).toBe('/otp/send');
  expect(JSON.parse(config.data)).toEqual({ requestId: 'synthetic-request', purpose: 'payment_verification' });
  if (Platform.OS !== 'web') expect(config.headers.Authorization).toBe('Bearer test-only-bearer');
});

test('timed-out payment mutation is not automatically retried', async () => {
  const adapter = jest.fn(async config => {
    throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED', config });
  });
  apiClient.defaults.adapter = adapter;
  await expect(qrAPI.confirmPayment({
    requestId: 'synthetic-request', cardId: 'synthetic-card', sessionId: 'synthetic-session',
    idempotencyKey: 'synthetic-stable-key',
  })).rejects.toMatchObject({ isNetworkError: true, code: 'NETWORK_UNAVAILABLE' });
  expect(adapter).toHaveBeenCalledTimes(1);
});

test('unauthorized API response expires the local session and hides transport secrets', async () => {
  const expired = jest.fn();
  const unsubscribe = onSessionExpired(expired);
  apiClient.defaults.adapter = async config => {
    throw Object.assign(new Error('private diagnostics'), {
      config, response: { status: 401, data: { error: 'Sign in again', code: 'UNAUTHORIZED' } },
    });
  };
  try {
    await expect(qrAPI.getRequests()).rejects.toMatchObject({ response: { status: 401 } });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(sessionStorage.clearToken).toHaveBeenCalledTimes(1);
  } finally { unsubscribe(); }
});

test('a guest verification response stays with the startup verifier instead of broadcasting session expiry', async () => {
  const expired = jest.fn();
  const unsubscribe = onSessionExpired(expired);
  apiClient.defaults.adapter = async config => {
    throw Object.assign(new Error('No session'), {
      config, response: { status: 401, data: { code: 'UNAUTHORIZED' } },
    });
  };
  try {
    await expect(authAPI.verifyToken()).rejects.toMatchObject({ response: { status: 401 } });
    expect(expired).not.toHaveBeenCalled();
    expect(sessionStorage.clearToken).toHaveBeenCalledTimes(1);
  } finally { unsubscribe(); }
});

test('incorrect password-change proof does not invalidate an otherwise valid session', async () => {
  const expired = jest.fn();
  const unsubscribe = onSessionExpired(expired);
  apiClient.defaults.adapter = async config => {
    throw Object.assign(new Error('Incorrect password'), {
      config, response: { status: 401, data: { code: 'REAUTHENTICATION_FAILED', error: 'Your current password is incorrect' } },
    });
  };
  try {
    await expect(userAPI.changePassword({ currentPassword: 'wrong proof', newPassword: 'a synthetic new passphrase' }))
      .rejects.toMatchObject({ code: 'REAUTHENTICATION_FAILED' });
    expect(expired).not.toHaveBeenCalled();
    expect(sessionStorage.clearToken).not.toHaveBeenCalled();
  } finally { unsubscribe(); }
});
