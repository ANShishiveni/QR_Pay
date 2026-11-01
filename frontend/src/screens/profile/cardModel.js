const allowedIds = new Set(['demo-visa', 'demo-mastercard']);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const label = (value, fallback) => typeof value === 'string' && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) : fallback;

export function checkedTestInstruments(data) {
  if (data?.simulated !== true || !Array.isArray(data.instruments) || data.instruments.some(value =>
    !allowedIds.has(value.id) || !/^\d{4}$/.test(value.last4) || !['Visa', 'Mastercard'].includes(value.brand)) ||
    new Set(data.instruments.map(value => value.id)).size !== data.instruments.length) throw new Error('The test-card catalog is unavailable. Please refresh.');
  return data.instruments.map(value => ({ id: value.id, brand: value.brand, last4: value.last4, bankLabel: label(value.bankLabel, 'Demo issuer') }));
}

export function checkedCards(data, uid) {
  if (!uid || data?.simulated !== true || !Array.isArray(data.cards) || data.cards.some(value => !safeId(value.id) ||
    (value.ownerUid && value.ownerUid !== uid)) || new Set(data.cards.map(value => value.id)).size !== data.cards.length) {
    throw new Error('Your test cards could not be verified. Please refresh.');
  }
  const cards = data.cards.map(value => ({
    id: value.id, testCardId: allowedIds.has(value.testCardId) ? value.testCardId : null,
    ownerUid: value.ownerUid || null, brand: ['Visa', 'Mastercard'].includes(value.brand) ? value.brand : 'Legacy card',
    last4: /^\d{4}$/.test(value.last4 || '') ? value.last4 : null,
    bankLabel: label(value.bankLabel, 'Demo issuer'), isDefault: value.isDefault === true,
    expMonth: value.expMonth, expYear: value.expYear,
  }));
  return { cards, defaultCount: cards.filter(card => card.isDefault).length };
}

export function cardAvailability(card, instruments, uid, now = new Date()) {
  const instrument = instruments?.find(item => item.id === card.testCardId);
  if (!instrument || card.ownerUid !== uid || card.brand !== instrument.brand || card.last4 !== instrument.last4) return 'legacy';
  if (!Number.isInteger(card.expMonth) || card.expMonth < 1 || card.expMonth > 12 || !Number.isInteger(card.expYear)) return 'expiry-unavailable';
  if (card.expYear < now.getUTCFullYear() || (card.expYear === now.getUTCFullYear() && card.expMonth < now.getUTCMonth() + 1)) return 'expired';
  return 'ready';
}

export function cardOperationApplied(operation, cards) {
  if (operation.type === 'add') return cards.some(card => card.testCardId === operation.testCardId);
  if (operation.type === 'remove') return !cards.some(card => card.id === operation.id);
  return cards.filter(card => card.isDefault).length === 1 && cards.some(card => card.id === operation.id && card.isDefault);
}
