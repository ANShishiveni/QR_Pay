import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { requestFilename, requestImage } from './requestUtils';

// A temporary private cache file and the system share sheet avoid broad gallery
// permissions. Saving to Files is offered by the destination apps on the device.
export async function shareRequestQr(data) {
  const image = requestImage(data);
  if (!(await Sharing.isAvailableAsync()) || !FileSystem.cacheDirectory) throw new Error('Sharing is unavailable on this device. Show the QR code on screen instead.');
  const path = `${FileSystem.cacheDirectory}${Date.now()}-${requestFilename(data.paymentRequest.id)}`;
  try {
    await FileSystem.writeAsStringAsync(path, image.slice(image.indexOf(',') + 1), { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(path, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share or save a demo payment request' });
    return { action: 'shared' };
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}
export const saveRequestQr = shareRequestQr;
