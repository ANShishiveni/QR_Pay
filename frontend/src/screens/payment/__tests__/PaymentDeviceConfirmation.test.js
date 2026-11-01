import React from 'react';
import { AppState, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import PaymentConfirmScreen from '../PaymentConfirmScreen';
import { paymentAPI, qrAPI } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';
import biometricService from '../../../services/biometricService';
jest.mock('../../../config/api', () => ({ qrAPI: { getRequest: jest.fn() }, paymentAPI: { getCards: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../services/biometricService', () => ({ isBiometricEnabled: jest.fn(), checkAvailability: jest.fn(), authenticate: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'stable-device-confirmation-key' }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const now = Date.now();
const request = { id: 'request-1', requesterUid: 'recipient', requesterName: 'Demo Recipient', amountMinor: 500,
  reference: 'Lunch', currency: 'NAD', status: 'pending', expiresAt: new Date(now + 300000).toISOString(), simulated: true };
const card = { id: 'card-1', ownerUid: 'payer', testCardId: 'demo-visa', brand: 'Visa', last4: '4242', expMonth: 12, expYear: new Date().getUTCFullYear() + 2, simulated: true, isDefault: true };
const review = (overrides = {}, serverTime = now) => ({ data: { paymentRequest: { ...request, ...overrides }, serverTime: new Date(serverTime).toISOString() } });
const originalPlatform = Platform.OS;
let navigation;
const press = view => fireEvent.press(view.getByRole('button', { name: 'Continue to verification' }));
async function ready() {
  const view = render(<PaymentConfirmScreen route={{ params: { requestId: request.id } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Continue to verification' })).toBeEnabled());
  return view;
}
beforeEach(() => {
  jest.clearAllMocks(); Platform.OS = 'ios';
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };
  useAuth.mockReturnValue({ user: { uid: 'payer', preferences: { biometrics: true } } });
  qrAPI.getRequest.mockResolvedValue(review()); paymentAPI.getCards.mockResolvedValue({ data: { cards: [card] } });
  biometricService.isBiometricEnabled.mockResolvedValue(true);
  biometricService.checkAvailability.mockResolvedValue({ isAvailable: true, isEnrolled: true, canUseBiometrics: true });
  biometricService.authenticate.mockResolvedValue({ success: true });
});
afterEach(() => { Platform.OS = originalPlatform; jest.restoreAllMocks(); });

test('both preferences and enrolled native hardware enable one local prompt, followed by server review and OTP', async () => {
  let resolvePrompt; biometricService.authenticate.mockImplementationOnce(() => new Promise(resolve => { resolvePrompt = resolve; }));
  const view = await ready(); press(view); press(view);
  await waitFor(() => expect(biometricService.authenticate).toHaveBeenCalledTimes(1));
  expect(navigation.navigate).not.toHaveBeenCalled(); expect(qrAPI.getRequest).toHaveBeenCalledTimes(2);
  await act(async () => resolvePrompt({ success: true }));
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledTimes(1));
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(3);
  expect(navigation.navigate).toHaveBeenCalledWith('OTPVerification', { requestId: request.id, cardId: card.id, idempotencyKey: 'stable-device-confirmation-key' });
  expect(biometricService.authenticate).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: true }));
});
test('cancelled local confirmation stays on review and allows retry without authorizing payment', async () => {
  biometricService.authenticate.mockResolvedValueOnce({ success: false });
  const view = await ready(); press(view);
  await waitFor(() => expect(view.getByText('Device confirmation was cancelled or unsuccessful. You can stay here and try again. Server verification is still required.')).toBeTruthy());
  expect(navigation.navigate).not.toHaveBeenCalled(); expect(view.getByRole('button', { name: 'Continue to verification' })).toBeEnabled();
  press(view); await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('OTPVerification', expect.any(Object)));
});
test.each(['server', 'local'])('the %s preference being off skips native authentication but retains OTP', async preference => {
  if (preference === 'server') useAuth.mockReturnValue({ user: { uid: 'payer', preferences: { biometrics: false } } });
  else biometricService.isBiometricEnabled.mockResolvedValue(false);
  const view = await ready(); press(view);
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('OTPVerification', expect.any(Object)));
  expect(biometricService.authenticate).not.toHaveBeenCalled(); expect(biometricService.checkAvailability).not.toHaveBeenCalled();
});
test.each([{ isAvailable: false, isEnrolled: true }, { isAvailable: true, isEnrolled: false }])('unsupported/unenrolled device explains the optional fallback: %j', capability => {
  biometricService.checkAvailability.mockResolvedValue({ ...capability, canUseBiometrics: true });
  return ready().then(async view => {
    expect(view.getByText('An enrolled biometric is unavailable on this device. You can continue with server verification; device confirmation is optional.')).toBeTruthy();
    press(view); await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('OTPVerification', expect.any(Object)));
    expect(biometricService.authenticate).not.toHaveBeenCalled();
  });
});
test('web explains capability limits and never checks or invokes native authentication', async () => {
  Platform.OS = 'web'; const view = await ready();
  expect(view.getByText('Device confirmation is unavailable on the web. Continue with server verification to authorize this simulation.')).toBeTruthy();
  press(view); await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('OTPVerification', expect.any(Object)));
  expect(biometricService.isBiometricEnabled).not.toHaveBeenCalled(); expect(biometricService.authenticate).not.toHaveBeenCalled();
});
test('a request expiring during the native prompt cannot continue to OTP', async () => {
  biometricService.authenticate.mockImplementationOnce(async () => {
    qrAPI.getRequest.mockResolvedValue(review({ status: 'expired' }, now + 400000)); return { success: true };
  });
  const view = await ready(); press(view);
  await waitFor(() => expect(view.getByText('Request unavailable')).toBeTruthy());
  expect(navigation.navigate).not.toHaveBeenCalled(); expect(qrAPI.getRequest).toHaveBeenCalledTimes(3);
});
test('an instrument removed during the native prompt cannot continue to OTP', async () => {
  biometricService.authenticate.mockImplementationOnce(async () => { paymentAPI.getCards.mockResolvedValue({ data: { cards: [] } }); return { success: true }; });
  const view = await ready(); press(view);
  await waitFor(() => expect(view.getByText('Choose an available test instrument before continuing.')).toBeTruthy());
  expect(navigation.navigate).not.toHaveBeenCalled();
});
test('a changed amount after device confirmation requires a fresh review', async () => {
  biometricService.authenticate.mockImplementationOnce(async () => { qrAPI.getRequest.mockResolvedValue(review({ amountMinor: 600 })); return { success: true }; });
  const view = await ready(); press(view);
  await waitFor(() => expect(view.getByText('The request details changed. Review the updated details before continuing.')).toBeTruthy());
  expect(navigation.navigate).not.toHaveBeenCalled(); expect(view.getByText('Total: N$6.00')).toBeTruthy();
});
