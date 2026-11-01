/** Amounts are stored as integer NAD cents. Never use a display float as ledger state. */
export const MAX_AMOUNT_MINOR = 1_000_000; // N$10,000 per simulated request.

export function parseAmountMinor(input: string | number): number {
  const value = String(input).trim();
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter an amount with up to two decimal places.');
  }
  const [whole, fraction = ''] = value.split('.');
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > MAX_AMOUNT_MINOR) {
    throw new Error('Enter an amount between N$0.01 and N$10,000.00.');
  }
  return amountMinor;
}

export function formatMoney(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Amount must be integer minor units.');
  return `N$${new Intl.NumberFormat('en-NA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountMinor / 100)}`;
}

export function formatDate(value: string | number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-NA', { timeZone: 'Africa/Windhoek', dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
