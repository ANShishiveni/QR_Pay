// A receipt/list model is an explicit allowlist, never a spread of an API body.
const label = (value, fallback = '', max = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : fallback;
export function activityTransaction(value, uid, expectedId) {
  const id = value?.id || value?.transactionId;
  const canonical = Boolean(value?.payerUid && value?.requesterUid);
  const owned = canonical ? [value.payerUid, value.requesterUid].includes(uid) : value?.userId === uid;
  if (!uid || !id || (expectedId && id !== expectedId) || !owned || (value.userId && value.userId !== uid) ||
    value.simulated !== true || value.currency !== 'NAD' || !Number.isSafeInteger(value.amountMinor) || value.amountMinor < 1) {
    throw new Error('This transaction could not be verified for your account. Refresh and try again.');
  }
  const sent = canonical ? value.payerUid === uid : ['sent', 'send'].includes(value.role || value.type);
  const last4 = /^\d{4}$/.test(value.last4 || '') ? value.last4 : null;
  const brand = ['Visa', 'Mastercard'].includes(value.brand) ? value.brand : 'Demo';
  return {
    id, transactionId: id, requestId: typeof value.requestId === 'string' && value.requestId ? value.requestId : null,
    userId: uid, payerUid: canonical ? value.payerUid : null, requesterUid: canonical ? value.requesterUid : null,
    role: sent ? 'sent' : 'received', type: sent ? 'send' : 'receive', amountMinor: value.amountMinor, currency: 'NAD',
    status: label(value.status, 'unknown', 30), reference: label(value.reference, '', 80), description: label(value.description),
    payerName: label(value.payerName || value.senderName, 'Demo payer', 120),
    requesterName: label(value.requesterName || value.receiverName, 'Demo recipient', 120),
    timestamp: value.timestamp || value.completedAt || value.createdAt || '', completedAt: value.completedAt || null,
    createdAt: value.createdAt || value.timestamp || '', last4, brand, simulated: true, legacy: !canonical || value.legacy === true,
    methodLabel: last4 ? `${brand} test instrument ending ${last4}` : canonical ? 'Simulated test instrument' : 'Legacy simulated test instrument',
    counterpartyName: label(sent ? value.requesterName || value.receiverName : value.payerName || value.senderName, 'Demo account', 120),
  };
}

export const DEFAULT_ACTIVITY_FILTERS = Object.freeze({ type: 'all', status: 'all', search: '', fromDate: '', toDate: '' });
function localDate(value, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DD for dates.');
  const midnight = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== value) throw new Error('Enter a valid calendar date.');
  // Convert calendar midnight in Windhoek to UTC, including Namibia's historic
  // daylight-saving rules. End dates end at the next local midnight minus 1ms.
  const target = midnight.getTime() + (end ? 86400000 : 0);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Windhoek',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const correction = target - local;
    instant += correction;
    if (!correction) break;
  }
  return new Date(instant - (end ? 1 : 0)).toISOString();
}
export function activityQuery(filters) {
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) throw new Error('The start date must be on or before the end date.');
  return {
    type: filters.type || 'all', status: filters.status || 'all', search: String(filters.search || '').trim().slice(0, 120),
    ...(filters.fromDate ? { from: localDate(filters.fromDate) } : {}), ...(filters.toDate ? { to: localDate(filters.toDate, true) } : {}),
  };
}
export function checkedActivityPage(data, uid, offset, limit) {
  const page = data?.pagination;
  if (!Array.isArray(data?.transactions) || !page || page.offset !== offset || page.limit !== limit ||
    !Number.isSafeInteger(page.total) || page.total < 0 || typeof page.hasMore !== 'boolean') {
    throw new Error('The activity page is incomplete. Refresh your activity.');
  }
  return { transactions: data.transactions.map(value => activityTransaction(value, uid)), pagination: page };
}
export function mergeActivity(previous, incoming) {
  const seen = new Map(previous.map(value => [value.id, value]));
  for (const value of incoming) seen.set(value.id, value);
  return [...seen.values()];
}
