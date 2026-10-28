import { Share } from 'react-native';
import { receiptFields, receiptFilename, receiptHtml, receiptText, RECEIPT_NOTICE } from '../receiptExport';
import { shareReceipt } from '../shareReceipt';
const transaction = { id: 'tx-demo-1', amountMinor: 12345, currency: 'NAD', status: 'completed', simulated: true,
  payerName: 'Demo Payer', requesterName: 'Demo Recipient', reference: 'Lunch', brand: 'Visa', last4: '4242',
  timestamp: '2026-10-27T21:00:00.000Z' };
afterEach(() => jest.restoreAllMocks());
test('export contains the simulation disclaimer, canonical amount and Namibia date', () => {
  const output = receiptText(transaction);
  expect(output).toContain(RECEIPT_NOTICE); expect(output).toContain('Amount: N$123.45');
  expect(output).toContain('Transaction: tx-demo-1'); expect(output).toContain('Visa test instrument ending 4242');
  expect(output).toContain('Date (Africa/Windhoek)'); expect(output).toMatch(/23:00|11:00 pm/);
});
test('explicit export allowlist excludes PAN, phone, email, OTP, token and internal identities', () => {
  const value = { ...transaction, otp: '654321', token: 'private-token', phone: '+26400000000', email: 'secret@example.com',
    payerUid: 'internal-actor', cardNumber: '4111111111111111', methodLabel: 'PAN 4111111111111111' };
  const output = receiptText(value) + receiptHtml(value);
  for (const secret of ['654321', 'private-token', '+26400000000', 'secret@example.com', 'internal-actor', '4111111111111111']) expect(output).not.toContain(secret);
});
test('downloaded HTML escapes record values and contains no executable remote content', () => {
  const output = receiptHtml({ ...transaction, reference: '<script>alert(1)</script>', payerName: '<img src=x onerror=alert(1)>' });
  expect(output).toContain('&lt;script&gt;'); expect(output).not.toContain('<script>'); expect(output).not.toContain('<img');
  expect(output).toContain("default-src 'none'"); expect(output).toContain('DEMO / NO REAL MONEY');
  expect(receiptFilename({ id: '../../private?<tx>' })).toBe('nampay-simulated-receipt-privatetx.html');
});
test.each([{ simulated: false }, { status: 'pending' }, { amountMinor: NaN }, { currency: 'USD' }, { id: '' }])('unconfirmed/incomplete export is rejected %j', extra => {
  expect(() => receiptFields({ ...transaction, ...extra })).toThrow('verified completed simulation');
});
test('native sharing uses only sanitized text and cancellation is not an error', async () => {
  const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
  await expect(shareReceipt(transaction)).resolves.toEqual({ action: 'cancelled' });
  expect(spy).toHaveBeenCalledWith({ title: 'NamPay simulated receipt', message: receiptText(transaction) });
});
test('native provider failures have a recoverable public message', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('sensitive native details'));
  await expect(shareReceipt(transaction)).rejects.toThrow('The receipt could not be shared. You can still view it here.');
});
