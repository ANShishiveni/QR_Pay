import React from 'react';
import { AppState, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import QRGenerateScreen from '../QRGenerateScreen';
import QRRequestDetailsScreen from '../QRRequestDetailsScreen';
import QRRequestsScreen from '../QRRequestsScreen';
import PaymentsScreen from '../../payment/PaymentsScreen';
import { qrAPI } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';
import { shareRequestQr } from '../shareRequestQr';

jest.mock('../../../config/api', () => ({ qrAPI: { generateQR: jest.fn(), getRequest: jest.fn(), getRequests: jest.fn(), cancelRequest: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../shareRequestQr', () => ({ shareRequestQr: jest.fn(), saveRequestQr: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const makeRequest = (changes = {}) => ({ id: 'request-1', requesterUid: 'requester', amountMinor: 1001, currency: 'NAD', reference: 'Lunch', description: '',
  status: 'pending', createdAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString(), ...changes });
const response = (changes = {}) => ({ paymentRequest: makeRequest(changes), serverTime: new Date().toISOString(), qrCode: 'data:image/png;base64,aW1hZ2U=' });
let navigation, listeners, appStateCallback, removeListener;
const press = (view, label) => fireEvent.press(view.getByRole('button', { name: label }));
const details = () => render(<QRRequestDetailsScreen navigation={navigation} route={{ params: { requestId: 'request-1' } }} />);

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'web';
  listeners = {}; removeListener = jest.fn();
  navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), isFocused: () => true,
    addListener: jest.fn((name, callback) => { listeners[name] = callback; return jest.fn(); }) };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((name, callback) => { appStateCallback = callback; return { remove: removeListener }; });
  useAuth.mockReturnValue({ user: { uid: 'requester' } });
  qrAPI.generateQR.mockResolvedValue({ data: response() });
  qrAPI.getRequest.mockResolvedValue({ data: response() });
  qrAPI.getRequests.mockResolvedValue({ data: { requests: [], serverTime: new Date().toISOString() } });
  qrAPI.cancelRequest.mockResolvedValue({ data: response({ status: 'cancelled' }) });
  shareRequestQr.mockResolvedValue({ action: 'shared' });
});
afterEach(() => { jest.useRealTimers(); });

test.each(['0', '-1', '1.001', '1e3', 'Infinity', '10000.01'])('creation rejects invalid amount %s without a request', value => {
  const view = render(<QRGenerateScreen navigation={navigation} />);
  fireEvent.changeText(view.getByLabelText('Amount (NAD)'), value);
  press(view, 'Create QR request');
  expect(qrAPI.generateQR).not.toHaveBeenCalled();
});

test('creation uses exact minor units, optional reference and no receiver card requirement', async () => {
  const view = render(<QRGenerateScreen navigation={navigation} />);
  fireEvent.changeText(view.getByLabelText('Amount (NAD)'), '10.01');
  press(view, 'Create QR request');
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('QRRequestDetails', { requestId: 'request-1' }));
  expect(qrAPI.generateQR).toHaveBeenCalledWith({ amountMinor: 1001, currency: 'NAD', reference: '', description: '', expiresIn: 300 });
});

test('duplicate create taps cannot submit overlapping requests', async () => {
  let resolve;
  qrAPI.generateQR.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = render(<QRGenerateScreen navigation={navigation} />);
  fireEvent.changeText(view.getByLabelText('Amount (NAD)'), '10.01');
  press(view, 'Create QR request'); press(view, 'Create QR request');
  expect(qrAPI.generateQR).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ data: response() }));
});

test('creation timeout directs the user to existing requests instead of retrying a write', async () => {
  qrAPI.generateQR.mockRejectedValueOnce({ isNetworkError: true });
  const view = render(<QRGenerateScreen navigation={navigation} />);
  fireEvent.changeText(view.getByLabelText('Amount (NAD)'), '10.01'); press(view, 'Create QR request');
  await waitFor(() => expect(view.getByText('The connection ended before we could confirm creation. Check your requests before creating another one.')).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Create QR request' })).toBeNull();
  press(view, 'Check my requests');
  expect(navigation.replace).toHaveBeenCalledWith('QRRequests');
  expect(qrAPI.generateQR).toHaveBeenCalledTimes(1);
});

test('request detail displays server amount and signed QR only for its owner', async () => {
  const view = details();
  await waitFor(() => expect(view.getByTestId('request-qr-image')).toBeTruthy());
  expect(view.getByLabelText('N$10.01')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Cancel request' })).toBeEnabled();
  expect(qrAPI.getRequest).toHaveBeenCalledWith('request-1');
});

test('non-owner never receives QR sharing or cancellation controls from a route payload', async () => {
  useAuth.mockReturnValue({ user: { uid: 'payer' } });
  const view = details();
  await waitFor(() => expect(view.getByText('Requested amount')).toBeTruthy());
  expect(view.queryByTestId('request-qr-image')).toBeNull();
  expect(view.queryByRole('button', { name: 'Cancel request' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Share QR' })).toBeNull();
});

test('sharing rechecks status and does not export a request completed during review', async () => {
  const view = details();
  await waitFor(() => expect(view.getByTestId('request-qr-image')).toBeTruthy());
  qrAPI.getRequest.mockResolvedValueOnce({ data: { ...response({ status: 'completed' }), transaction: { id: 'transaction-1' } } });
  press(view, 'Share QR');
  await waitFor(() => expect(view.getByText('Simulated payment received')).toBeTruthy());
  expect(shareRequestQr).not.toHaveBeenCalled();
  expect(view.queryByTestId('request-qr-image')).toBeNull();
  press(view, 'View simulated receipt');
  expect(navigation.navigate).toHaveBeenCalledWith('PaymentResult', { requestId: 'request-1', transactionId: 'transaction-1' });
});

test('cancellation requires confirmation and regenerating creates a new request form', async () => {
  const view = details();
  await waitFor(() => expect(view.getByTestId('request-qr-image')).toBeTruthy());
  press(view, 'Cancel request');
  expect(qrAPI.cancelRequest).not.toHaveBeenCalled();
  press(view, 'Cancel this request');
  await waitFor(() => expect(view.getByText('Cancelled')).toBeTruthy());
  expect(qrAPI.cancelRequest).toHaveBeenCalledTimes(1);
  expect(qrAPI.cancelRequest).toHaveBeenCalledWith('request-1');
  expect(view.queryByTestId('request-qr-image')).toBeNull();
  press(view, 'Create a new request');
  expect(navigation.navigate).toHaveBeenCalledWith('QRGenerate', { prefill: { amountMinor: 1001, reference: 'Lunch', description: '' } });
  expect(qrAPI.generateQR).not.toHaveBeenCalled();
});

test('cancellation race refetches a completed outcome without claiming cancellation succeeded', async () => {
  const view = details();
  await waitFor(() => expect(view.getByTestId('request-qr-image')).toBeTruthy());
  qrAPI.cancelRequest.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Already completed' } } });
  qrAPI.getRequest.mockResolvedValueOnce({ data: response({ status: 'completed' }) });
  press(view, 'Cancel request'); press(view, 'Cancel this request');
  await waitFor(() => expect(view.getByText('Simulated payment received')).toBeTruthy());
  expect(view.queryByText('Cancelled')).toBeNull();
  expect(view.queryByTestId('request-qr-image')).toBeNull();
});

test('failed status refresh disables QR sharing without a false terminal state', async () => {
  const view = details();
  await waitFor(() => expect(view.getByTestId('request-qr-image')).toBeTruthy());
  qrAPI.getRequest.mockRejectedValueOnce(new Error('Offline'));
  press(view, 'Check status');
  await waitFor(() => expect(view.getByText('The current status could not be checked. Offline')).toBeTruthy());
  expect(view.getByText('Pending')).toBeTruthy();
  expect(view.queryByTestId('request-qr-image')).toBeNull();
  expect(view.queryByRole('button', { name: 'Share QR' })).toBeNull();
});

test('request list distinguishes unavailable from empty and filters canonical statuses', async () => {
  qrAPI.getRequests.mockRejectedValueOnce(new Error('Offline'));
  const view = render(<QRRequestsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Requests unavailable')).toBeTruthy());
  expect(view.queryByText('No requests yet')).toBeNull();
  qrAPI.getRequests.mockResolvedValueOnce({ data: { requests: [makeRequest(), makeRequest({ id: 'request-2', status: 'expired' })], serverTime: new Date().toISOString() } });
  press(view, 'Try again');
  await waitFor(() => expect(view.getByText('2 requests · latest first')).toBeTruthy());
  press(view, 'Filter requests: Expired');
  expect(view.getByText('1 request · latest first')).toBeTruthy();
  press(view, 'Request N$10.01, expired, Lunch');
  expect(navigation.navigate).toHaveBeenCalledWith('QRRequestDetails', { requestId: 'request-2' });
});

test('payments hub exposes request and scan actions without requiring a card', async () => {
  const view = render(<PaymentsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('No pending requests')).toBeTruthy());
  press(view, 'Request a payment'); press(view, 'Scan a QR code');
  expect(navigation.navigate.mock.calls).toEqual([['QRGenerate'], ['QRScan']]);
});

test('focused foreground polling stops in background and resumes on focus', async () => {
  jest.useFakeTimers();
  const view = details();
  await act(async () => {});
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(2);
  act(() => appStateCallback('background'));
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(2);
  await act(async () => appStateCallback('active'));
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(3);
  act(() => listeners.blur());
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(3);
  await act(async () => listeners.focus());
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(4);
  view.unmount(); expect(removeListener).toHaveBeenCalledTimes(1);
});

test('server-offset countdown refreshes expiry and hides the old QR', async () => {
  jest.useFakeTimers();
  const serverNow = Date.now() + 120000;
  const expiring = { ...response({ expiresAt: new Date(serverNow + 2000).toISOString() }), serverTime: new Date(serverNow).toISOString() };
  qrAPI.getRequest.mockResolvedValueOnce({ data: expiring }).mockResolvedValueOnce({ data: { ...expiring, paymentRequest: { ...expiring.paymentRequest, status: 'expired' }, serverTime: new Date(serverNow + 2500).toISOString() } });
  const view = details();
  await act(async () => {});
  expect(view.getByText('Expires in 0:02')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(2500); });
  expect(view.getByText('Expired')).toBeTruthy();
  expect(view.queryByTestId('request-qr-image')).toBeNull();
  expect(view.queryByRole('button', { name: 'Share QR' })).toBeNull();
  expect(qrAPI.getRequest).toHaveBeenCalledTimes(2);
});

test('a slow pending read cannot overwrite a newer cancellation response', async () => {
  const view = details();
  await waitFor(() => expect(view.getByTestId('request-qr-image')).toBeTruthy());
  let resolveRead;
  qrAPI.getRequest.mockImplementationOnce(() => new Promise(resolve => { resolveRead = resolve; }));
  press(view, 'Check status');
  await act(async () => {});
  press(view, 'Cancel request'); press(view, 'Cancel this request');
  await waitFor(() => expect(view.getByText('Cancelled')).toBeTruthy());
  await act(async () => resolveRead({ data: response() }));
  expect(view.getByText('Cancelled')).toBeTruthy();
  expect(view.queryByText('Pending')).toBeNull();
});

test('incomplete success response cannot trigger a second creation without checking requests', async () => {
  qrAPI.generateQR.mockResolvedValueOnce({ data: { paymentRequest: { id: 'request-1' } } });
  const view = render(<QRGenerateScreen navigation={navigation} />);
  fireEvent.changeText(view.getByLabelText('Amount (NAD)'), '10.01'); press(view, 'Create QR request');
  await waitFor(() => expect(view.getByRole('button', { name: 'Check my requests' })).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Create QR request' })).toBeNull();
  expect(navigation.replace).not.toHaveBeenCalled();
});
