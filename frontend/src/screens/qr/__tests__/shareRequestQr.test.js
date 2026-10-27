import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { shareRequestQr } from '../shareRequestQr';
import { requestImage, checkedRequestResponse } from '../requestUtils';

jest.mock('expo-file-system', () => ({ cacheDirectory: 'file:///private-cache/', EncodingType: { Base64: 'base64' }, writeAsStringAsync: jest.fn(), deleteAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
const data = { paymentRequest: { id: 'request-1' }, qrCode: 'data:image/png;base64,aW1hZ2U=' };
beforeEach(() => {
  jest.clearAllMocks(); Sharing.isAvailableAsync.mockResolvedValue(true); Sharing.shareAsync.mockResolvedValue(undefined);
  FileSystem.writeAsStringAsync.mockResolvedValue(undefined); FileSystem.deleteAsync.mockResolvedValue(undefined);
});

test('native sharing uses a private temporary PNG and cleans it without gallery permission', async () => {
  await expect(shareRequestQr(data)).resolves.toEqual({ action: 'shared' });
  const path = FileSystem.writeAsStringAsync.mock.calls[0][0];
  expect(path).toMatch(/^file:\/\/\/private-cache\/\d+-nampay-demo-request-request-1\.png$/);
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(path, 'aW1hZ2U=', { encoding: 'base64' });
  expect(Sharing.shareAsync).toHaveBeenCalledWith(path, expect.objectContaining({ mimeType: 'image/png', UTI: 'public.png' }));
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(path, { idempotent: true });
});

test('share failure still removes the temporary QR image', async () => {
  Sharing.shareAsync.mockRejectedValueOnce(new Error('share unavailable'));
  await expect(shareRequestQr(data)).rejects.toThrow('share unavailable');
  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
});

test('unavailable sharing does not write a file or request broad permissions', async () => {
  Sharing.isAvailableAsync.mockResolvedValueOnce(false);
  await expect(shareRequestQr(data)).rejects.toThrow('Sharing is unavailable');
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});

test.each(['https://untrusted.example/qr.png', 'data:image/svg+xml,<script>', 'data:image/png;base64,not valid!'])('remote or malformed QR image %s cannot be exported', qrCode => {
  expect(() => requestImage({ qrCode })).toThrow('QR image is unavailable');
});

test('incomplete server request cannot enable actions or fabricate an amount', () => {
  expect(() => checkedRequestResponse({ paymentRequest: { id: 'request-1', status: 'pending' } }, 'request-1')).toThrow('incomplete request');
});
