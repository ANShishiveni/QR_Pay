import { requestFilename, requestImage } from './requestUtils';

function imageFile(data) {
  const image = requestImage(data);
  const binary = atob(image.slice(image.indexOf(',') + 1));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new File([bytes], requestFilename(data.paymentRequest.id), { type: 'image/png' });
}
function download(file) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.name; anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return { action: 'downloaded' };
}
export async function shareRequestQr(data) {
  const file = imageFile(data);
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'NamPay demo request', text: 'Simulated payment request. No real funds are transferred.' });
      return { action: 'shared' };
    } catch (error) { if (error.name === 'AbortError') return { action: 'cancelled' }; throw new Error('Sharing did not complete. Try saving the QR image.'); }
  }
  return download(file);
}
export async function saveRequestQr(data) { return download(imageFile(data)); }
