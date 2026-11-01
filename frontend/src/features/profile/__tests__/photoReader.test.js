import * as FileSystem from 'expo-file-system';
import { readProfilePhotoAsset } from '../photoReader';
import { readProfilePhotoFile } from '../photoReader.web';
import { MAX_PROFILE_PHOTO_BYTES } from '../photoValidation';

jest.mock('expo-file-system', () => ({ getInfoAsync: jest.fn(), readAsStringAsync: jest.fn() }));

const base64 = Buffer.from('89504e470d0a1a0a0000000049454e44ae426082', 'hex').toString('base64');
const photo = `data:image/png;base64,${base64}`;
const asset = { uri: 'file:///cache/synthetic-photo.png', type: 'image', mimeType: 'image/png', fileSize: 18 };
const file = { type: 'image/png', size: 18 };
const previousReader = Object.getOwnPropertyDescriptor(global, 'FileReader');
let reader;
let readResult;
let failRead;

beforeEach(() => {
  jest.clearAllMocks();
  readResult = photo;
  failRead = false;
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 18 });
  FileSystem.readAsStringAsync.mockResolvedValue(base64);
  Object.defineProperty(global, 'FileReader', { configurable: true, value: class {
    constructor() { reader = this; this.abort = jest.fn(); this.readAsDataURL = jest.fn(() => Promise.resolve().then(() => {
      if (failRead) this.onerror?.({ message: '/private/path must not leak' });
      else { this.result = readResult; this.onload?.(); }
    })); }
  } });
});
afterAll(() => {
  if (previousReader) Object.defineProperty(global, 'FileReader', previousReader);
  else delete global.FileReader;
});

test('native reads only a selected local asset after size validation and limits the read length', async () => {
  await expect(readProfilePhotoAsset(asset)).resolves.toBe(photo);
  expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(asset.uri, { encoding: 'base64', position: 0, length: MAX_PROFILE_PHOTO_BYTES + 1 });
});

test('native checks file size if picker metadata is absent', async () => {
  await expect(readProfilePhotoAsset({ ...asset, fileSize: undefined })).resolves.toBe(photo);
  expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(asset.uri);
});

test.each([
  [{ ...asset, uri: 'https://example.test/photo.png' }, /local PNG/],
  [{ ...asset, mimeType: 'image/svg+xml' }, /local PNG/],
  [{ ...asset, fileSize: MAX_PROFILE_PHOTO_BYTES + 1 }, /no larger than 1 MB/],
  [{ ...asset, fileSize: 0 }, /empty or unreadable/],
])('native rejects unsupported assets before reading bytes', async (input, message) => {
  await expect(readProfilePhotoAsset(input)).rejects.toThrow(message);
  expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
});

test('native rejects MIME spoofing after byte validation and hides filesystem errors', async () => {
  await expect(readProfilePhotoAsset({ ...asset, mimeType: 'image/jpeg' })).rejects.toThrow('valid PNG, JPEG or WebP');
  FileSystem.readAsStringAsync.mockRejectedValueOnce(new Error('file:///private/sensitive.png failed'));
  await expect(readProfilePhotoAsset(asset)).rejects.toThrow('We could not read this photo. Choose another image.');
});

test('web reads a selected photo as a data URL and cleans up reader callbacks', async () => {
  await expect(readProfilePhotoFile(file)).resolves.toBe(photo);
  expect(reader.readAsDataURL).toHaveBeenCalledWith(file);
  expect(reader.onload).toBeNull();
  expect(reader.onerror).toBeNull();
  expect(reader.onabort).toBeNull();
});

test('web checks size and MIME before allocating a reader', async () => {
  reader = undefined;
  await expect(readProfilePhotoFile({ ...file, size: MAX_PROFILE_PHOTO_BYTES + 1 })).rejects.toThrow('no larger than 1 MB');
  await expect(readProfilePhotoFile({ ...file, type: 'image/svg+xml' })).rejects.toThrow('Choose a PNG');
  expect(reader).toBeUndefined();
});

test('web rejects a mismatched MIME and masks browser read errors', async () => {
  await expect(readProfilePhotoFile({ ...file, type: 'image/jpeg' })).rejects.toThrow('does not match its file type');
  failRead = true;
  await expect(readProfilePhotoFile(file)).rejects.toThrow('We could not read this photo. Choose another image.');
  expect(reader.onload).toBeNull();
});
