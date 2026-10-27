import { scanFromURLAsync } from 'expo-camera';
import * as FileSystem from 'expo-file-system';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 48 * 1024 * 1024;

/** Expo image picker supplies a local asset. Never accept a remote image URL. */
export async function decodeGalleryAsset(asset) {
  if (!asset || typeof asset.uri !== 'string' || !/^(file|content):\/\//i.test(asset.uri)
    || (asset.type && asset.type !== 'image')
    || (asset.mimeType && (!asset.mimeType.startsWith('image/') || asset.mimeType === 'image/svg+xml'))) {
    throw new Error('Choose a local image containing a NamPay QR code.');
  }
  if (Number.isFinite(asset.width) && Number.isFinite(asset.height) && (asset.width <= 0 || asset.height <= 0 || asset.width * asset.height > MAX_SOURCE_PIXELS)) {
    throw new Error('This image is too large or unreadable. Crop it to one QR code and try again.');
  }
  let size = asset.fileSize;
  if (size === undefined || size === null) {
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (!info.exists || info.isDirectory) throw new Error('Unreadable');
      size = info.size;
    } catch {
      throw new Error('We could not read this image. Choose another image and try again.');
    }
  }
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('This image is empty or unreadable. Choose another image.');
  if (size > MAX_FILE_BYTES) throw new Error('Choose an image smaller than 10 MB.');

  let codes;
  try { codes = await scanFromURLAsync(asset.uri, ['qr']); }
  catch { throw new Error('We could not read this image. Choose another image or use the camera.'); }
  if (!Array.isArray(codes) || codes.length === 0) throw new Error('No QR code was found. Choose a clear image containing one complete QR code.');
  if (codes.length > 1) throw new Error('More than one QR code was found. Crop the image to one payment request.');
  const data = codes[0]?.data;
  if (typeof data !== 'string' || !data.trim()) throw new Error('No QR code was found. Choose a clear image containing one complete QR code.');
  if (data.length > 16384) throw new Error('This QR code is too large. Choose a NamPay payment request.');
  return data;
}
