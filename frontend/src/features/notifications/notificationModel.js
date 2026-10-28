const EVENT_TYPES = new Set(['request_created', 'request_expired', 'payment_completed']);
const INBOX_ERROR = 'Your notifications could not be verified. Refresh and try again.';
const identifier = (value, max = 128) => typeof value === 'string' && value.length <= max && /^[A-Za-z0-9_-]+$/.test(value);
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10) ||
    Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  return date.toISOString();
}

// Notification bodies never become payment state. Keep only the fields needed
// for the inbox, ownership and a link to a separately authorized server read.
export function checkedNotifications(data, uid) {
  if (typeof uid !== 'string' || !uid || !Array.isArray(data?.notifications)) throw new Error(INBOX_ERROR);
  const seen = new Map();
  for (const value of data.notifications) {
    const createdAt = timestamp(value?.createdAt);
    const readAt = value?.readAt === null ? null : timestamp(value?.readAt);
    if (!identifier(value?.id, 180) || !identifier(value?.requestId) || value.recipientUid !== uid || !EVENT_TYPES.has(value.eventType) ||
      !createdAt || (value.readAt !== null && !readAt) || (value.simulated !== undefined && value.simulated !== true) ||
      (value.transactionId != null && !identifier(value.transactionId))) throw new Error(INBOX_ERROR);
    const item = { id: value.id, recipientUid: uid, eventType: value.eventType, requestId: value.requestId,
      createdAt, readAt, ...(value.simulated === true ? { simulated: true } : {}),
      ...(value.transactionId != null ? { transactionId: value.transactionId } : {}) };
    const previous = seen.get(item.id);
    if (previous) {
      if (previous.eventType !== item.eventType || previous.requestId !== item.requestId || previous.createdAt !== item.createdAt ||
        (previous.transactionId && item.transactionId && previous.transactionId !== item.transactionId)) throw new Error(INBOX_ERROR);
      const latestReadAt = previous.readAt && item.readAt ? (previous.readAt > item.readAt ? previous.readAt : item.readAt) : previous.readAt || item.readAt;
      seen.set(item.id, { ...previous,
        readAt: latestReadAt,
        ...(item.simulated === true ? { simulated: true } : {}),
        ...(item.transactionId ? { transactionId: item.transactionId } : {}),
      });
    } else seen.set(item.id, item);
  }
  return [...seen.values()].sort((left, right) => compare(right.createdAt, left.createdAt) || compare(left.id, right.id)).slice(0, 100);
}

export function notificationCopy(item) {
  if (item?.eventType === 'request_created') return { title: 'Request created', message: 'A QR request was created. Open it to check the latest status.' };
  if (item?.eventType === 'request_expired') return { title: 'Request expired', message: 'A QR request reached its expiry. Open it to review the server record.' };
  if (item?.eventType === 'payment_completed') return { title: 'Simulated payment update', message: 'A payment event was recorded. Open the details to verify its outcome. No real funds were transferred.' };
  return { title: 'Notification unavailable', message: 'Refresh your inbox to check this update.' };
}

export function notificationDestination(item) {
  if (!EVENT_TYPES.has(item?.eventType) || !identifier(item?.requestId)) return null;
  if (item.eventType === 'payment_completed') {
    return identifier(item.transactionId)
      ? { name: 'TransactionDetail', params: { transactionId: item.transactionId } }
      : { name: 'PaymentResult', params: { requestId: item.requestId } };
  }
  return { name: 'QRRequestDetails', params: { requestId: item.requestId } };
}
