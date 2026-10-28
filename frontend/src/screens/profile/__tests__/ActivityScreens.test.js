import React from 'react';
import { AppState } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import TransactionsScreen from '../TransactionsScreen';
import TransactionDetailScreen from '../TransactionDetailScreen';
import { paymentAPI, userAPI } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';
import { shareReceipt } from '../../../services/receipts/shareReceipt';
jest.mock('../../../config/api', () => ({ userAPI: { getTransactions: jest.fn() }, paymentAPI: { getTransaction: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../services/receipts/shareReceipt', () => ({ shareReceipt: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const tx = { id: 'tx-1', userId: 'payer', payerUid: 'payer', requesterUid: 'recipient', amountMinor: 12345,
  currency: 'NAD', status: 'completed', simulated: true, payerName: 'Demo Payer', requesterName: 'Demo Recipient',
  reference: 'Lunch', timestamp: '2026-10-27T10:00:00.000Z', brand: 'Visa', last4: '4242', requestId: 'request-1' };
const page = (transactions = [tx], offset = 0, total = transactions.length) => ({ data: { transactions,
  pagination: { limit: 20, offset, total, hasMore: offset + 20 < total } } });
let navigation;
const press = (view, name) => fireEvent.press(view.getByRole('button', { name }));
const fill = (view, name, value) => fireEvent.changeText(view.getByLabelText(name), value);
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(() => {
  // VirtualizedList schedules batched cell updates. Keep those timers under
  // React's act boundary instead of allowing them to fire between assertions.
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}), isFocused: () => true };
  useAuth.mockReturnValue({ user: { uid: 'payer' } });
  userAPI.getTransactions.mockResolvedValue(page()); paymentAPI.getTransaction.mockResolvedValue({ data: { transaction: tx } });
  shareReceipt.mockResolvedValue({ action: 'saved' });
});
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers(); });
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('activity reads the authenticated server page and opens details with only the canonical ID', async () => {
  const view = render(<TransactionsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Demo Recipient')).toBeTruthy());
  expect(userAPI.getTransactions).toHaveBeenCalledWith({ limit: 20, offset: 0, type: 'all', status: 'all', search: '' });
  press(view, 'Sent N$123.45, Demo Recipient, completed');
  expect(navigation.navigate).toHaveBeenCalledWith('TransactionDetail', { transactionId: 'tx-1' });
});
test('direction, status, search and full Namibia calendar dates are sent to the server', async () => {
  const view = render(<TransactionsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Demo Recipient')).toBeTruthy());
  expect(view.getByRole('button', { name: 'All activity' }).props.accessibilityState.selected).toBe(true);
  expect(view.getByRole('button', { name: 'Date and status filters' }).props.accessibilityState.expanded).toBe(false);
  press(view, 'Sent');
  await waitFor(() => expect(userAPI.getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'sent', offset: 0 })));
  expect(view.getByRole('button', { name: 'Sent' }).props.accessibilityState.selected).toBe(true);
  expect(view.getByRole('button', { name: 'All activity' }).props.accessibilityState.selected).toBe(false);
  press(view, 'Date and status filters'); press(view, 'Status: completed');
  expect(view.getByRole('button', { name: 'Hide date and status filters' }).props.accessibilityState.expanded).toBe(true);
  fill(view, 'Search activity', ' Lunch '); fill(view, 'From date', '2026-10-27'); fill(view, 'To date', '2026-10-27');
  press(view, 'Apply search and dates');
  await waitFor(() => expect(userAPI.getTransactions).toHaveBeenLastCalledWith({ type: 'sent', status: 'completed', search: 'Lunch',
    from: '2026-10-26T22:00:00.000Z', to: '2026-10-27T21:59:59.999Z', limit: 20, offset: 0 }));
  press(view, 'Clear activity filters');
  await waitFor(() => expect(userAPI.getTransactions).toHaveBeenLastCalledWith({ type: 'all', status: 'all', search: '', limit: 20, offset: 0 }));
});
test('invalid dates fail inline before a query and preserve entered dates', async () => {
  const view = render(<TransactionsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Demo Recipient')).toBeTruthy());
  press(view, 'Date and status filters'); fill(view, 'From date', '2026-02-30'); press(view, 'Apply search and dates');
  expect(view.getByText('Enter a valid calendar date.')).toBeTruthy(); expect(userAPI.getTransactions).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText('From date').props.value).toBe('2026-02-30');
});
test('late initial responses cannot overwrite a newer direction filter', async () => {
  const old = deferred(); userAPI.getTransactions.mockImplementationOnce(() => old.promise);
  userAPI.getTransactions.mockResolvedValue(page([{ ...tx, id: 'sent-new', requesterName: 'New filtered recipient' }]));
  const view = render(<TransactionsScreen navigation={navigation} />);
  press(view, 'Sent'); await waitFor(() => expect(view.getByText('New filtered recipient')).toBeTruthy());
  await act(async () => old.resolve(page([{ ...tx, requesterName: 'Stale old result' }])));
  expect(view.queryByText('Stale old result')).toBeNull(); expect(view.getByText('New filtered recipient')).toBeTruthy();
});
test('paging uses the next server offset and suppresses overlapping loads and duplicate IDs', async () => {
  const more = deferred();
  userAPI.getTransactions.mockResolvedValueOnce(page([tx], 0, 21)).mockImplementationOnce(() => more.promise);
  const view = render(<TransactionsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Demo Recipient')).toBeTruthy());
  press(view, 'Load more activity'); press(view, 'Load more activity');
  expect(userAPI.getTransactions).toHaveBeenCalledTimes(2);
  expect(userAPI.getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 20 }));
  await act(async () => more.resolve(page([tx, { ...tx, id: 'tx-2', requesterName: 'Second recipient' }], 20, 21)));
  expect(view.getAllByText('Demo Recipient')).toHaveLength(1); expect(view.getByText('Second recipient')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Load more activity' })).toBeNull();
});
test('a late page from a previous filter never leaks into the new list', async () => {
  const more = deferred();
  userAPI.getTransactions.mockResolvedValueOnce(page([tx], 0, 21)).mockImplementationOnce(() => more.promise)
    .mockResolvedValueOnce(page([{ ...tx, id: 'received', payerUid: 'recipient', requesterUid: 'payer', payerName: 'Received from account' }]));
  const view = render(<TransactionsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Demo Recipient')).toBeTruthy()); press(view, 'Load more activity'); press(view, 'Received');
  await waitFor(() => expect(view.getByText('Received from account')).toBeTruthy());
  await act(async () => more.resolve(page([{ ...tx, id: 'stale', requesterName: 'Stale second page' }], 20, 21)));
  expect(view.queryByText('Stale second page')).toBeNull(); expect(view.queryByText('Demo Recipient')).toBeNull();
});
test('network errors are distinct from an empty history and offer explicit retry', async () => {
  userAPI.getTransactions.mockRejectedValueOnce(new Error('Connection unavailable')).mockResolvedValueOnce(page([]));
  const view = render(<TransactionsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Activity is unavailable')).toBeTruthy());
  expect(view.queryByText('Your activity starts here')).toBeNull(); press(view, 'Retry activity');
  await waitFor(() => expect(view.getByText('Your activity starts here')).toBeTruthy());
});
test('detail fetches and validates canonical identity before showing or sharing a receipt', async () => {
  paymentAPI.getTransaction.mockResolvedValue({ data: { transaction: { ...tx, email: 'private@example.com', otp: '123456' } } });
  const view = render(<TransactionDetailScreen route={{ params: { transactionId: tx.id, transaction: { ...tx, amountMinor: 1 } } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Visa test instrument ending 4242')).toBeTruthy());
  expect(paymentAPI.getTransaction).toHaveBeenCalledWith(tx.id); expect(view.getByLabelText('N$123.45')).toBeTruthy();
  press(view, 'View simulated receipt'); expect(view.getByText('SIMULATED RECEIPT')).toBeTruthy();
  press(view, 'Share simulated receipt'); await waitFor(() => expect(view.getByText('Simulated receipt downloaded.')).toBeTruthy());
  const shared = shareReceipt.mock.calls[0][0]; expect(shared.id).toBe(tx.id); expect(shared.email).toBeUndefined(); expect(shared.otp).toBeUndefined();
});
test('legacy owned direct transactions retain receipts without an invented request', async () => {
  paymentAPI.getTransaction.mockResolvedValue({ data: { transaction: { ...tx, payerUid: null, requesterUid: null, requestId: null, type: 'receive', status: 'succeeded' } } });
  const view = render(<TransactionDetailScreen route={{ params: { transactionId: tx.id } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Historical simulation')).toBeTruthy()); press(view, 'Share simulated receipt');
  await waitFor(() => expect(shareReceipt).toHaveBeenCalledTimes(1)); expect(shareReceipt.mock.calls[0][0]).toMatchObject({ legacy: true, requestId: null, role: 'received' });
});
test.each([null, { ...tx, payerUid: 'other' }, { ...tx, id: 'different' }])('unavailable or mismatched detail never exposes share controls', async transaction => {
  if (transaction) paymentAPI.getTransaction.mockResolvedValue({ data: { transaction } });
  else paymentAPI.getTransaction.mockRejectedValue({ response: { status: 404 } });
  const view = render(<TransactionDetailScreen route={{ params: { transactionId: tx.id } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Transaction unavailable')).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Share simulated receipt' })).toBeNull(); expect(shareReceipt).not.toHaveBeenCalled();
});
test('changing detail IDs ignores the first request if it arrives after the second', async () => {
  const old = deferred(); paymentAPI.getTransaction.mockImplementationOnce(() => old.promise)
    .mockResolvedValueOnce({ data: { transaction: { ...tx, id: 'tx-2', reference: 'New reference' } } });
  const view = render(<TransactionDetailScreen route={{ params: { transactionId: tx.id } }} navigation={navigation} />);
  view.rerender(<TransactionDetailScreen route={{ params: { transactionId: 'tx-2' } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByText('New reference')).toBeTruthy());
  await act(async () => old.resolve({ data: { transaction: { ...tx, reference: 'Stale reference' } } }));
  expect(view.queryByText('Stale reference')).toBeNull(); expect(view.getByText('New reference')).toBeTruthy();
});
test('failed export leaves the verified receipt available for a retry', async () => {
  shareReceipt.mockRejectedValueOnce(new Error('Sharing unavailable'));
  const view = render(<TransactionDetailScreen route={{ params: { transactionId: tx.id } }} navigation={navigation} />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Share simulated receipt' })).toBeTruthy()); press(view, 'Share simulated receipt');
  await waitFor(() => expect(view.getByText('Sharing unavailable')).toBeTruthy()); expect(view.getByText('Visa test instrument ending 4242')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Share simulated receipt' })).toBeEnabled();
});
