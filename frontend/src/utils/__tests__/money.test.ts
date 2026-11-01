import { parseAmountMinor, formatMoney } from '../money';

describe('NAD minor units', () => {
  test.each([['0.01', 1], ['12.3', 1230], ['12.34', 1234], ['10000', 1000000]])('parses %s without float rounding', (value, expected) => {
    expect(parseAmountMinor(value)).toBe(expected);
  });
  test.each(['0', '-1', 'NaN', 'Infinity', '1e3', '0.001', '10000.01', '12oops', '', '1,000', '01.00'])('rejects invalid amount %s', value => {
    expect(() => parseAmountMinor(value)).toThrow();
  });
  test('formats exact minor units and rejects fractional ledger values', () => {
    expect(formatMoney(123456)).toBe('N$1,234.56');
    expect(() => formatMoney(1.5)).toThrow();
  });
});
