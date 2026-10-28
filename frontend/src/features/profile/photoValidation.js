export const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const formatError = 'Choose a valid PNG, JPEG or WebP photo.';

function inspectBase64(base64) {
  if (typeof base64 !== 'string' || !base64.length || base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error(formatError);
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const size = base64.length / 4 * 3 - padding;
  if (size > MAX_PROFILE_PHOTO_BYTES) throw new Error('Choose a photo no larger than 1 MB.');
  const finalValue = alphabet.indexOf(base64[base64.length - padding - 1]);
  if ((padding === 2 && finalValue % 16 !== 0) || (padding === 1 && finalValue % 4 !== 0)) throw new Error(formatError);
  const header = [];
  for (let i = 0; i < Math.min(base64.length, 16); i += 4) {
    const first = alphabet.indexOf(base64[i]);
    const second = alphabet.indexOf(base64[i + 1]);
    const third = alphabet.indexOf(base64[i + 2]);
    const fourth = alphabet.indexOf(base64[i + 3]);
    header.push((first << 2) | (second >> 4));
    if (third >= 0) header.push(((second & 15) << 4) | (third >> 2));
    if (fourth >= 0) header.push(((third & 3) << 6) | fourth);
  }
  const starts = bytes => bytes.every((value, index) => header[index] === value);
  const mimeType = starts([137, 80, 78, 71, 13, 10, 26, 10]) ? 'image/png'
    : starts([255, 216, 255]) ? 'image/jpeg'
      : starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((value, index) => header[index + 8] === value) ? 'image/webp' : null;
  if (!mimeType) throw new Error(formatError);
  return { mimeType, size };
}

export function photoDataUrlFromBase64(base64, declaredMimeType) {
  // Limit work before regex/header parsing. Never decode an unbounded image into memory.
  if (typeof base64 !== 'string') throw new Error(formatError);
  if (base64.length > Math.ceil(MAX_PROFILE_PHOTO_BYTES / 3) * 4) throw new Error('Choose a photo no larger than 1 MB.');
  const { mimeType } = inspectBase64(base64);
  if (declaredMimeType && (!PROFILE_PHOTO_TYPES.includes(declaredMimeType) || declaredMimeType !== mimeType)) throw new Error(formatError);
  return `data:${mimeType};base64,${base64}`;
}

export function validateProfilePhotoDataUrl(value) {
  if (typeof value !== 'string') throw new Error(formatError);
  if (value.length > Math.ceil(MAX_PROFILE_PHOTO_BYTES / 3) * 4 + 32) throw new Error('Choose a photo no larger than 1 MB.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error(formatError);
  return photoDataUrlFromBase64(match[2], match[1]);
}
