import { formatDate, formatMoney } from '../../utils/money';

const text = (value, limit = 160) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
export function receiptFields(transaction) {
  if (!transaction?.simulated || !['completed', 'succeeded'].includes(transaction.status) ||
    !Number.isSafeInteger(transaction.amountMinor) || transaction.amountMinor < 1 || transaction.currency !== 'NAD' || !transaction.id) {
    throw new Error('Only a verified completed simulation can be shared as a receipt.');
  }
  const last4 = /^\d{4}$/.test(transaction.last4 || '') ? transaction.last4 : null;
  const brand = ['Visa', 'Mastercard'].includes(transaction.brand) ? transaction.brand : 'Demo';
  return [
    ['Amount', formatMoney(transaction.amountMinor)], ['Status', 'Simulated payment completed'],
    ['Transaction', text(transaction.id, 128)], ['From', text(transaction.payerName || 'Demo payer', 120)],
    ['To', text(transaction.requesterName || 'Demo recipient', 120)], ['Reference', text(transaction.reference || 'No reference', 80)],
    ['Method', last4 ? `${brand} test instrument ending ${last4}` : transaction.legacy ? 'Legacy simulated test instrument' : 'Simulated test instrument'],
    ['Date (Africa/Windhoek)', formatDate(transaction.completedAt || transaction.timestamp || transaction.createdAt || '')],
  ];
}
export const RECEIPT_NOTICE = 'No real funds transferred. This demonstration receipt is not proof of bank settlement.';
export function receiptText(transaction) {
  return ['NAMPAY — SIMULATED RECEIPT', RECEIPT_NOTICE, '', ...receiptFields(transaction).map(([name, value]) => `${name}: ${value}`)].join('\n');
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export function receiptHtml(transaction) {
  const fields = receiptFields(transaction);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>NamPay simulated receipt</title><style>body{font:16px system-ui,sans-serif;background:#f6f8fa;color:#11263d;margin:0;padding:24px}main{max-width:560px;margin:24px auto;padding:28px;background:white;border:1px solid #d4dde5;border-radius:16px}h1{font-size:26px}p{line-height:1.5}dl{display:grid;grid-template-columns:auto 1fr;gap:16px}dt{color:#46576a}dd{margin:0;text-align:right;overflow-wrap:anywhere}.notice{padding:16px;background:#e3f2ef;border-radius:8px;color:#055c52}@media print{body{background:white;padding:0}main{border:0}}</style><main><h1>NamPay · Simulated receipt</h1><p class="notice">${escapeHtml(RECEIPT_NOTICE)}</p><dl>${fields.map(([name, value]) => `<dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl><p>DEMO / NO REAL MONEY</p></main></html>`;
}
export function receiptFilename(transaction) { return `nampay-simulated-receipt-${String(transaction.id || 'record').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}.html`; }
