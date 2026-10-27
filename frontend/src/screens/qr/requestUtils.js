export const REQUEST_STATUSES = ['pending', 'processing', 'completed', 'expired', 'cancelled', 'failed'];
export function checkedRequestResponse(data, requestId) {
  const request = data?.paymentRequest;
  if (!request || typeof request.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(request.id) || request.id !== requestId || !REQUEST_STATUSES.includes(request.status)
    || !Number.isSafeInteger(request.amountMinor) || request.amountMinor < 1 || request.amountMinor > 1000000
    || request.currency !== 'NAD' || !Number.isFinite(Date.parse(data.serverTime))
    || !Number.isFinite(Date.parse(request.expiresAt))) {
    throw new Error('The server returned an incomplete request. Refresh before continuing.');
  }
  return data;
}
export function checkedRequestList(data) {
  if (!Array.isArray(data?.requests) || !Number.isFinite(Date.parse(data.serverTime))) throw new Error('Your requests could not be read. Please refresh.');
  for (const request of data.requests) checkedRequestResponse({ paymentRequest: request, serverTime: data.serverTime }, request.id);
  return data;
}
export function requestPrefill(request) {
  return { amountMinor: request.amountMinor, reference: request.reference || '', description: request.description || '' };
}
export function requestImage(data) {
  const value = data?.qrCode;
  if (typeof value !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=\r\n]+$/.test(value) || value.length > 2000000) {
    throw new Error('The QR image is unavailable. Refresh this request and try again.');
  }
  return value;
}
export function requestFilename(requestId) {
  return `nampay-demo-request-${String(requestId).replace(/[^a-z0-9-]/gi, '').slice(0, 64)}.png`;
}
