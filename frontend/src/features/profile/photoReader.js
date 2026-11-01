import * as FileSystem from 'expo-file-system';
import { MAX_PROFILE_PHOTO_BYTES, PROFILE_PHOTO_TYPES, photoDataUrlFromBase64 } from './photoValidation';

export async function readProfilePhotoAsset(asset) {
  if (!asset || typeof asset.uri !== 'string' || !/^(?:file|content):\/\//i.test(asset.uri) ||
      (asset.type && asset.type !== 'image') || (asset.mimeType && !PROFILE_PHOTO_TYPES.includes(asset.mimeType))) {
    throw new Error('Choose a local PNG, JPEG or WebP photo.');
  }
  let size = asset.fileSize;
  if (size === undefined || size === null) {
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (!info.exists || info.isDirectory) throw new Error('Unavailable');
      size = info.size;
    } catch { throw new Error('We could not read this photo. Choose another image.'); }
  }
  if (!Number.isSafeInteger(size) || size < 1) throw new Error('This photo is empty or unreadable.');
  if (size > MAX_PROFILE_PHOTO_BYTES) throw new Error('Choose a photo no larger than 1 MB.');
  let base64;
  try {
    base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64', position: 0, length: MAX_PROFILE_PHOTO_BYTES + 1 });
  } catch { throw new Error('We could not read this photo. Choose another image.'); }
  return photoDataUrlFromBase64(base64, asset.mimeType);
}
