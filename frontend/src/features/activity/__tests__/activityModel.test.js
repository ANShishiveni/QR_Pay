import { activityQuery, activityTransaction, checkedActivityPage, DEFAULT_ACTIVITY_FILTERS, mergeActivity } from '../activityModel';
const transaction = { id: 'tx-1', userId: 'payer', payerUid: 'payer', requesterUid: 'recipient', amountMinor: 100,
  currency: 'NAD', simulated: true, status: 'completed', payerName: 'Ada', requesterName: 'Ben', brand: 'Visa', last4: '4242' };
test('transaction normalization derives direction and a masked method while stripping private fields', () => {
  const actual = activityTransaction({ ...transaction, role: 'received', email: 'secret@example.com', phone: '+2640000000',
    sessionId: 'private-session', otp: '123456', cardNumber: '4111111111111111', methodLabel: '4111111111111111' }, 'payer');
  expect(actual).toMatchObject({ role: 'sent', counterpartyName: 'Ben', methodLabel: 'Visa test instrument ending 4242' });
  expect(JSON.stringify(actual)).not.toMatch(/private-session|secret@example|4111111111111111|123456/);
});
test('historical records retain their ID and role without inventing QR relationships', () => {
  expect(activityTransaction({ ...transaction, payerUid: null, requesterUid: null, type: 'receive' }, 'payer'))
    .toMatchObject({ id: 'tx-1', requestId: null, legacy: true, role: 'received' });
});
test.each([{ userId: 'other' }, { payerUid: 'other' }, { amountMinor: 1.5 }, { simulated: false }, { currency: 'USD' }])('invalid or foreign transaction fails closed %j', extra => {
  expect(() => activityTransaction({ ...transaction, ...extra }, 'payer', 'tx-1')).toThrow('could not be verified');
});
test('a legacy record requires exact ownership', () => {
  expect(() => activityTransaction({ ...transaction, payerUid: null, requesterUid: null, userId: 'other' }, 'payer')).toThrow();
});
test('date filters include full Namibia calendar days across UTC boundaries', () => {
  expect(activityQuery({ ...DEFAULT_ACTIVITY_FILTERS, fromDate: '2026-10-27', toDate: '2026-10-27', search: '  Lunch ' })).toEqual({
    type: 'all', status: 'all', search: 'Lunch', from: '2026-10-26T22:00:00.000Z', to: '2026-10-27T21:59:59.999Z',
  });
});
test('historical Namibia winter dates respect the former UTC+01 offset', () => {
  expect(activityQuery({ ...DEFAULT_ACTIVITY_FILTERS, fromDate: '2016-07-01', toDate: '2016-07-01' })).toMatchObject({
    from: '2016-06-30T23:00:00.000Z', to: '2016-07-01T22:59:59.999Z',
  });
});
test.each([{ fromDate: '2026-02-30' }, { fromDate: '27/10/2026' }, { fromDate: '2026-10-28', toDate: '2026-10-27' }])('invalid date filters are rejected %j', extra => {
  expect(() => activityQuery({ ...DEFAULT_ACTIVITY_FILTERS, ...extra })).toThrow();
});
test('page boundaries are verified and duplicates preserve one canonical row', () => {
  expect(() => checkedActivityPage({ transactions: [], pagination: { offset: 20, limit: 20, total: 0, hasMore: false } }, 'payer', 0, 20)).toThrow();
  expect(mergeActivity([transaction], [{ ...transaction, reference: 'new' }, { ...transaction, id: 'tx-2' }])).toEqual([
    { ...transaction, reference: 'new' }, { ...transaction, id: 'tx-2' },
  ]);
});
