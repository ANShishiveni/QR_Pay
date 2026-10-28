import React from 'react';
import { AppState, ScrollView } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import { paymentAPI, qrAPI, userAPI } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';

jest.mock('../../../config/api', () => ({
  userAPI: { getStats: jest.fn() },
  paymentAPI: { getPaymentHistory: jest.fn() },
  qrAPI: { getRequests: jest.fn() },
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const statsResponse = changes => ({ data: { stats: {
  totalSentMinor: 12345, totalReceivedMinor: 6789, totalTransactions: 2, currency: 'NAD', simulated: true, ...changes,
} } });
const transaction = changes => ({
  id: 'transaction-1', userId: 'viewer', payerUid: 'viewer', requesterUid: 'recipient',
  amountMinor: 1001, currency: 'NAD', simulated: true, status: 'completed',
  payerName: 'Demo Viewer', requesterName: 'Demo Recipient', timestamp: '2026-10-27T10:00:00.000Z', ...changes,
});
const activityResponse = (transactions = []) => ({ data: { transactions,
  pagination: { limit: 5, offset: 0, total: transactions.length, hasMore: transactions.length > 5 },
} });
const request = changes => ({
  id: 'request-1', requesterUid: 'viewer', amountMinor: 2101, currency: 'NAD', reference: 'Demo lunch',
  status: 'pending', createdAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString(), ...changes,
});
const requestsResponse = (requests = []) => ({ data: { requests, serverTime: new Date().toISOString() } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const press = (view, name) => fireEvent.press(view.getByRole('button', { name }));
const refresh = view => act(async () => view.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh());
let navigation, listeners, lifecycleListeners, removals;

beforeEach(() => {
  jest.clearAllMocks();
  listeners = { focus: [], blur: [] }; lifecycleListeners = []; removals = [];
  navigation = { navigate: jest.fn(), isFocused: () => true, addListener: jest.fn((name, callback) => {
    listeners[name].push(callback);
    const remove = jest.fn(); removals.push(remove); return remove;
  }) };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((name, callback) => {
    lifecycleListeners.push(callback);
    const remove = jest.fn(); removals.push(remove); return { remove };
  });
  useAuth.mockReturnValue({ user: { uid: 'viewer', firstName: '  Demo  ' } });
  userAPI.getStats.mockResolvedValue(statsResponse());
  paymentAPI.getPaymentHistory.mockResolvedValue(activityResponse());
  qrAPI.getRequests.mockResolvedValue(requestsResponse());
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('greeting and primary actions remain available while each server section loads', async () => {
  const stats = deferred(), activity = deferred(), requests = deferred();
  userAPI.getStats.mockReturnValueOnce(stats.promise);
  paymentAPI.getPaymentHistory.mockReturnValueOnce(activity.promise);
  qrAPI.getRequests.mockReturnValueOnce(requests.promise);
  const view = render(<HomeScreen navigation={navigation} />);
  expect(view.getByText('Hello, Demo.')).toBeTruthy();
  expect(view.getByText('DEMO · NO REAL MONEY')).toBeTruthy();
  for (const label of ['Loading simulated totals', 'Loading pending requests', 'Loading latest activity']) {
    expect(view.getByRole('progressbar', { name: label })).toBeTruthy();
  }
  for (const [label, route] of [['Scan to pay', 'QRScan'], ['Request a payment', 'QRGenerate'],
    ['View all requests', 'QRRequests'], ['View all activity', 'Transactions'], ['Manage test cards', 'Cards']]) {
    press(view, label); expect(navigation.navigate).toHaveBeenLastCalledWith(route);
  }
  await act(async () => {
    stats.resolve(statsResponse({ totalSentMinor: 0, totalReceivedMinor: 0, totalTransactions: 0 }));
    activity.resolve(activityResponse()); requests.resolve(requestsResponse());
  });
  expect(view.getByText('No pending requests')).toBeTruthy();
  expect(view.getByText('Your activity starts here')).toBeTruthy();
  expect(view.getByText('0 completed simulations · all time')).toBeTruthy();
  expect(view.queryByText(/balance/i)).toBeNull();
});

test('summaries use authoritative integer cents above the per-request cap and ignore display floats', async () => {
  userAPI.getStats.mockResolvedValue(statsResponse({ totalSentMinor: 1234567, totalReceivedMinor: 1, totalSent: 9000, totalReceived: 8000 }));
  const view = render(<HomeScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByLabelText('N$12,345.67')).toBeTruthy());
  expect(view.getByLabelText('N$0.01')).toBeTruthy();
  expect(view.queryByLabelText('N$9,000.00')).toBeNull();
  expect(view.queryByLabelText('N$8,000.00')).toBeNull();
  expect(view.queryByText('Totals unavailable')).toBeNull();
});

test.each([
  ['missing cents', { totalSentMinor: undefined, totalSent: 123.45 }],
  ['fractional cents', { totalSentMinor: 123.45 }],
  ['non-finite cents', { totalReceivedMinor: NaN }],
  ['negative total', { totalReceivedMinor: -1 }],
  ['unsafe integer', { totalSentMinor: Number.MAX_SAFE_INTEGER + 1 }],
  ['unsupported currency', { currency: 'USD' }],
])('malformed summary (%s) is unavailable without fabricating zero or using float fallback', async (_, changes) => {
  userAPI.getStats.mockResolvedValue(statsResponse(changes));
  const view = render(<HomeScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Totals unavailable')).toBeTruthy());
  expect(view.queryByLabelText('N$0.00')).toBeNull();
  expect(view.queryByText('Simulated sent')).toBeNull();
  expect(view.queryByText('Simulated received')).toBeNull();
});

test('a totals failure leaves successful requests and activity visible and retries only totals', async () => {
  userAPI.getStats.mockRejectedValueOnce(new Error('Offline'));
  qrAPI.getRequests.mockResolvedValue(requestsResponse([request()]));
  paymentAPI.getPaymentHistory.mockResolvedValue(activityResponse([transaction()]));
  const view = render(<HomeScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Totals unavailable')).toBeTruthy());
  expect(view.getByRole('button', { name: 'Request N$21.01, pending, Demo lunch' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Sent N$10.01, Demo Recipient, completed' })).toBeTruthy();
  press(view, 'Retry totals');
  await waitFor(() => expect(view.getByLabelText('N$123.45')).toBeTruthy());
  expect(userAPI.getStats).toHaveBeenCalledTimes(2);
  expect(qrAPI.getRequests).toHaveBeenCalledTimes(1);
  expect(paymentAPI.getPaymentHistory).toHaveBeenCalledTimes(1);
});

test('request and activity errors are distinct from empty states while valid totals remain visible', async () => {
  qrAPI.getRequests.mockRejectedValueOnce(new Error('Offline'));
  paymentAPI.getPaymentHistory.mockRejectedValueOnce(new Error('Offline'));
  const view = render(<HomeScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Activity unavailable')).toBeTruthy());
  expect(view.getByText('Requests unavailable')).toBeTruthy();
  expect(view.getByLabelText('N$123.45')).toBeTruthy();
  expect(view.queryByText('No pending requests')).toBeNull();
  expect(view.queryByText('Your activity starts here')).toBeNull();
  press(view, 'Retry requests'); press(view, 'Retry activity');
  await waitFor(() => expect(view.getByText('No pending requests')).toBeTruthy());
  expect(view.getByText('Your activity starts here')).toBeTruthy();
  expect(userAPI.getStats).toHaveBeenCalledTimes(1);
});

test('latest activity maps the correct counterparty and opens only a canonical transaction ID', async () => {
  paymentAPI.getPaymentHistory.mockResolvedValue(activityResponse([
    transaction(), transaction({ id: 'transaction-2', payerUid: 'other', requesterUid: 'viewer', payerName: 'Demo Sender', requesterName: 'Demo Viewer', amountMinor: 3333 }),
  ]));
  const view = render(<HomeScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Demo Sender')).toBeTruthy());
  expect(paymentAPI.getPaymentHistory).toHaveBeenCalledWith({ limit: 5, offset: 0 });
  press(view, 'Sent N$10.01, Demo Recipient, completed');
  expect(navigation.navigate).toHaveBeenLastCalledWith('TransactionDetail', { transactionId: 'transaction-1' });
  press(view, 'Received N$33.33, Demo Sender, completed');
  expect(navigation.navigate).toHaveBeenLastCalledWith('TransactionDetail', { transactionId: 'transaction-2' });
  expect(view.queryByText('Demo Viewer')).toBeNull();
});

test('pull refresh replaces the latest five rows and deduplicates repeated transaction IDs', async () => {
  const initial = Array.from({ length: 6 }, (_, index) => transaction({ id: `initial-${index}`, requesterName: `Original recipient ${index}` }));
  paymentAPI.getPaymentHistory.mockResolvedValueOnce(activityResponse(initial));
  const replacement = transaction({ id: 'new-transaction', requesterName: 'New recipient' });
  paymentAPI.getPaymentHistory.mockResolvedValue(activityResponse([replacement, replacement]));
  const view = render(<HomeScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Original recipient 4')).toBeTruthy());
  expect(view.queryByText('Original recipient 5')).toBeNull();
  await refresh(view);
  expect(view.getAllByText('New recipient')).toHaveLength(1);
  expect(view.queryByText('Original recipient 0')).toBeNull();
  for (const read of [userAPI.getStats, paymentAPI.getPaymentHistory, qrAPI.getRequests]) expect(read).toHaveBeenCalledTimes(2);
});

test('pending preview shows three requests and navigates by request ID', async () => {
  qrAPI.getRequests.mockResolvedValue(requestsResponse(Array.from({ length: 4 }, (_, index) => request({ id: `request-${index}`, reference: `Pending ${index}` }))));
  const view = render(<HomeScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Pending 2')).toBeTruthy());
  expect(view.queryByText('Pending 3')).toBeNull();
  expect(qrAPI.getRequests).toHaveBeenCalledWith({ status: 'pending' });
  press(view, 'Request N$21.01, pending, Pending 1');
  expect(navigation.navigate).toHaveBeenCalledWith('QRRequestDetails', { requestId: 'request-1' });
});

test('all sections refresh on focus and foreground resume without polling in background or leaking listeners', async () => {
  jest.useFakeTimers();
  const view = render(<HomeScreen navigation={navigation} />);
  await act(async () => {});
  const expectReadCount = count => {
    for (const read of [userAPI.getStats, paymentAPI.getPaymentHistory, qrAPI.getRequests]) expect(read).toHaveBeenCalledTimes(count);
  };
  expectReadCount(1);
  act(() => lifecycleListeners.forEach(callback => callback('background')));
  await act(async () => { jest.advanceTimersByTime(120000); });
  expectReadCount(1);
  await act(async () => lifecycleListeners.forEach(callback => callback('active')));
  expectReadCount(2);
  act(() => listeners.blur.forEach(callback => callback()));
  await act(async () => { jest.advanceTimersByTime(60000); });
  expectReadCount(2);
  await act(async () => listeners.focus.forEach(callback => callback()));
  expectReadCount(3);
  view.unmount();
  expect(removals).toHaveLength(9);
  for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(60000); });
  expectReadCount(3);
});
