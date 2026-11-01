const request = require('supertest');
const { testContext } = require('./helpers/app');
const { issueSession } = require('../services/authService');

function inboxContext() {
  let now = Date.parse('2026-10-28T12:00:00Z');
  const users = Object.fromEntries(['alice', 'bob'].map(uid => [uid, {
    uid, email: `${uid}@example.test`, status: 'active', sessionVersion: 0,
  }]));
  const paymentRequest = (id, requesterUid, status = 'pending', expiresAt = now) => ({
    id, requesterUid, status, amountMinor: 1000, currency: 'NAD',
    createdAt: new Date(now - 300000).toISOString(), expiresAt: new Date(expiresAt).toISOString(),
  });
  const seed = { users, paymentRequests: {
    due: paymentRequest('due', 'alice'),
    later: paymentRequest('later', 'alice', 'pending', now + 300000),
    completed: paymentRequest('completed', 'alice', 'completed'),
    cancelled: paymentRequest('cancelled', 'alice', 'cancelled'),
    bobDue: paymentRequest('bobDue', 'bob'),
    legacy: { ...paymentRequest('legacy', undefined), senderId: 'alice' },
  }, notifications: { alice: {
    prior: { id: 'prior', recipientUid: 'alice', eventType: 'request_created', requestId: 'due',
      createdAt: new Date(now - 300000).toISOString(), readAt: null, simulated: true },
  } } };
  const context = testContext({ routes: ['users'], seed, config: { now: () => now } });
  return { ...context, seed, advance: milliseconds => { now += milliseconds; },
    tokens: Object.fromEntries(Object.values(users).map(user => [user.uid, `Bearer ${issueSession(user, context.config).token}`])),
  };
}

describe('owned notification inbox reconciliation', () => {
  it('expires only due owned requests and returns their events without opening request history', async () => {
    const { app, repository, tokens, seed } = inboxContext();
    await request(app).get('/api/users/notifications').expect(401);
    expect(await repository.read()).toEqual(seed);

    const response = await request(app).get('/api/users/notifications').set('Authorization', tokens.alice).expect(200);
    expect(response.body.notifications.map(item => item.id).sort()).toEqual(['prior', 'request_expired_due', 'request_expired_legacy']);
    expect(response.body.notifications.every(item => item.recipientUid === 'alice')).toBe(true);
    expect(response.body.notifications.find(item => item.id === 'request_expired_due')).toMatchObject({
      eventType: 'request_expired', requestId: 'due', createdAt: '2026-10-28T12:00:00.000Z', readAt: null,
    });
    const state = await repository.read();
    expect(state.paymentRequests.due.status).toBe('expired');
    expect(state.paymentRequests.legacy.status).toBe('expired');
    for (const id of ['later', 'completed', 'cancelled', 'bobDue']) {
      expect(state.paymentRequests[id]).toEqual(seed.paymentRequests[id]);
    }
    expect(state.notifications.bob).toBeUndefined();
  });

  it('deduplicates concurrent and repeated loads, preserving read state and cross-user isolation', async () => {
    const { app, repository, tokens, advance } = inboxContext();
    const responses = await Promise.all(Array.from({ length: 3 }, () =>
      request(app).get('/api/users/notifications').set('Authorization', tokens.alice).expect(200)));
    for (const response of responses) expect(response.body.notifications).toHaveLength(3);
    const eventPath = 'notifications/alice/request_expired_due';
    const before = await repository.read(eventPath);
    await request(app).put('/api/users/notifications/request_expired_due/read').set('Authorization', tokens.bob).expect(404);
    expect(await repository.read(eventPath)).toEqual(before);

    advance(1000);
    await request(app).put('/api/users/notifications/request_expired_due/read').set('Authorization', tokens.alice).expect(200);
    const read = await repository.read(eventPath);
    expect(read.readAt).toBe('2026-10-28T12:00:01.000Z');
    advance(1000);
    await request(app).put('/api/users/notifications/request_expired_due/read').set('Authorization', tokens.alice).expect(200);
    const repeated = await request(app).get('/api/users/notifications').set('Authorization', tokens.alice).expect(200);
    expect(repeated.body.notifications).toHaveLength(3);
    expect(await repository.read(eventPath)).toEqual(read);

    const otherInbox = await request(app).get('/api/users/notifications').set('Authorization', tokens.bob).expect(200);
    expect(otherInbox.body.notifications).toHaveLength(1);
    expect(otherInbox.body.notifications[0]).toMatchObject({ id: 'request_expired_bobDue', recipientUid: 'bob' });
    expect(await repository.read(eventPath)).toEqual(read);
  });
});
