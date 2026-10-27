import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { scanFromURLAsync } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { decodeGalleryFile } from '../galleryDecoder.web';
import { decodeGalleryAsset } from '../galleryDecoder.native';

jest.mock('jsqr', () => jest.fn());
jest.mock('expo-camera', () => ({ scanFromURLAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ getInfoAsync: jest.fn() }));

const rawQR = JSON.stringify({ type: 'payment_request', requestId: 'synthetic-request', signature: 'synthetic-signature' });
const selectedFile = { type: 'image/png', size: 4096 };
const localAsset = { uri: 'file:///cache/synthetic.png', type: 'image', mimeType: 'image/png', fileSize: 4096, width: 300, height: 300 };
const originalGlobals = Object.fromEntries(['document', 'Image', 'URL'].map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
let canvas;
let context;
let imageSize;
let failImage;

// Real QR pixel data proves the bundled decoder reads a QR without a remote service.
function qrPixels(data) {
  const qr = QRCode.create(data, { errorCorrectionLevel: 'M' });
  const scale = 6;
  const padding = 4;
  const width = (qr.modules.size + padding * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (!qr.modules.get(row, column)) continue;
      for (let y = 0; y < scale; y += 1) for (let x = 0; x < scale; x += 1) {
        const offset = (((row + padding) * scale + y) * width + (column + padding) * scale + x) * 4;
        pixels[offset] = 0; pixels[offset + 1] = 0; pixels[offset + 2] = 0;
      }
    }
  }
  return { data: pixels, width, height: width };
}

beforeEach(() => {
  jest.resetAllMocks();
  imageSize = { width: 300, height: 300 };
  failImage = false;
  context = { drawImage: jest.fn(), getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })) };
  canvas = { width: 0, height: 0, getContext: jest.fn(() => context) };
  Object.defineProperty(global, 'document', { configurable: true, value: { createElement: jest.fn(() => canvas) } });
  Object.defineProperty(global, 'URL', { configurable: true, value: { createObjectURL: jest.fn(() => 'blob:synthetic-image'), revokeObjectURL: jest.fn() } });
  Object.defineProperty(global, 'Image', { configurable: true, value: class {
    constructor() { this.naturalWidth = imageSize.width; this.naturalHeight = imageSize.height; }
    set src(value) { if (value) Promise.resolve().then(() => { if (failImage) this.onerror?.(); else this.onload?.(); }); }
  } });
  jsQR.mockReturnValue({ data: rawQR });
  scanFromURLAsync.mockResolvedValue([{ type: 'qr', data: rawQR }]);
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 4096 });
});

afterAll(() => {
  for (const [name, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(global, name, descriptor);
    else delete global[name];
  }
});

test('web decodes a real synthetic QR locally and releases its temporary URL and canvas', async () => {
  const pixels = qrPixels(rawQR);
  imageSize = { width: pixels.width, height: pixels.height };
  context.getImageData.mockReturnValue(pixels);
  jsQR.mockImplementation(jest.requireActual('jsqr'));
  await expect(decodeGalleryFile(selectedFile)).resolves.toBe(rawQR);
  expect(URL.createObjectURL).toHaveBeenCalledWith(selectedFile);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-image');
  expect(canvas.width * canvas.height).toBe(1);
  expect(scanFromURLAsync).not.toHaveBeenCalled();
});

test.each([
  [{ type: 'image/svg+xml', size: 4096 }, /SVG files are not supported/],
  [{ type: 'text/plain', size: 4096 }, /Choose a PNG/],
  [{ type: 'image/png', size: 0 }, /empty or unreadable/],
  [{ type: 'image/png', size: 10 * 1024 * 1024 + 1 }, /smaller than 10 MB/],
])('web rejects unsupported or unsafe input before decoding (%j)', async (file, message) => {
  await expect(decodeGalleryFile(file)).rejects.toThrow(message);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(jsQR).not.toHaveBeenCalled();
});

test('web bounds the decoding canvas to at most 2048 pixels per dimension', async () => {
  imageSize = { width: 4096, height: 2048 };
  await decodeGalleryFile(selectedFile);
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1024);
  expect(context.getImageData).toHaveBeenCalledWith(0, 0, 2048, 1024);
});

test('web distinguishes no QR from a valid decoded string and still releases the image URL', async () => {
  jsQR.mockReturnValue(null);
  await expect(decodeGalleryFile(selectedFile)).rejects.toThrow('No QR code was found');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-image');
});

test('web handles image load failure without leaking browser or local file details', async () => {
  failImage = true;
  await expect(decodeGalleryFile(selectedFile)).rejects.toThrow('We could not read this image');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-image');
  expect(jsQR).not.toHaveBeenCalled();
});

test('web handles a browser canvas failure with safe copy and cleanup', async () => {
  context.getImageData.mockImplementation(() => { throw new Error('Sensitive local file /private/image.png'); });
  await expect(decodeGalleryFile(selectedFile)).rejects.toThrow('We could not read this image');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-image');
});

test('native decodes a selected local asset using QR-only Expo image scanning', async () => {
  await expect(decodeGalleryAsset(localAsset)).resolves.toBe(rawQR);
  expect(scanFromURLAsync).toHaveBeenCalledWith(localAsset.uri, ['qr']);
});

test.each([
  [{ ...localAsset, uri: 'https://example.test/image.png' }, /Choose a local image/],
  [{ ...localAsset, type: 'video' }, /Choose a local image/],
  [{ ...localAsset, mimeType: 'image/svg+xml' }, /Choose a local image/],
  [{ ...localAsset, fileSize: 10 * 1024 * 1024 + 1 }, /smaller than 10 MB/],
])('native rejects remote or unsafe assets before invoking the decoder (%j)', async (asset, message) => {
  await expect(decodeGalleryAsset(asset)).rejects.toThrow(message);
  expect(scanFromURLAsync).not.toHaveBeenCalled();
});

test('native checks local file size when the picker does not provide it', async () => {
  FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: false, size: 12 * 1024 * 1024 });
  await expect(decodeGalleryAsset({ ...localAsset, fileSize: undefined })).rejects.toThrow('smaller than 10 MB');
  expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(localAsset.uri);
  expect(scanFromURLAsync).not.toHaveBeenCalled();
});

test('native rejects ambiguous image scans instead of picking a payment silently', async () => {
  scanFromURLAsync.mockResolvedValueOnce([{ data: rawQR }, { data: 'another-request' }]);
  await expect(decodeGalleryAsset(localAsset)).rejects.toThrow('More than one QR code was found');
});

test('native decoder failure never exposes a device file path', async () => {
  scanFromURLAsync.mockRejectedValueOnce(new Error('Failed to read file:///private/synthetic-image.png'));
  await expect(decodeGalleryAsset(localAsset)).rejects.toThrow('We could not read this image. Choose another image or use the camera.');
});
