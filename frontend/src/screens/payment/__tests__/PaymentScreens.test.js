import React from 'react';
import { AppState, Share } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import PaymentConfirmScreen from '../PaymentConfirmScreen';
import PaymentResultScreen from '../PaymentResultScreen';
import OTPVerificationScreen from '../../auth/OTPVerificationScreen';
import { otpAPI, paymentAPI, qrAPI } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';

jest.mock('../../../config/api', () => ({
  qrAPI: { getRequest: jest.fn(), confirmPayment: jest.fn() },
  paymentAPI: { getCards: jest.fn(), getTransaction: jest.fn() },
  otpAPI: { sendOTP: jest.fn(), verifyOTP: jest.fn(), resendOTP: jest.fn(), getOTPStatus: jest.fn() },
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'stable-random-operation' }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const time = Date.now();
const request = { id: 'request-1', requesterUid: 'recipient', requesterName: 'Demo Recipient', amountMinor: 12345,
  reference: 'Lunch', currency: 'NAD', status: 'pending', expiresAt: new Date(time + 300000).toISOString(), simulated: true };
const card = { id: 'card-1', ownerUid: 'payer', testCardId: 'demo-visa', brand: 'Visa', last4: '4242', expMonth: 12, expYear: new Date().getUTCFullYear() + 2, simulated: true, isDefault: true };
const transaction = { id: 'transaction-1', requestId: request.id, payerUid: 'payer', requesterUid: 'recipient', amountMinor: 12345,
  payerName: 'Demo Payer', requesterName: 'Demo Recipient', methodLabel: 'Visa ending 4242', completedAt: new Date(time).toISOString(),
  reference: 'Lunch', currency: 'NAD', status: 'completed', simulated: true };
const response = (paymentRequest = request, tx) => ({ data: { paymentRequest, serverTime: new Date(time).toISOString(), transaction: tx } });
const session = { success: true, sessionId: 'session-1', provider: 'mock', expiresAt: request.expiresAt, resendAt: new Date(time + 60000).toISOString() };
let navigation;
let listeners;
const press = (view, label) => fireEvent.press(view.getByRole('button', { name: label }));
const otpRoute = { params: { requestId: request.id, cardId: card.id, idempotencyKey: 'original-confirmation-key' } };
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  listeners = {};
  navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), addListener: jest.fn((name, fn) => { listeners[name] = fn; return () => {}; }) };
  useAuth.mockReturnValue({ user: { uid: 'payer' } });
  qrAPI.getRequest.mockResolvedValue(response());
  paymentAPI.getCards.mockResolvedValue({ data: { cards: [card] } });
  paymentAPI.getTransaction.mockResolvedValue({ data: { transaction } });
  otpAPI.sendOTP.mockResolvedValue({ data: session });
  otpAPI.verifyOTP.mockResolvedValue({ data: { success: true, sessionId: session.sessionId, requestId: request.id, status: 'verified' } });
  qrAPI.confirmPayment.mockResolvedValue({ data: { transaction } });
});
afterEach(() => { jest.restoreAllMocks(); });

test('review ignores forged navigation values, selects the default and forwards only server IDs', async () => {
  const view = render(<PaymentConfirmScreen route={{ params: { paymentRequest: { id: request.id, amountMinor: 1, requesterName: 'Forged name' }, receiverCard: { id: 'forged-card' } } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Demo Recipient')).toBeTruthy());
  expect(view.getByText('Total: N$123.45')).toBeTruthy(); expect(view.queryByText('Forged name')).toBeNull();
  expect(view.getByText('Selected test instrument')).toBeTruthy();
  press(view, 'Continue to verification'); press(view, 'Continue to verification');
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledTimes(1));
  expect(navigation.navigate).toHaveBeenCalledWith('OTPVerification', { requestId: request.id, cardId: card.id, idempotencyKey: 'stable-random-operation' });
});
test('review excludes unowned or legacy instruments and directs the user to card management', async () => {
  paymentAPI.getCards.mockResolvedValue({ data: { cards: [{ ...card, ownerUid: 'other' }, { ...card, id: 'legacy', testCardId: null }] } });
  const view = render(<PaymentConfirmScreen route={{ params: { requestId: request.id } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Add a test instrument')).toBeTruthy());
  expect(view.getByRole('button', { name: 'Continue to verification' })).toBeDisabled();
  press(view, 'Manage test instruments'); expect(navigation.navigate).toHaveBeenCalledWith('Cards');
});
test('a changed server amount requires another review before navigation', async () => {
  qrAPI.getRequest.mockResolvedValueOnce(response()).mockResolvedValue(response({ ...request, amountMinor: 20000 }));
  const view = render(<PaymentConfirmScreen route={{ params: { requestId: request.id } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Total: N$123.45')).toBeTruthy()); press(view, 'Continue to verification');
  await waitFor(() => expect(view.getByText('The request details changed. Review the updated details before continuing.')).toBeTruthy());
  expect(view.getByText('Total: N$200.00')).toBeTruthy(); expect(navigation.navigate).not.toHaveBeenCalled();
});
test('expiry uses server time even when device time is behind', async () => {
  qrAPI.getRequest.mockResolvedValue({ data: { paymentRequest: request, serverTime: new Date(time + 400000).toISOString() } });
  const view = render(<PaymentConfirmScreen route={{ params: { requestId: request.id } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Request unavailable')).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Continue to verification' })).toBeNull();
});
test('OTP requires explicit issuance, masks and clears code, and allows result replacement after completion', async () => {
  const view = render(<OTPVerificationScreen route={otpRoute} navigation={navigation} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Send verification code' })).toBeEnabled());
  expect(otpAPI.sendOTP).not.toHaveBeenCalled(); press(view, 'Send verification code');
  await waitFor(() => expect(view.getByLabelText('Payment verification code')).toBeTruthy());
  expect(view.getByLabelText('Payment verification code').props.secureTextEntry).toBe(true);
  expect(view.getByText('Use the six-digit code in your private local demo inbox. No SMS was sent. Ask your demo operator for the code.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Resend verification code' })).toBeDisabled();
  navigation.replace.mockImplementation(() => { const event = { preventDefault: jest.fn() }; listeners.beforeRemove(event); expect(event.preventDefault).not.toHaveBeenCalled(); });
  fireEvent.changeText(view.getByLabelText('Payment verification code'), '123456');
  press(view, 'Verify and confirm payment');
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('PaymentResult', { requestId: request.id, transactionId: transaction.id }));
  expect(otpAPI.verifyOTP).toHaveBeenCalledWith(session.sessionId, '123456');
  expect(qrAPI.confirmPayment).toHaveBeenCalledWith({ requestId: request.id, cardId: card.id, sessionId: session.sessionId, idempotencyKey: 'original-confirmation-key' });
});
test('wrong OTP preserves the challenge and remaining attempts without sending confirmation', async () => {
  otpAPI.verifyOTP.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Incorrect verification code', attemptsLeft: 4 } } });
  const view = render(<OTPVerificationScreen route={otpRoute} navigation={navigation} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Send verification code' })).toBeEnabled()); press(view, 'Send verification code');
  await waitFor(() => expect(view.getByLabelText('Payment verification code')).toBeTruthy());
  fireEvent.changeText(view.getByLabelText('Payment verification code'), '000000'); press(view, 'Verify and confirm payment');
  await waitFor(() => expect(view.getByText('Incorrect verification code')).toBeTruthy());
  expect(view.getByText('4 verification attempts remaining')).toBeTruthy(); expect(view.getByLabelText('Payment verification code').props.value).toBe('');
  expect(qrAPI.confirmPayment).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
});
test('uncertain confirmation exposes reconciliation, blocks leaving and never reports failure', async () => {
  qrAPI.confirmPayment.mockRejectedValueOnce(new Error('Connection interrupted'));
  const view = render(<OTPVerificationScreen route={otpRoute} navigation={navigation} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Send verification code' })).toBeEnabled()); press(view, 'Send verification code');
  await waitFor(() => expect(view.getByLabelText('Payment verification code')).toBeTruthy());
  fireEvent.changeText(view.getByLabelText('Payment verification code'), '123456'); press(view, 'Verify and confirm payment');
  await waitFor(() => expect(view.getByText('Checking your payment')).toBeTruthy());
  expect(view.queryByText('Payment not completed')).toBeNull(); expect(view.queryByLabelText('Payment verification code')).toBeNull();
  const event = { preventDefault: jest.fn() }; listeners.beforeRemove(event); expect(event.preventDefault).toHaveBeenCalled();
  qrAPI.getRequest.mockResolvedValue(response({ ...request, status: 'completed' }, transaction));
  press(view, 'Check payment status'); await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
  expect(qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
});
test('backgrounding clears entered OTP; foreground status check recovers the current challenge', async () => {
  const changes = []; const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((name, fn) => { changes.push(fn); return { remove: jest.fn() }; });
  const view = render(<OTPVerificationScreen route={otpRoute} navigation={navigation} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Send verification code' })).toBeEnabled()); press(view, 'Send verification code');
  await waitFor(() => expect(view.getByLabelText('Payment verification code')).toBeTruthy());
  fireEvent.changeText(view.getByLabelText('Payment verification code'), '123456');
  act(() => changes.forEach(fn => fn('background')));
  expect(view.getByLabelText('Payment verification code').props.value).toBe('');
  await act(async () => changes.forEach(fn => fn('active')));
  await waitFor(() => expect(view.getByRole('button', { name: 'Check payment status' })).toBeTruthy());
  expect(otpAPI.sendOTP).toHaveBeenCalledTimes(1); expect(qrAPI.confirmPayment).not.toHaveBeenCalled();
  view.unmount(); spy.mockRestore();
});
test('result ignores forged route success and reveals only an authorized server receipt', async () => {
  qrAPI.getRequest.mockResolvedValue(response({ ...request, status: 'completed' }, transaction));
  const view = render(<PaymentResultScreen route={{ params: { requestId: request.id, transactionId: transaction.id, amountMinor: 1, status: 'failed' } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Simulated payment completed')).toBeTruthy());
  press(view, 'View simulated receipt');
  expect(view.getByText('SIMULATED RECEIPT')).toBeTruthy(); expect(view.getByText(transaction.id)).toBeTruthy();
  expect(view.getByText('This receipt records a NamPay demonstration. It is not proof of bank settlement.')).toBeTruthy();
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  press(view, 'Share simulated receipt');
  await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('No real funds transferred. Not proof of bank settlement.') })));
  share.mockRestore();
});
test.each([undefined, { ...transaction, payerUid: 'other' }, { ...transaction, amountMinor: 1 }])('result never promotes an unavailable or mismatched receipt to success', async tx => {
  qrAPI.getRequest.mockResolvedValue(response({ ...request, status: 'completed' }, tx));
  const view = render(<PaymentResultScreen route={{ params: { requestId: request.id, status: 'completed', transaction } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Checking your payment')).toBeTruthy());
  expect(view.queryByText('Simulated payment completed')).toBeNull(); expect(view.queryByRole('button', { name: 'View simulated receipt' })).toBeNull();
  expect(view.getByRole('button', { name: 'Check payment status' })).toBeEnabled();
});
