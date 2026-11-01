import React from 'react';
import { ScrollView } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';
import { useNotifications } from '../../../context/NotificationContext';

jest.mock('../../../context/NotificationContext', () => ({ useNotifications: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const notification = (changes = {}) => ({
  id: 'request_created_request-1', recipientUid: 'viewer', eventType: 'request_created', requestId: 'request-1',
  createdAt: '2026-10-28T12:00:00.000Z', readAt: null, simulated: true, ...changes,
});
let state, navigation, onFocus, removeListener;
const press = (view, name) => fireEvent.press(view.getByRole('button', { name }));
const screen = () => render(<NotificationsScreen navigation={navigation} />);
function update(view, changes) {
  state = { ...state, ...changes }; useNotifications.mockReturnValue(state);
  view.rerender(<NotificationsScreen navigation={navigation} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  removeListener = jest.fn();
  navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn((name, callback) => {
    if (name === 'focus') onFocus = callback;
    return removeListener;
  }) };
  state = { items: [], inboxUnreadCount: 0, unreadCount: 0, alertsEnabled: true, loading: false, refreshing: false,
    error: '', markError: '', readingIds: [], refresh: jest.fn().mockResolvedValue([]), markRead: jest.fn().mockResolvedValue(true) };
  useNotifications.mockReturnValue(state);
});

test('loading is an accessible busy state without an empty-inbox claim', () => {
  state.loading = true;
  const view = screen();
  expect(view.getByRole('progressbar', { name: 'Loading your inbox' })).toBeTruthy();
  expect(view.queryByText('You’re all caught up')).toBeNull();
  expect(view.getByText('DEMO · NO REAL MONEY')).toBeTruthy();
});

test('a checked empty inbox offers a safe refresh and no notification mutation', () => {
  const view = screen();
  expect(view.getByText('You’re all caught up')).toBeTruthy();
  expect(state.refresh).toHaveBeenCalledTimes(1);
  press(view, 'Refresh inbox');
  expect(state.refresh).toHaveBeenCalledTimes(2);
  expect(state.markRead).not.toHaveBeenCalled();
});

test('an initial read failure is unavailable rather than empty and supports retry', () => {
  state.error = 'Your inbox could not be refreshed. Reconnect and try again.';
  const view = screen();
  expect(view.getByText('Inbox unavailable')).toBeTruthy();
  expect(view.getByText(state.error)).toBeTruthy();
  expect(view.queryByText('You’re all caught up')).toBeNull();
  press(view, 'Refresh inbox');
  expect(state.refresh).toHaveBeenCalledTimes(2);
});

test('a refresh failure retains last-checked updates with an explicit stale warning', () => {
  state.items = [notification()]; state.inboxUnreadCount = 1;
  state.error = 'Your inbox could not be refreshed. Reconnect and try again.';
  const view = screen();
  expect(view.getByText(`${state.error} Showing your last checked updates.`)).toBeTruthy();
  expect(view.getByTestId('notification-request_created_request-1')).toBeTruthy();
  expect(view.getByText('1 unread update')).toBeTruthy();
  expect(view.queryByText('Inbox unavailable')).toBeNull();
  press(view, 'Retry connection');
  expect(state.refresh).toHaveBeenCalledTimes(2);
});

test('turning alerts off preserves inbox history and its actual unread count', () => {
  state.items = [notification(), notification({ id: 'request_expired_request-2', eventType: 'request_expired', requestId: 'request-2' })];
  state.inboxUnreadCount = 2; state.unreadCount = 0; state.alertsEnabled = false;
  const view = screen();
  expect(view.getByText('In-app alerts are off')).toBeTruthy();
  expect(view.getByText('2 unread updates')).toBeTruthy();
  expect(view.getAllByText('Unread')).toHaveLength(2);
  expect(view.getByRole('button', { name: 'Open request expired' })).toBeEnabled();
});

test('mark-read remains unread until provider confirmation and exposes busy state', () => {
  const item = notification(); state.items = [item]; state.inboxUnreadCount = 1;
  const view = screen();
  press(view, 'Mark request created as read');
  expect(state.markRead).toHaveBeenCalledWith(item.id);
  expect(view.getByText('Unread')).toBeTruthy();
  update(view, { readingIds: [item.id] });
  const busy = view.getByRole('button', { name: 'Mark request created as read' });
  expect(busy).toBeDisabled(); expect(busy.props.accessibilityState.busy).toBe(true);
  press(view, 'Mark request created as read');
  expect(state.markRead).toHaveBeenCalledTimes(1);
  update(view, { items: [{ ...item, readAt: '2026-10-28T12:30:00.000Z' }], readingIds: [], inboxUnreadCount: 0 });
  expect(view.getByText('Read')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Mark request created as read' })).toBeNull();
  expect(view.getByText('0 unread updates')).toBeTruthy();
});

test('unconfirmed read acknowledgement exposes retry feedback without hiding the update', () => {
  state.items = [notification()]; state.inboxUnreadCount = 1;
  state.markError = 'We couldn’t confirm that this update was marked as read. Refresh the inbox or try again.';
  const view = screen();
  expect(view.getByText(state.markError)).toBeTruthy();
  expect(view.getByText('Unread')).toBeTruthy();
  press(view, 'Mark request created as read');
  expect(state.markRead).toHaveBeenCalledWith('request_created_request-1');
  press(view, 'Refresh inbox');
  expect(state.refresh).toHaveBeenCalledTimes(2);
});

test.each([
  ['request_created', 'Open request created'],
  ['request_expired', 'Open request expired'],
])('%s navigates using only a request ID and acknowledges the event', (eventType, label) => {
  const item = notification({ eventType }); state.items = [item];
  const view = screen(); press(view, label);
  expect(state.markRead).toHaveBeenCalledWith(item.id);
  expect(navigation.navigate).toHaveBeenCalledWith('QRRequestDetails', { requestId: 'request-1' });
});

test('a payment event without a transaction ID opens a server-backed request result', () => {
  state.items = [notification({ eventType: 'payment_completed' })];
  const view = screen(); press(view, 'Open simulated payment update');
  expect(navigation.navigate).toHaveBeenCalledWith('PaymentResult', { requestId: 'request-1' });
  expect(view.getByText('A payment event was recorded. Open the details to verify its outcome. No real funds were transferred.')).toBeTruthy();
});

test('a payment event with a server transaction ID opens transaction details without trusting a payload', () => {
  state.items = [notification({ eventType: 'payment_completed', transactionId: 'transaction-1', amountMinor: 12345, status: 'completed' })];
  const view = screen(); press(view, 'Open simulated payment update');
  expect(navigation.navigate).toHaveBeenCalledWith('TransactionDetail', { transactionId: 'transaction-1' });
  expect(navigation.navigate.mock.calls[0][1]).not.toHaveProperty('amountMinor');
  expect(navigation.navigate.mock.calls[0][1]).not.toHaveProperty('status');
});

test('opening details never waits for the read acknowledgement to finish', async () => {
  let resolve;
  state.items = [notification()];
  state.markRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = screen(); press(view, 'Open request created');
  expect(navigation.navigate).toHaveBeenCalledWith('QRRequestDetails', { requestId: 'request-1' });
  await act(async () => { resolve(false); });
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
});

test('inbox copy ignores arbitrary PII, amount, status and notification body fields', () => {
  state.items = [notification({ eventType: 'payment_completed', amountMinor: 12345, body: 'Private account body',
    title: 'Forged title', phone: '+26400000000', recipientName: 'Private recipient', email: 'private@example.invalid', status: 'Paid for real' })];
  const view = screen();
  for (const text of ['Private account body', 'Forged title', '+26400000000', 'Private recipient', 'private@example.invalid', 'Paid for real', 'N$123.45']) {
    expect(view.queryByText(text)).toBeNull();
  }
  expect(view.getByText('Simulated payment update')).toBeTruthy();
  expect(view.getByText('Open an update to check its latest server record. An inbox message is not proof of payment or bank settlement.')).toBeTruthy();
});

test('refreshes on focus and pull gesture and removes its focus listener on unmount', async () => {
  const view = screen();
  expect(state.refresh).toHaveBeenCalledTimes(1);
  await act(async () => { await onFocus(); });
  expect(state.refresh).toHaveBeenCalledTimes(2);
  await act(async () => { await view.UNSAFE_getByType(ScrollView).props.refreshControl.props.onRefresh(); });
  expect(state.refresh).toHaveBeenCalledTimes(3);
  update(view, { refreshing: true });
  expect(view.UNSAFE_getByType(ScrollView).props.refreshControl.props.refreshing).toBe(true);
  press(view, 'Go back'); expect(navigation.goBack).toHaveBeenCalledTimes(1);
  view.unmount(); expect(removeListener).toHaveBeenCalledTimes(1);
});
