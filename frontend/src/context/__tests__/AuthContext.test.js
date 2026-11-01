import React from 'react';
import { AppState, Platform, Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { authAPI } from '../../config/api';
import sessionStorage from '../../services/storage/sessionStorage';
import preferences from '../../utils/asyncStorage';
import { notifySessionExpired } from '../../services/sessionEvents';

jest.mock('../../config/api', () => ({ authAPI: { verifyToken: jest.fn(), logout: jest.fn() } }));
jest.mock('../../services/storage/sessionStorage', () => ({
  __esModule: true, default: { getToken: jest.fn(), setToken: jest.fn(), clearToken: jest.fn() },
}));
jest.mock('../../utils/asyncStorage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  clearSessionCache: jest.fn(), setPreferenceUser: jest.fn(),
}));

let session;
let removeAppStateListener;
function Probe() {
  session = useAuth();
  return <Text>{session.isLoading ? 'checking' : session.user?.uid || 'signed out'}</Text>;
}
const valid = () => ({ data: { valid: true, user: { uid: 'synthetic-payer' }, expiresAt: new Date(Date.now() + 60000).toISOString() } });

beforeEach(() => {
  jest.resetAllMocks();
  removeAppStateListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: removeAppStateListener });
  Platform.OS = 'web';
  preferences.getItem.mockResolvedValue(null);
  sessionStorage.getToken.mockResolvedValue(null);
  sessionStorage.setToken.mockResolvedValue(undefined);
  sessionStorage.clearToken.mockResolvedValue(undefined);
  authAPI.verifyToken.mockResolvedValue(valid());
  authAPI.logout.mockResolvedValue({});
});

test('browser startup validates its server cookie before entering protected UI', async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  expect(view.getByText('checking')).toBeTruthy();
  await waitFor(() => expect(view.getByText('synthetic-payer')).toBeTruthy());
  expect(authAPI.verifyToken).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getToken).not.toHaveBeenCalled();
});

test('native startup without a secure token remains signed out', async () => {
  Platform.OS = 'android';
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('signed out')).toBeTruthy());
  expect(authAPI.verifyToken).not.toHaveBeenCalled();
});

test('network failure cannot authenticate a cached user and retry can recover', async () => {
  authAPI.verifyToken.mockRejectedValueOnce(new Error('offline'));
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('signed out')).toBeTruthy());
  expect(session.authError).toContain('could not be verified');
  await act(async () => { await session.checkAuthStatus(); });
  expect(view.getByText('synthetic-payer')).toBeTruthy();
});

test('secure-store write failure cannot log in a native user', async () => {
  Platform.OS = 'android';
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('signed out')).toBeTruthy());
  sessionStorage.setToken.mockRejectedValueOnce(new Error('storage locked'));
  await act(async () => { await expect(session.login('synthetic-token')).rejects.toThrow('storage locked'); });
  expect(session.isAuthenticated).toBe(false);
  expect(authAPI.verifyToken).not.toHaveBeenCalled();
});

test('unauthorized notification immediately locks protected UI', async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('synthetic-payer')).toBeTruthy());
  act(() => notifySessionExpired());
  expect(view.getByText('signed out')).toBeTruthy();
  expect(session.authError).toContain('ended');
});

test('failed logout locks UI and retains a non-sensitive pending revocation marker', async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('synthetic-payer')).toBeTruthy());
  authAPI.logout.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await expect(session.logout()).rejects.toThrow('offline'); });
  expect(view.getByText('signed out')).toBeTruthy();
  expect(preferences.setItem).toHaveBeenCalledWith('sessionLogoutPending', 'true');
  expect(preferences.removeItem).not.toHaveBeenCalled();
  expect(sessionStorage.clearToken).toHaveBeenCalled();
});

test('pending logout after reload must be completed before cookie authentication', async () => {
  preferences.getItem.mockResolvedValue('true');
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('signed out')).toBeTruthy());
  expect(authAPI.logout).toHaveBeenCalledTimes(1);
  expect(authAPI.verifyToken).not.toHaveBeenCalled();
  expect(preferences.removeItem).toHaveBeenCalledWith('sessionLogoutPending');
});

test('unmount removes the native lifecycle listener', async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('synthetic-payer')).toBeTruthy());
  view.unmount();
  expect(removeAppStateListener).toHaveBeenCalledTimes(1);
});

test('resume preserves a verified payment navigation state during revalidation and temporary network loss', async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('synthetic-payer')).toBeTruthy());
  let rejectVerification;
  authAPI.verifyToken.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectVerification = reject; }));
  const resume = AppState.addEventListener.mock.calls.at(-1)[1];
  act(() => resume('active'));
  expect(session.isLoading).toBe(false);
  expect(session.isRevalidating).toBe(true);
  expect(view.getByText('synthetic-payer')).toBeTruthy();
  await waitFor(() => expect(typeof rejectVerification).toBe('function'));
  await act(async () => { rejectVerification(new Error('offline')); });
  expect(session.isAuthenticated).toBe(true);
  expect(session.authError).toContain('Reconnect');
  expect(session.isRevalidating).toBe(false);
});

test('a definitive revoked session on resume removes authenticated state', async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(view.getByText('synthetic-payer')).toBeTruthy());
  authAPI.verifyToken.mockRejectedValueOnce({ response: { status: 401 } });
  await act(async () => { await session.checkAuthStatus({ background: true }); });
  expect(view.getByText('signed out')).toBeTruthy();
  expect(session.isAuthenticated).toBe(false);
  expect(session.expiresAt).toBeNull();
});
