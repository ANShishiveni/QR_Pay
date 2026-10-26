import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppButton, AppText, AppTextField, ConfirmBottomSheet, EmptyState, ErrorState, LoadingSkeleton,
  MaskedCard, OfflineBanner, PaymentResult, ReceiptView, RequestCountdown } from '..';
import { lightColors } from '../../../styles/theme';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

test('busy buttons announce their state and block duplicate interaction', () => {
  const onPress = jest.fn();
  const view = render(<AppButton title="Confirm simulation" loading onPress={onPress} />);
  const button = view.getByRole('button', { name: 'Confirm simulation' });
  expect(button).toBeDisabled();
  expect(button.props.accessibilityState.busy).toBe(true);
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  view.rerender(<AppButton title="Confirm simulation" onPress={onPress} />);
  fireEvent.press(view.getByRole('button', { name: 'Confirm simulation' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('text resolves semantic tokens and fields expose their validation to assistive technology', () => {
  const view = render(<><AppText color="textSecondary">Secondary copy</AppText><AppTextField label="Reference" error="Use 80 characters or fewer." /></>);
  expect(StyleSheet.flatten(view.getByText('Secondary copy').props.style).color).toBe(lightColors.textSecondary);
  expect(view.getByLabelText('Reference').props.accessibilityHint).toBe('Use 80 characters or fewer.');
  expect(view.getByRole('alert')).toHaveTextContent('Use 80 characters or fewer.');
});

test('test instruments display only a masked suffix even when legacy sensitive fields are present', () => {
  const view = render(<MaskedCard card={{ last4: '4242', brand: 'Demo', isDefault: true, cardNumber: '4111111111111111', cvv: '987' }} onPress={jest.fn()} />);
  expect(view.getByText('••••  ••••  ••••  4242')).toBeTruthy();
  expect(view.getByText('TEST INSTRUMENT')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Demo test instrument ending 4242, default' })).toBeTruthy();
  expect(view.queryByText(/4111111111111111|987/)).toBeNull();
});

test('missing receipt data cannot claim completion or fabricate an amount', () => {
  const view = render(<ReceiptView />);
  expect(view.getByText('Amount unavailable')).toBeTruthy();
  expect(view.getByText('Status unavailable')).toBeTruthy();
  expect(view.queryByText('Completed')).toBeNull();
  expect(view.getByText(/not proof of bank settlement/)).toBeTruthy();
});

test('receipts show integer cents and canonical identifiers with a simulation disclosure', () => {
  const view = render(<ReceiptView transaction={{ id: 'synthetic-txn', amountMinor: 12505, status: 'completed', payerName: 'Demo payer', requesterName: 'Demo receiver', completedAt: '2026-01-01T12:00:00Z' }} />);
  expect(view.getByText('N$125.05')).toBeTruthy();
  expect(view.getByText('synthetic-txn')).toBeTruthy();
  expect(view.getByText('Completed')).toBeTruthy();
  expect(view.getByText('No real funds transferred')).toBeTruthy();
});

test.each(['unknown', 'uncertain', 'processing'])('a %s payment result asks for reconciliation and never claims success', status => {
  const retry = jest.fn();
  const view = render(<PaymentResult status={status} amountMinor={100} onRetry={retry} onReceipt={jest.fn()} />);
  expect(view.getByText('Checking your payment')).toBeTruthy();
  expect(view.queryByText('Simulated payment completed')).toBeNull();
  expect(view.queryByRole('button', { name: 'View simulated receipt' })).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'Check status' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('empty, loading and network error states provide readable feedback and a recovery action', () => {
  const retry = jest.fn();
  const view = render(<><EmptyState title="No requests yet" /><LoadingSkeleton label="Loading requests" /><ErrorState onRetry={retry} /><OfflineBanner visible /></>);
  expect(view.getByText('No requests yet')).toBeTruthy();
  expect(view.getByRole('progressbar', { name: 'Loading requests' }).props.accessibilityState.busy).toBe(true);
  expect(view.getByRole('alert')).toHaveTextContent(/Reconnect to refresh the latest status/);
  fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

describe('request expiry uses server time and never authorizes payment', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-01-01T12:00:00Z')); });
  afterEach(() => jest.useRealTimers());

  test.each(['iso', 'milliseconds'])('accepts %s timestamps and notifies once on expiry', kind => {
    const expire = jest.fn();
    const server = Date.now() + 120000;
    const time = value => kind === 'iso' ? new Date(value).toISOString() : value;
    const view = render(<RequestCountdown serverTime={time(server)} expiresAt={time(server + 2000)} onExpire={expire} />);
    expect(view.getByText('Expires in 0:02')).toBeTruthy();
    expect(expire).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2000));
    expect(view.getByText('Request expired')).toBeTruthy();
    expect(expire).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(5000));
    expect(expire).toHaveBeenCalledTimes(1);
  });

  test('invalid expiry fails closed without describing it as a verified timestamp', () => {
    const expire = jest.fn();
    const view = render(<RequestCountdown expiresAt="not-a-time" onExpire={expire} />);
    expect(view.getByText('Expiry unavailable')).toBeTruthy();
    expect(expire).toHaveBeenCalledTimes(1);
  });
});

test('confirmation sheets prevent dismissal while a mutation is in progress', () => {
  const cancel = jest.fn();
  const confirm = jest.fn();
  const view = render(<ConfirmBottomSheet visible title="Remove test instrument?" confirmLabel="Remove" loading onCancel={cancel} onConfirm={confirm} />);
  expect(view.getByRole('header', { name: 'Remove test instrument?' })).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  fireEvent.press(view.getByRole('button', { name: 'Remove' }));
  expect(cancel).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});
