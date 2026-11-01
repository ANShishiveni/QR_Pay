import { shareReceipt } from '../shareReceipt.web';
import { RECEIPT_NOTICE } from '../receiptExport';
const transaction = { id: 'tx-1', amountMinor: 12345, currency: 'NAD', status: 'completed', simulated: true,
  payerName: 'Demo Payer', requesterName: 'Demo Recipient', reference: 'Lunch', timestamp: '2026-10-27T10:00:00.000Z' };
let savedNavigator;
let savedDocument;
let savedCreate;
let savedRevoke;
beforeEach(() => {
  jest.useFakeTimers();
  savedNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
  savedDocument = Object.getOwnPropertyDescriptor(global, 'document');
  savedCreate = URL.createObjectURL; savedRevoke = URL.revokeObjectURL;
  Object.defineProperty(global, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(global, 'document', { configurable: true, value: undefined });
  URL.createObjectURL = undefined; URL.revokeObjectURL = jest.fn();
});
afterEach(() => {
  jest.runOnlyPendingTimers(); jest.useRealTimers();
  if (savedNavigator) Object.defineProperty(global, 'navigator', savedNavigator); else delete global.navigator;
  if (savedDocument) Object.defineProperty(global, 'document', savedDocument); else delete global.document;
  URL.createObjectURL = savedCreate; URL.revokeObjectURL = savedRevoke;
});
test('web system sharing contains only safe text and does not create an export file', async () => {
  navigator.share = jest.fn().mockResolvedValue(undefined);
  await expect(shareReceipt({ ...transaction, token: 'secret-session' })).resolves.toEqual({ action: 'shared' });
  expect(navigator.share).toHaveBeenCalledWith({ title: 'NamPay simulated receipt', text: expect.stringContaining(RECEIPT_NOTICE) });
  expect(navigator.share.mock.calls[0][0].text).not.toContain('secret-session');
});
test('cancelling system sharing does not download or report failure', async () => {
  navigator.share = jest.fn().mockRejectedValue({ name: 'AbortError' });
  await expect(shareReceipt(transaction)).resolves.toEqual({ action: 'cancelled' });
});
test('unsupported web sharing downloads a local HTML receipt and revokes its object URL', async () => {
  const anchor = { click: jest.fn(), remove: jest.fn() };
  const document = { createElement: jest.fn(() => anchor), body: { appendChild: jest.fn() } };
  Object.defineProperty(global, 'document', { configurable: true, value: document });
  URL.createObjectURL = jest.fn().mockReturnValue('blob:private-local-export');
  const revoke = URL.revokeObjectURL;
  await expect(shareReceipt(transaction)).resolves.toEqual({ action: 'saved' });
  expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/html;charset=utf-8');
  expect(anchor).toMatchObject({ href: 'blob:private-local-export', download: 'nampay-simulated-receipt-tx-1.html', rel: 'noopener' });
  expect(anchor.click).toHaveBeenCalledTimes(1); expect(anchor.remove).toHaveBeenCalledTimes(1);
  jest.runOnlyPendingTimers(); expect(revoke).toHaveBeenCalledWith('blob:private-local-export');
});
test('text clipboard fallback works when browser downloads are unavailable', async () => {
  navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
  await expect(shareReceipt(transaction)).resolves.toEqual({ action: 'copied' });
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(RECEIPT_NOTICE));
});
test('unsupported browser returns an actionable error without external uploads', async () => {
  await expect(shareReceipt(transaction)).rejects.toThrow('Sharing is unavailable in this browser');
});
