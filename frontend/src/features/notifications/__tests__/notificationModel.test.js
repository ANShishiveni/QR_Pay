import { checkedNotifications, notificationCopy, notificationDestination } from '../notificationModel';

const notification = (changes = {}) => ({
  id: 'request_created_request-1', recipientUid: 'viewer', eventType: 'request_created', requestId: 'request-1',
  createdAt: '2026-10-28T12:00:00.000Z', readAt: null, simulated: true, ...changes,
});
const check = values => checkedNotifications({ notifications: values }, 'viewer');

test('projects only owned inbox fields and omits arbitrary bodies, contact and payment details', () => {
  const item = notification({ phone: '+26400000000', email: 'demo@example.invalid', body: 'Secret message', amountMinor: 1001,
    otp: '123456', cardNumber: 'private-pan', status: 'completed', recipientName: 'Private name' });
  expect(check([item])).toEqual([notification()]);
  expect(JSON.stringify(check([item]))).not.toMatch(/Secret|Private|private|example|264000|123456/);
});

test('accepts missing optional simulation flag without inventing one', () => {
  const item = notification(); delete item.simulated;
  expect(check([item])).toEqual([item]);
  expect(check([item])[0]).not.toHaveProperty('simulated');
});

test.each([
  ['wrong owner', { recipientUid: 'other' }],
  ['missing owner', { recipientUid: undefined }],
  ['unknown event', { eventType: 'funds_settled' }],
  ['unsafe notification ID', { id: '../request' }],
  ['oversize notification ID', { id: 'a'.repeat(181) }],
  ['unsafe request ID', { requestId: 'a?token=private' }],
  ['oversize request ID', { requestId: 'a'.repeat(129) }],
  ['unsafe transaction ID', { transactionId: 'file:///private' }],
  ['live event flag', { simulated: false }],
  ['unparseable created date', { createdAt: 'yesterday' }],
  ['date without timezone', { createdAt: '2026-10-28T12:00:00' }],
  ['invalid calendar date', { createdAt: '2026-02-31T12:00:00.000Z' }],
  ['rolled over clock', { createdAt: '2026-10-28T24:00:00.000Z' }],
  ['missing read flag', { readAt: undefined }],
  ['invalid read date', { readAt: 'not a date' }],
])('rejects an entire response containing %s without leaking fields in its error', (_, changes) => {
  expect(() => check([notification(), notification({ id: 'second', ...changes })])).toThrow('Your notifications could not be verified. Refresh and try again.');
});

test.each([undefined, {}, { notifications: null }, { notifications: {} }])('rejects an incomplete response %p', data => {
  expect(() => checkedNotifications(data, 'viewer')).toThrow('Your notifications could not be verified');
});

test('a missing current user cannot read notification state', () => {
  expect(() => checkedNotifications({ notifications: [notification()] }, null)).toThrow();
});

test('deduplicates deterministically, preserves a read version and sorts newest first', () => {
  const unread = notification();
  const read = notification({ readAt: '2026-10-28T13:00:00.000Z' });
  const latestRead = notification({ readAt: '2026-10-28T14:00:00.000Z' });
  const newest = notification({ id: 'request_created_request-2', requestId: 'request-2', createdAt: '2026-10-28T15:00:00.000Z' });
  const expected = [newest, latestRead];
  expect(check([unread, newest, latestRead, read])).toEqual(expected);
  expect(check([read, latestRead, newest, unread])).toEqual(expected);
});

test('ties sort by identifier and limit to the latest one hundred distinct events', () => {
  const values = Array.from({ length: 102 }, (_, index) => notification({ id: `request_created_${String(index).padStart(3, '0')}` })).reverse();
  const items = check(values);
  expect(items).toHaveLength(100);
  expect(items[0].id).toBe('request_created_000');
  expect(items[99].id).toBe('request_created_099');
});

test('conflicting identities under a duplicate ID fail closed', () => {
  expect(() => check([notification(), notification({ requestId: 'other-request' })])).toThrow();
  expect(() => check([notification(), notification({ eventType: 'payment_completed' })])).toThrow();
  expect(() => check([notification({ transactionId: 'transaction-1' }), notification({ transactionId: 'transaction-2' })])).toThrow();
});

test('normalizes valid offset timestamps before sorting and duplicate comparison', () => {
  expect(check([notification({ createdAt: '2026-10-28T14:00:00+02:00', readAt: '2026-10-28T14:30:00+02:00' })])[0])
    .toMatchObject({ createdAt: '2026-10-28T12:00:00.000Z', readAt: '2026-10-28T12:30:00.000Z' });
});

test.each(['request_created', 'request_expired'])('%s opens the authorized request route using only its ID', eventType => {
  expect(notificationDestination(notification({ eventType, transactionId: 'ignored-transaction' })))
    .toEqual({ name: 'QRRequestDetails', params: { requestId: 'request-1' } });
});

test('payment events use a supplied transaction ID or reload the request result without claiming completion', () => {
  expect(notificationDestination(notification({ eventType: 'payment_completed', transactionId: 'transaction-1' })))
    .toEqual({ name: 'TransactionDetail', params: { transactionId: 'transaction-1' } });
  expect(notificationDestination(notification({ eventType: 'payment_completed' })))
    .toEqual({ name: 'PaymentResult', params: { requestId: 'request-1' } });
  expect(notificationDestination({ eventType: 'unknown', requestId: 'request-1' })).toBeNull();
  expect(notificationDestination({ eventType: 'request_created', requestId: '../unsafe' })).toBeNull();
});

test('copy is generic and never uses bodies, amounts, names or statuses from an event', () => {
  for (const eventType of ['request_created', 'request_expired', 'payment_completed']) {
    const copy = notificationCopy(notification({ eventType, body: 'Private body', amountMinor: 999999, recipientName: 'Private name', status: 'completed' }));
    expect(copy.title).toBeTruthy(); expect(copy.message).toBeTruthy();
    expect(JSON.stringify(copy)).not.toMatch(/Private|999999|N\$/);
  }
  expect(notificationCopy({ eventType: 'payment_completed' }).message).toContain('verify its outcome');
  expect(notificationCopy({ eventType: 'payment_completed' }).message).toContain('No real funds');
});
