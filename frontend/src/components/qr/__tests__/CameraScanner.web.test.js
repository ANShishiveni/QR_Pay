import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import jsQR from 'jsqr';
import CameraScanner from '../CameraScanner.web';

jest.mock('jsqr', () => jest.fn());
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const originals = Object.fromEntries(['document', 'navigator'].map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
let track;
let source;
let frame;
let getUserMedia;
let pixels;
const camera = props => render(<CameraScanner {...props} />, { createNodeMock: element => element.type === 'video' ? frame : null });

beforeEach(() => {
  jest.clearAllMocks();
  track = { stop: jest.fn(), getCapabilities: jest.fn(() => ({ torch: false })), applyConstraints: jest.fn().mockResolvedValue(undefined) };
  source = { getTracks: () => [track], getVideoTracks: () => [track] };
  frame = { play: jest.fn().mockResolvedValue(undefined), srcObject: null, readyState: 2, videoWidth: 1920, videoHeight: 1080 };
  getUserMedia = jest.fn().mockResolvedValue(source);
  pixels = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
  const canvas = { getContext: () => ({ drawImage: jest.fn(), getImageData: () => pixels }) };
  Object.defineProperty(global, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } });
  Object.defineProperty(global, 'document', { configurable: true, value: { createElement: jest.fn(() => canvas) } });
  jsQR.mockReturnValue(null);
});
afterAll(() => {
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(global, name, descriptor);
    else delete global[name];
  }
});

test('web camera uses local bundled decoding, requests no microphone, and releases tracks on unmount', async () => {
  jsQR.mockReturnValue({ data: 'synthetic-signed-request' });
  const onRead = jest.fn();
  const view = camera({ onRead, onError: jest.fn() });
  await waitFor(() => expect(onRead).toHaveBeenCalledWith('synthetic-signed-request'));
  expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  expect(jsQR).toHaveBeenCalledWith(pixels.data, 1, 1, { inversionAttempts: 'attemptBoth' });
  expect(document.createElement).toHaveBeenCalledWith('canvas');
  expect(view.queryByRole('button', { name: 'Turn light on' })).toBeNull();
  view.unmount();
  expect(track.stop).toHaveBeenCalledTimes(1);
});

test('a camera permission response arriving after navigation releases the stream without decoding', async () => {
  let resolve;
  getUserMedia.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const onRead = jest.fn();
  const onError = jest.fn();
  const view = camera({ onRead, onError });
  view.unmount();
  await act(async () => resolve(source));
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(onRead).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(jsQR).not.toHaveBeenCalled();
});

test('denied web camera access reports a safe permission state for the gallery fallback', async () => {
  getUserMedia.mockRejectedValueOnce({ name: 'NotAllowedError', message: 'private browser/device detail' });
  const onError = jest.fn();
  camera({ onRead: jest.fn(), onError });
  await waitFor(() => expect(onError).toHaveBeenCalledWith({ kind: 'permission', canAskAgain: true }));
  expect(jsQR).not.toHaveBeenCalled();
});

test('torch appears only when the active track declares support', async () => {
  track.getCapabilities.mockReturnValue({ torch: true });
  const view = camera({ onRead: jest.fn(), onError: jest.fn() });
  await waitFor(() => expect(view.getByRole('button', { name: 'Turn light on' })).toBeTruthy());
  fireEvent.press(view.getByRole('button', { name: 'Turn light on' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Turn light off' })).toBeTruthy());
  expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
  view.unmount();
  expect(track.stop).toHaveBeenCalledTimes(1);
});
