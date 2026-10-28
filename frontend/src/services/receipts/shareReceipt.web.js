import { receiptFilename, receiptHtml, receiptText } from './receiptExport';
export async function shareReceipt(transaction) {
  const message = receiptText(transaction);
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title: 'NamPay simulated receipt', text: message }); return { action: 'shared' }; }
    catch (error) { if (error.name === 'AbortError') return { action: 'cancelled' }; }
  }
  if (typeof document !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([receiptHtml(transaction)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = receiptFilename(transaction); anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return { action: 'saved' };
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    return { action: 'copied' };
  }
  throw new Error('Sharing is unavailable in this browser. You can still view the receipt here.');
}
