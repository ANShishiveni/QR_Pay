import { MAX_PROFILE_PHOTO_BYTES, PROFILE_PHOTO_TYPES, validateProfilePhotoDataUrl } from './photoValidation';

export async function readProfilePhotoFile(file) {
  if (!file || !PROFILE_PHOTO_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP photo.');
  if (!Number.isSafeInteger(file.size) || file.size < 1) throw new Error('This photo is empty or unreadable.');
  if (file.size > MAX_PROFILE_PHOTO_BYTES) throw new Error('Choose a photo no larger than 1 MB.');
  if (typeof FileReader === 'undefined') throw new Error('Photo import is unavailable in this browser.');
  const result = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finish(new Error('The photo took too long to open. Choose it again.'));
      reader.abort();
    }, 15000);
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      if (error) reject(error); else resolve(value);
    };
    reader.onload = () => finish(null, reader.result);
    reader.onerror = () => finish(new Error('We could not read this photo. Choose another image.'));
    reader.onabort = () => finish(new Error('Photo selection was interrupted. Choose it again.'));
    try { reader.readAsDataURL(file); }
    catch { finish(new Error('We could not read this photo. Choose another image.')); }
  });
  const validated = validateProfilePhotoDataUrl(result);
  if (!validated.startsWith(`data:${file.type};`)) throw new Error('The photo format does not match its file type. Choose another image.');
  return validated;
}
