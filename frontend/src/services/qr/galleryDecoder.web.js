import jsQR from 'jsqr';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const MAX_SOURCE_PIXELS = 48 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/x-ms-bmp']);
const READ_ERROR = 'We could not read this image. Choose a clear PNG, JPEG or WebP image and try again.';

/** Decode a user-selected image locally. Images and decoded pixels never leave the device. */
export async function decodeGalleryFile(file) {
  if (!file || !IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a PNG, JPEG, WebP, GIF or BMP image. SVG files are not supported.');
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('This image is empty or unreadable. Choose another image.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose an image smaller than 10 MB.');
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Image import is not available in this browser. Try a supported browser or the camera.');
  }

  let objectURL;
  let image;
  let canvas;
  let loadTimer;
  try {
    objectURL = URL.createObjectURL(file);
    image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(READ_ERROR));
      loadTimer = setTimeout(() => reject(new Error(READ_ERROR)), 15000);
      image.src = objectURL;
    });
    clearTimeout(loadTimer);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width * height > MAX_SOURCE_PIXELS) {
      throw new Error('This image is too large or unreadable. Crop it to one QR code and try again.');
    }
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(READ_ERROR);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
    if (!code || typeof code.data !== 'string' || !code.data.trim()) throw new Error('No QR code was found. Choose a clear image containing one complete QR code.');
    if (code.data.length > 16384) throw new Error('This QR code is too large. Choose a NamPay payment request.');
    return code.data;
  } catch (error) {
    // Only our known messages are shown; browser errors can contain local file details.
    const safeMessages = [READ_ERROR, 'This image is too large or unreadable. Crop it to one QR code and try again.',
      'No QR code was found. Choose a clear image containing one complete QR code.', 'This QR code is too large. Choose a NamPay payment request.'];
    throw new Error(safeMessages.includes(error?.message) ? error.message : READ_ERROR);
  } finally {
    clearTimeout(loadTimer);
    if (image) { image.onload = null; image.onerror = null; image.src = ''; }
    if (canvas) { canvas.width = 1; canvas.height = 1; }
    if (objectURL) URL.revokeObjectURL(objectURL);
  }
}
