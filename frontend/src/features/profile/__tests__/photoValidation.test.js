import { MAX_PROFILE_PHOTO_BYTES, photoDataUrlFromBase64, validateProfilePhotoDataUrl } from '../photoValidation';

const png = Buffer.from('89504e470d0a1a0a0000000049454e44ae426082', 'hex');
const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');
const webp = Buffer.from('5249464614000000574542505650382000000000', 'hex');
const dataUrl = (type, bytes) => `data:${type};base64,${bytes.toString('base64')}`;

test.each([['image/png', png], ['image/jpeg', jpeg], ['image/webp', webp]])('recognizes %s and preserves the bounded photo payload', (type, bytes) => {
  const value = dataUrl(type, bytes);
  expect(validateProfilePhotoDataUrl(value)).toBe(value);
  expect(photoDataUrlFromBase64(bytes.toString('base64'))).toBe(value);
});

test('rejects mismatched claimed MIME, SVG, remote URLs and malformed base64', () => {
  for (const value of [dataUrl('image/jpeg', png), dataUrl('image/png', jpeg), 'data:image/svg+xml;base64,PHN2Zz4=',
    'https://example.test/photo.png', 'data:image/png;base64,not valid', 'data:image/png;base64,AB==',
    'data:image/png;base64,AAAA====', 'data:image/png;base64,', null]) {
    expect(() => validateProfilePhotoDataUrl(value)).toThrow('Choose a valid PNG, JPEG or WebP photo.');
  }
});

test('accepts exactly one decoded MiB and rejects the next byte despite base64 rounding', () => {
  const exact = Buffer.alloc(MAX_PROFILE_PHOTO_BYTES);
  png.copy(exact);
  expect(validateProfilePhotoDataUrl(dataUrl('image/png', exact))).toBe(dataUrl('image/png', exact));
  const tooLarge = Buffer.alloc(MAX_PROFILE_PHOTO_BYTES + 1);
  png.copy(tooLarge);
  expect(() => validateProfilePhotoDataUrl(dataUrl('image/png', tooLarge))).toThrow('no larger than 1 MB');
});

test('header verification rejects arbitrary bytes labeled as a photo', () => {
  const value = dataUrl('image/png', Buffer.from('synthetic text that is not an image'));
  expect(() => validateProfilePhotoDataUrl(value)).toThrow('Choose a valid PNG, JPEG or WebP photo.');
});
