import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useIsFocused } from '@react-navigation/native';
import QRScanScreen from '../QRScanScreen';
import { qrAPI } from '../../../config/api';

jest.mock('../../../config/api', () => ({ qrAPI: { scanQR: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../components/qr/CameraScanner', () => {
  const React = require('react');
  const { View } = require('react-native');
  return props => React.createElement(View, { ...props, testID: 'camera-preview' });
});
jest.mock('../../../components/qr/GalleryPicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return props => React.createElement(View, { ...props, testID: 'gallery-picker' });
});

const raw = JSON.stringify({ type: 'payment_request', token: 'synthetic-request', signature: 'a'.repeat(64), expiresAt: '2026-01-01T12:00:00.000Z' });
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
let stateChanged;
let removeListener;
const press = (view, name) => fireEvent.press(view.getByRole('button', { name }));
const gallery = (view, read = () => Promise.resolve(raw)) => act(() => { view.getByTestId('gallery-picker').props.onPick(read); });

beforeEach(() => {
  jest.clearAllMocks();
  useIsFocused.mockReturnValue(true);
  AppState.currentState = 'active';
  removeListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => { stateChanged = listener; return { remove: removeListener }; });
  qrAPI.scanQR.mockResolvedValue({ data: { paymentRequest: { id: 'verified-request', amountMinor: 25000 } } });
});
afterEach(() => jest.restoreAllMocks());

test('camera access starts only after intent, and gallery stays available before permission', () => {
  const view = render(<QRScanScreen navigation={navigation} />);
  expect(view.queryByTestId('camera-preview')).toBeNull();
  expect(view.getByTestId('gallery-picker').props.disabled).toBe(false);
  expect(qrAPI.scanQR).not.toHaveBeenCalled();
  press(view, 'Start camera');
  expect(view.getByTestId('camera-preview')).toBeTruthy();
  press(view, 'Pause camera');
  expect(view.queryByTestId('camera-preview')).toBeNull();
});

test('camera locks synchronously and navigates with only the verified request ID', async () => {
  let resolve;
  qrAPI.scanQR.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = render(<QRScanScreen navigation={navigation} />);
  press(view, 'Start camera');
  const onRead = view.getByTestId('camera-preview').props.onRead;
  act(() => { onRead(raw); onRead(raw); });
  await waitFor(() => expect(qrAPI.scanQR).toHaveBeenCalledTimes(1));
  expect(view.queryByTestId('camera-preview')).toBeNull();
  expect(view.getByTestId('gallery-picker').props.disabled).toBe(true);
  await act(async () => resolve({ data: { paymentRequest: { id: 'verified-request', requesterName: 'Server recipient', amountMinor: 25000 } } }));
  expect(navigation.navigate).toHaveBeenCalledWith('PaymentConfirm', { requestId: 'verified-request' });
  act(() => { onRead(raw); });
  expect(qrAPI.scanQR).toHaveBeenCalledTimes(1);
});

test('gallery uses the same signed scan endpoint before review', async () => {
  const view = render(<QRScanScreen navigation={navigation} />);
  gallery(view);
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('PaymentConfirm', { requestId: 'verified-request' }));
  expect(qrAPI.scanQR).toHaveBeenCalledWith(raw);
  expect(view.queryByTestId('camera-preview')).toBeNull();
});

test('malformed QR content is rejected locally and a corrected image can be checked', async () => {
  const view = render(<QRScanScreen navigation={navigation} />);
  gallery(view, () => Promise.resolve('https://untrusted.example'));
  await waitFor(() => expect(view.getByText('This image does not contain a NamPay payment request.')).toBeTruthy());
  expect(qrAPI.scanQR).not.toHaveBeenCalled();
  expect(navigation.navigate).not.toHaveBeenCalled();
  gallery(view);
  await waitFor(() => expect(qrAPI.scanQR).toHaveBeenCalledTimes(1));
});

test.each([
  ['REQUEST_EXPIRED', 'This request has expired. Ask the recipient for a new QR code.'],
  ['REQUEST_COMPLETED', 'This request has already been paid. It cannot be paid again.'],
  ['SELF_PAYMENT', 'This is your own request. Scan a request from another demo account.'],
  ['INVALID_QR_SIGNATURE', 'We could not verify this QR code. Ask the recipient to share a new one.'],
])('server %s rejection cannot open payment review and leaves retry available', async (code, message) => {
  qrAPI.scanQR.mockRejectedValueOnce({ response: { data: { code } } });
  const view = render(<QRScanScreen navigation={navigation} />);
  gallery(view);
  await waitFor(() => expect(view.getByText(message)).toBeTruthy());
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(view.getByRole('button', { name: 'Try camera again' })).toBeEnabled();
  expect(view.getByTestId('gallery-picker').props.disabled).toBe(false);
});

test('camera denial has a recoverable explanation and gallery fallback', () => {
  const view = render(<QRScanScreen navigation={navigation} />);
  press(view, 'Start camera');
  fireEvent(view.getByTestId('camera-preview'), 'error', { kind: 'permission', canAskAgain: false });
  expect(view.queryByTestId('camera-preview')).toBeNull();
  expect(view.getByText(/Camera access is off/)).toBeTruthy();
  expect(view.getByTestId('gallery-picker').props.disabled).toBe(false);
});

test('backgrounding stops the camera and refocusing requires explicit restart', () => {
  const view = render(<QRScanScreen navigation={navigation} />);
  press(view, 'Start camera');
  act(() => stateChanged('background'));
  expect(view.queryByTestId('camera-preview')).toBeNull();
  expect(view.getByRole('button', { name: 'Start camera' })).toBeDisabled();
  act(() => stateChanged('active'));
  expect(view.queryByTestId('camera-preview')).toBeNull();
  press(view, 'Start camera');
  expect(view.getByTestId('camera-preview')).toBeTruthy();
  useIsFocused.mockReturnValue(false);
  view.rerender(<QRScanScreen navigation={navigation} />);
  expect(view.queryByTestId('camera-preview')).toBeNull();
  view.unmount();
  expect(removeListener).toHaveBeenCalledTimes(1);
});

test('an in-flight validation cannot navigate after leaving the scanner', async () => {
  let resolve;
  qrAPI.scanQR.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = render(<QRScanScreen navigation={navigation} />);
  gallery(view);
  await waitFor(() => expect(qrAPI.scanQR).toHaveBeenCalledTimes(1));
  useIsFocused.mockReturnValue(false);
  view.rerender(<QRScanScreen navigation={navigation} />);
  await act(async () => resolve({ data: { paymentRequest: { id: 'verified-request' } } }));
  expect(navigation.navigate).not.toHaveBeenCalled();
});

test('a cancelled image picker neither calls the server nor shows a failure', async () => {
  const view = render(<QRScanScreen navigation={navigation} />);
  gallery(view, () => Promise.resolve(null));
  await waitFor(() => expect(view.getByTestId('gallery-picker').props.disabled).toBe(false));
  expect(qrAPI.scanQR).not.toHaveBeenCalled();
  expect(view.queryByRole('alert')).toBeNull();
});
