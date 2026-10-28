const request = require('supertest');
const bcrypt = require('bcryptjs');
const { testContext } = require('./helpers/app');
const { issueSession } = require('../services/authService');

function seeded({ routes = ['auth', 'users'] } = {}) {
  const alice = { uid: 'alice', email: 'alice@example.test', firstName: 'Alice', lastName: 'Tester', status: 'active', sessionVersion: 0 };
  const bob = { uid: 'bob', email: 'bob@example.test', firstName: 'Bob', lastName: 'Tester', status: 'active', sessionVersion: 0 };
  const outsider = { uid: 'outsider', email: 'outsider@example.test', status: 'active', sessionVersion: 0 };
  const common = { payerUid: 'alice', requesterUid: 'bob', currency: 'NAD', status: 'completed', payerName: 'Alice Tester', requesterName: 'Bob Tester', methodLabel: 'Demo Visa •••• 4242', last4: '4242' };
  const seed = { users: { alice, bob, outsider }, transactions: {
    first: { ...common, id: 'first', requestId: 'request-1', amountMinor: 10001, reference: 'Lunch', createdAt: '2026-10-20T10:00:00Z', completedAt: '2026-10-20T10:01:00Z' },
    second: { ...common, id: 'second', requestId: 'request-2', payerUid: 'bob', requesterUid: 'alice', amountMinor: 2000, reference: 'Coffee', createdAt: '2026-10-20T11:00:00Z', completedAt: '2026-10-20T11:01:00Z' },
    legacy: { id: 'legacy', userId: 'alice', type: 'send', amount: 10.5, status: 'succeeded', timestamp: '2025-01-01T12:00:00Z' },
  }, notifications: { alice: { paid: { recipientUid: 'alice', eventType: 'payment_completed', createdAt: '2026-10-20T11:01:00Z' } } } };
  const context = testContext({ routes, seed });
  return { ...context, tokens: Object.fromEntries([alice, bob, outsider].map(user => [user.uid, `Bearer ${issueSession(user, context.config).token}`])) };
}

describe('private activity, receipts and profile compatibility', () => {
  it('T-18 exposes consistent canonical IDs/minor amounts and opposing roles', async () => {
    const { app, tokens } = seeded();
    const sent = await request(app).get('/api/users/transactions/first').set('Authorization', tokens.alice).expect(200);
    const received = await request(app).get('/api/users/transactions/first').set('Authorization', tokens.bob).expect(200);
    expect(sent.body.transaction).toMatchObject({ transactionId: 'first', amountMinor: 10001, role: 'sent' });
    expect(received.body.transaction).toMatchObject({ transactionId: 'first', amountMinor: 10001, role: 'received' });
    expect(sent.body.receipt.disclaimer).toContain('No real funds transferred');
    await request(app).get('/api/users/transactions/first').set('Authorization', tokens.outsider).expect(404);
  });
  it('ignores a legacy owner on canonical records across receipts, history and stats', async () => {
    const { app, repository, tokens } = seeded({ routes: ['auth', 'users', 'payments'] });
    const mixed = { ...await repository.read('transactions/first'), userId: 'outsider' };
    await repository.set('transactions/first', mixed);

    for (const path of ['/api/users/transactions/first', '/api/payments/transactions/first']) {
      const rejected = await request(app).get(path).set('Authorization', tokens.outsider).expect(404);
      expect(rejected.body.code).toBe('TRANSACTION_NOT_FOUND');
      for (const [uid, role] of [['alice', 'sent'], ['bob', 'received']]) {
        const result = await request(app).get(path).set('Authorization', tokens[uid]).expect(200);
        expect(result.body.transaction).toMatchObject({ id: 'first', role, amountMinor: 10001, legacy: false });
      }
    }
    for (const path of ['/api/users/transactions', '/api/payments/history']) {
      const history = await request(app).get(path).set('Authorization', tokens.outsider).expect(200);
      expect(history.body.transactions).toEqual([]);
      expect(history.body.pagination.total).toBe(0);
    }
    const stats = await request(app).get('/api/users/stats').set('Authorization', tokens.outsider).expect(200);
    expect(stats.body.stats).toMatchObject({ totalTransactions: 0, totalSentMinor: 0, totalReceivedMinor: 0, lastTransaction: null });
    expect(await repository.read('transactions/first')).toEqual(mixed);
  });
  it('filters, searches and paginates actual canonical and legacy records', async () => {
    const { app, tokens } = seeded();
    const first = await request(app).get('/api/users/transactions?limit=1').set('Authorization', tokens.alice).expect(200);
    expect(first.body).toMatchObject({ total: 3, nextOffset: 1, pagination: { total: 3, hasMore: true } });
    expect(first.body.transactions[0].id).toBe('second');
    const sent = await request(app).get('/api/users/transactions?type=send').set('Authorization', tokens.alice).expect(200);
    expect(sent.body.transactions.map(item => item.id)).toEqual(['first', 'legacy']);
    const search = await request(app).get('/api/users/transactions?search=Bob&status=all&from=2026-01-01').set('Authorization', tokens.alice).expect(200);
    expect(search.body.total).toBe(2);
    await request(app).get('/api/users/transactions?limit=-1').set('Authorization', tokens.alice).expect(400);
  });
  it('calculates sent/received simulation totals from authoritative minor units', async () => {
    const { app, tokens } = seeded();
    const result = await request(app).get('/api/users/stats').set('Authorization', tokens.alice).expect(200);
    expect(result.body.stats).toMatchObject({ totalSentMinor: 11051, totalReceivedMinor: 2000, totalTransactions: 3, simulated: true });
    expect(result.body.stats).not.toHaveProperty('balance');
  });
  it('restricts notifications and marks them read idempotently', async () => {
    const { app, tokens } = seeded();
    const result = await request(app).get('/api/users/notifications').set('Authorization', tokens.alice).expect(200);
    expect(result.body.notifications).toHaveLength(1);
    await request(app).put('/api/users/notifications/paid/read').set('Authorization', tokens.outsider).expect(404);
    await request(app).put('/api/users/notifications/paid/read').set('Authorization', tokens.alice).expect(200);
    await request(app).put('/api/users/notifications/paid/read').set('Authorization', tokens.alice).expect(200);
  });
  it('fails closed when a legacy UID collides with another account key', async () => {
    const password = 'Legacy collision passphrase';
    const hashedPassword = await bcrypt.hash(password, 10);
    const { app, repository } = testContext({ routes: ['auth', 'users'], seed: { users: {
      source: { uid: 'occupied', email: 'source@example.test', hashedPassword },
      occupied: { uid: 'victim', email: 'victim@example.test', hashedPassword },
    } } });
    await request(app).post('/api/auth/login').send({ email: 'source@example.test', password }).expect(401);
    expect((await repository.read('users/occupied')).uid).toBe('victim');
  });
  it('fails closed for ambiguous legacy email identities', async () => {
    const password = 'Legacy isolated passphrase';
    const hashedPassword = await bcrypt.hash(password, 10);
    const { app, repository } = testContext({ routes: ['auth', 'users'], seed: { users: {
      oldA: { uid: 'a', email: 'same@example.test', hashedPassword },
      oldB: { uid: 'b', email: 'same@example.test', hashedPassword },
    } } });
    await request(app).post('/api/auth/login').send({ email: 'same@example.test', password }).expect(401);
    expect(Object.keys(await repository.read('users'))).toEqual(['oldA', 'oldB']);
  });
});
