// Client preflight only. Signatures, ownership, expiry and status are verified by /qr/scan.
export function prepareScanPayload(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('Choose a valid NamPay payment QR code.');
  let envelope;
  try { envelope = JSON.parse(value); } catch { throw new Error('This image does not contain a NamPay payment request.'); }
  if (!envelope || Array.isArray(envelope) || envelope.type !== 'payment_request' || typeof envelope.token !== 'string') {
    throw new Error('This QR code is not a NamPay payment request.');
  }
  return value;
}

export function scanErrorMessage(error) {
  const code = error?.response?.data?.code;
  const messages = {
    REQUEST_EXPIRED: 'This request has expired. Ask the recipient for a new QR code.',
    REQUEST_COMPLETED: 'This request has already been paid. It cannot be paid again.',
    REQUEST_UNAVAILABLE: 'This request is no longer available. Ask for a new QR code.',
    SELF_PAYMENT: 'This is your own request. Scan a request from another demo account.',
    INVALID_QR: 'This QR code is not a valid NamPay payment request.',
    INVALID_QR_SIGNATURE: 'We could not verify this QR code. Ask the recipient to share a new one.',
    REQUEST_NOT_FOUND: 'This request could not be found. Ask for a new QR code.',
  };
  if (messages[code]) return messages[code];
  if (error?.response?.status === 401) return 'Your session has ended. Sign in and scan the request again.';
  return 'We could not check this request. Check your connection and scan it again.';
}
