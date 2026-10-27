import { confirmedTransaction, createPaymentFlow, eligibleCards, validateRequest } from '../paymentFlow';
const baseTime = Date.UTC(2026, 9, 27, 12);
const request = { id: 'request-1', requesterUid: 'recipient', requesterName: 'Demo Recipient', amountMinor: 12345,
  currency: 'NAD', status: 'pending', expiresAt: new Date(baseTime + 300000).toISOString(), simulated: true };
const card = { id: 'card-1', ownerUid: 'payer', testCardId: 'demo-visa', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2028, simulated: true };
const transaction = { id: 'transaction-1', requestId: request.id, payerUid: 'payer', requesterUid: 'recipient', amountMinor: 12345,
  currency: 'NAD', status: 'completed', simulated: true };
const session = { success: true, sessionId: 'session-1', provider: 'mock',
  expiresAt: new Date(baseTime + 300000).toISOString(), resendAt: new Date(baseTime + 60000).toISOString() };
const verified = { success: true, status: 'verified', sessionId: session.sessionId, requestId: request.id };
const response = (paymentRequest = request, tx) => ({ data: { paymentRequest, serverTime: new Date(baseTime).toISOString(), transaction: tx } });
const failure = (status, error, extras = {}) => ({ response: { status, data: { error, ...extras } } });
function setup() {
  let time = baseTime;
  const api = {
    qrAPI: { getRequest: jest.fn().mockResolvedValue(response()), confirmPayment: jest.fn().mockResolvedValue({ data: { transaction } }) },
    paymentAPI: { getCards: jest.fn().mockResolvedValue({ data: { cards: [card] } }) },
    otpAPI: { sendOTP: jest.fn().mockResolvedValue({ data: session }), resendOTP: jest.fn().mockResolvedValue({ data: { ...session, sessionId: 'session-2' } }),
      verifyOTP: jest.fn().mockResolvedValue({ data: verified }), getOTPStatus: jest.fn() },
  };
  const onComplete = jest.fn();
  const flow = createPaymentFlow({ api, requestId: request.id, cardId: card.id, uid: 'payer', idempotencyKey: 'stable-operation-key', now: () => time, onComplete });
  return { api, flow, onComplete, setTime: next => { time = next; } };
}
async function started() { const context = setup(); await context.flow.initialize(); await context.flow.send(); return context; }

test('eligible instruments must be owned, allowlisted, simulated and current', () => {
  const cards = [card, { ...card, id: 'foreign', ownerUid: 'other' }, { ...card, id: 'legacy', testCardId: undefined },
    { ...card, id: 'expired', expYear: 2025 }, { ...card, id: 'live', simulated: false }, { ...card, id: 'bad-month', expMonth: 13 }];
  expect(eligibleCards(cards, 'payer', baseTime)).toEqual([card]);
});
test.each([{ amountMinor: 1.2 }, { amountMinor: 1000001 }, { currency: 'USD' }, { simulated: false }, { id: 'other' }, { expiresAt: 'invalid' }])('malformed request data fails closed: %j', change => {
  expect(() => validateRequest({ ...request, ...change }, request.id)).toThrow();
});
test('receipts must match actor, request, amount and transaction identity', () => {
  const identity = { uid: 'payer', requestId: request.id, amountMinor: 12345, transactionId: transaction.id };
  expect(confirmedTransaction(transaction, identity)).toBe(true);
  for (const change of [{ payerUid: 'other' }, { requestId: 'other' }, { amountMinor: 1 }, { id: 'other' }, { status: 'pending' }, { simulated: false }]) {
    expect(confirmedTransaction({ ...transaction, ...change }, identity)).toBe(false);
  }
});
test('duplicate actions issue once and confirm exactly once with the same operation body', async () => {
  const { api, flow, onComplete } = setup();
  await flow.initialize(); await Promise.all([flow.send(), flow.send()]);
  expect(api.otpAPI.sendOTP).toHaveBeenCalledTimes(1);
  await Promise.all([flow.verify('123456'), flow.verify('123456')]);
  expect(api.otpAPI.verifyOTP).toHaveBeenCalledTimes(1);
  expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
  expect(api.qrAPI.confirmPayment).toHaveBeenCalledWith({ requestId: request.id, cardId: card.id, sessionId: session.sessionId, idempotencyKey: 'stable-operation-key' });
  expect(flow.getState().phase).toBe('completed'); expect(onComplete).toHaveBeenCalledTimes(1);
  await flow.retryConfirmation(); expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
});
test('timeout after commit reconciles the canonical transaction without a second write', async () => {
  const { api, flow, onComplete } = await started();
  api.qrAPI.confirmPayment.mockImplementationOnce(async () => {
    api.qrAPI.getRequest.mockResolvedValue(response({ ...request, status: 'completed' }, transaction)); throw new Error('Network timeout');
  });
  await flow.verify('123456');
  expect(flow.getState().phase).toBe('completed'); expect(onComplete).toHaveBeenCalledWith(transaction);
  expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
});
test('pending after timeout stays uncertain and explicit retry preserves the exact body', async () => {
  const { api, flow } = await started();
  api.qrAPI.confirmPayment.mockRejectedValueOnce(new Error('Network timeout'));
  await flow.verify('123456'); expect(flow.getState().phase).toBe('uncertain');
  await flow.send(true); await flow.verify('123456');
  expect(api.otpAPI.resendOTP).not.toHaveBeenCalled(); expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
  await flow.retryConfirmation(); expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(2);
  expect(api.qrAPI.confirmPayment.mock.calls[1][0]).toBe(api.qrAPI.confirmPayment.mock.calls[0][0]);
  expect(api.otpAPI.verifyOTP).toHaveBeenCalledTimes(1);
});
test('offline result remains uncertain until foreground reconciliation', async () => {
  const { api, flow, onComplete } = await started();
  api.qrAPI.confirmPayment.mockImplementationOnce(async () => {
    api.qrAPI.getRequest.mockRejectedValue(new Error('Offline')); throw new Error('Offline');
  });
  await flow.verify('123456'); expect(flow.getState().phase).toBe('uncertain'); expect(onComplete).not.toHaveBeenCalled();
  api.qrAPI.getRequest.mockResolvedValue(response({ ...request, status: 'completed' }, transaction));
  await flow.resume(); expect(onComplete).toHaveBeenCalledTimes(1); expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
});
test('a completed request belonging to another payer never reports success for this payer', async () => {
  const { api, flow, onComplete } = await started();
  api.qrAPI.confirmPayment.mockImplementationOnce(async () => {
    api.qrAPI.getRequest.mockResolvedValue(response({ ...request, status: 'completed' })); throw failure(409, 'Already completed');
  });
  await flow.verify('123456'); expect(flow.getState().phase).toBe('terminal'); expect(onComplete).not.toHaveBeenCalled();
  await flow.retryConfirmation(); expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
});
test('lost verification response reads session status instead of blindly verifying again', async () => {
  const { api, flow } = await started();
  api.otpAPI.verifyOTP.mockRejectedValueOnce(new Error('Timeout'));
  api.otpAPI.getOTPStatus.mockResolvedValue({ data: { session: { id: session.sessionId, requestId: request.id, status: 'verified', isExpired: false } } });
  await flow.verify('123456');
  expect(api.otpAPI.getOTPStatus).toHaveBeenCalledWith(session.sessionId);
  expect(api.otpAPI.verifyOTP).toHaveBeenCalledTimes(1); expect(api.qrAPI.confirmPayment).toHaveBeenCalledTimes(1);
});
test('unknown verification requires explicit session status recovery before confirming', async () => {
  const { api, flow } = await started();
  api.otpAPI.verifyOTP.mockRejectedValueOnce(new Error('Timeout')); api.otpAPI.getOTPStatus.mockRejectedValueOnce(new Error('Offline'));
  await flow.verify('123456'); expect(flow.getState().phase).toBe('verification_unknown'); expect(api.qrAPI.confirmPayment).not.toHaveBeenCalled();
  api.otpAPI.getOTPStatus.mockResolvedValue({ data: { session: { id: session.sessionId, requestId: request.id, status: 'verified', isExpired: false } } });
  await flow.check(); expect(flow.getState().phase).toBe('completed');
});
test('wrong code exposes remaining attempts without confirming or retaining plaintext', async () => {
  const { api, flow } = await started(); api.otpAPI.verifyOTP.mockRejectedValueOnce(failure(400, 'Incorrect code', { attemptsLeft: 4 }));
  await flow.verify('000000'); expect(flow.getState()).toMatchObject({ phase: 'code', attemptsLeft: 4, error: 'Incorrect code' });
  expect(JSON.stringify(flow.getState())).not.toContain('000000'); expect(api.qrAPI.confirmPayment).not.toHaveBeenCalled();
});
test('server-derived cooldown blocks rapid resend then replaces the old session', async () => {
  const { api, flow, setTime } = await started();
  await flow.send(true); expect(api.otpAPI.resendOTP).not.toHaveBeenCalled();
  setTime(baseTime + 61000);
  api.qrAPI.getRequest.mockResolvedValue({ data: { paymentRequest: request, serverTime: new Date(baseTime + 61000).toISOString() } });
  await flow.send(true); expect(api.otpAPI.resendOTP).toHaveBeenCalledTimes(1); expect(flow.getState().session.sessionId).toBe('session-2');
});
test.each(['cancelled', 'expired'])('terminal request %s blocks challenge and confirmation', async status => {
  const { api, flow } = setup(); api.qrAPI.getRequest.mockResolvedValue(response({ ...request, status }));
  await flow.initialize(); await flow.send(); await flow.verify('123456');
  expect(flow.getState().phase).toBe('terminal'); expect(api.otpAPI.sendOTP).not.toHaveBeenCalled(); expect(api.qrAPI.confirmPayment).not.toHaveBeenCalled();
});
test('instrument removal and self payment fail before challenge issuance', async () => {
  const first = setup(); first.api.paymentAPI.getCards.mockResolvedValue({ data: { cards: [] } });
  await first.flow.initialize(); await first.flow.send(); expect(first.api.otpAPI.sendOTP).not.toHaveBeenCalled();
  const second = setup(); second.api.qrAPI.getRequest.mockResolvedValue(response({ ...request, requesterUid: 'payer' }));
  await second.flow.initialize(); await second.flow.send(); expect(second.api.otpAPI.sendOTP).not.toHaveBeenCalled();
});
test('foreground recovery checks the existing challenge without issuing a new one', async () => {
  const { api, flow } = await started(); await flow.resume(); expect(flow.getState().phase).toBe('verification_unknown');
  api.otpAPI.getOTPStatus.mockResolvedValue({ data: { session: { id: session.sessionId, requestId: request.id, status: 'pending', attempts: 2, maxAttempts: 5, isExpired: false } } });
  await flow.check(); expect(flow.getState()).toMatchObject({ phase: 'code', attemptsLeft: 3 });
  expect(api.otpAPI.sendOTP).toHaveBeenCalledTimes(1); expect(api.qrAPI.confirmPayment).not.toHaveBeenCalled();
});
