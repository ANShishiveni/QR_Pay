// No OTP, credential, or payment intent is persisted. A live flow keeps one
// immutable confirmation body, including its idempotency key, through retries.
export const paymentError = (error, fallback = 'We couldn’t reach the server. Try again.') =>
  error?.response?.data?.error || error?.message || fallback;

export function validateRequest(request, requestId) {
  if (!request || request.id !== requestId || request.simulated !== true || request.currency !== 'NAD' ||
    !Number.isSafeInteger(request.amountMinor) || request.amountMinor < 1 || request.amountMinor > 1_000_000 ||
    !request.requesterUid || !Number.isFinite(new Date(request.expiresAt).getTime())) {
    throw new Error('The server returned an incomplete payment request. Scan the request again.');
  }
  return request;
}

export function eligibleCards(cards, uid, now = Date.now()) {
  const date = new Date(now);
  return (Array.isArray(cards) ? cards : []).filter(card => card.id && card.ownerUid === uid && card.simulated === true &&
    ['demo-visa', 'demo-mastercard'].includes(card.testCardId) && Number.isInteger(card.expMonth) &&
    card.expMonth >= 1 && card.expMonth <= 12 && Number.isInteger(card.expYear) &&
    (card.expYear > date.getUTCFullYear() || (card.expYear === date.getUTCFullYear() && card.expMonth >= date.getUTCMonth() + 1)));
}

export function confirmedTransaction(transaction, { uid, requestId, amountMinor, transactionId } = {}) {
  const id = transaction?.id || transaction?.transactionId;
  return Boolean(id && (!transactionId || id === transactionId) && transaction.status === 'completed' &&
    transaction.simulated === true && transaction.currency === 'NAD' && Number.isSafeInteger(transaction.amountMinor) &&
    transaction.amountMinor > 0 && (!requestId || transaction.requestId === requestId) &&
    (amountMinor === undefined || transaction.amountMinor === amountMinor) &&
    [transaction.payerUid, transaction.requesterUid].includes(uid));
}

export async function loadReview({ qrAPI, paymentAPI }, requestId, uid, now = Date.now()) {
  const [requestResponse, cardResponse] = await Promise.all([qrAPI.getRequest(requestId), paymentAPI.getCards()]);
  const data = requestResponse.data;
  const request = validateRequest(data.paymentRequest, requestId);
  const serverTime = new Date(data.serverTime).getTime();
  if (!Number.isFinite(serverTime)) throw new Error('The server time is unavailable. Refresh this request.');
  return { request, serverTime: data.serverTime, offset: serverTime - now,
    cards: eligibleCards(cardResponse.data.cards, uid, serverTime), transaction: data.transaction };
}

/** Small controller isolates payment races from React render timing. */
export function createPaymentFlow({ api, requestId, cardId, uid, idempotencyKey, now = Date.now, onChange, onComplete }) {
  let state = { phase: 'loading', busy: false, request: null, card: null, offset: 0, session: null, error: '', attemptsLeft: null };
  let operation = null;
  let confirmation = null;
  let finished = false;
  let disposed = false;
  const patch = updates => { state = { ...state, ...updates }; if (!disposed) onChange?.(state); };
  const serverNow = () => now() + state.offset;
  const complete = transaction => {
    if (!confirmedTransaction(transaction, { uid, requestId, amountMinor: state.request?.amountMinor })) return false;
    patch({ phase: 'completed', error: '', transaction });
    if (!finished && !disposed) { finished = true; onComplete?.(transaction); }
    return true;
  };
  const terminal = request => {
    if (request.status !== 'pending') {
      patch({ phase: 'terminal', error: request.status === 'completed'
        ? 'This request has already been paid. No payment from this session was confirmed.'
        : `This request is ${request.status}. Ask for a new QR request.` });
      return true;
    }
    if (new Date(request.expiresAt).getTime() <= serverNow()) {
      patch({ phase: 'terminal', error: 'This request has expired. Ask for a new QR request.' });
      return true;
    }
    return false;
  };
  const readRequest = async () => {
    const { data } = await api.qrAPI.getRequest(requestId);
    const request = validateRequest(data.paymentRequest, requestId);
    const serverTime = new Date(data.serverTime).getTime();
    if (!Number.isFinite(serverTime)) throw new Error('The server time is unavailable. Check payment status again.');
    patch({ request, offset: serverTime - now(), serverTime: data.serverTime });
    return data;
  };
  const reconcile = async () => {
    const data = await readRequest();
    if ((data.paymentRequest.status === 'completed' && complete(data.transaction)) || terminal(data.paymentRequest)) return;
    patch({ phase: confirmation ? 'uncertain' : state.session ? 'code' : 'idle', error: confirmation
      ? 'The request is still pending. You can safely retry this same confirmation. Do not start a new payment.' : '' });
  };
  const run = action => {
    if (operation || disposed || finished) return operation || Promise.resolve();
    patch({ busy: true, error: '' });
    operation = Promise.resolve().then(action).catch(error => patch({ error: paymentError(error) })).finally(() => {
      operation = null;
      patch({ busy: false });
    });
    return operation;
  };
  const ready = () => {
    if (!state.request || terminal(state.request)) return false;
    if (state.request.requesterUid === uid) { patch({ phase: 'terminal', error: 'You cannot pay your own request.' }); return false; }
    if (!state.card) { patch({ phase: 'terminal', error: 'This test instrument is no longer available. Return to review and choose an eligible instrument.' }); return false; }
    return true;
  };
  const refresh = async () => {
    const review = await loadReview(api, requestId, uid, now());
    patch({ ...review, card: review.cards.find(card => card.id === cardId) || null });
    if ((review.request.status === 'completed' && complete(review.transaction)) || !ready()) return false;
    return true;
  };
  const confirm = async () => {
    patch({ phase: 'confirming' });
    try {
      const { data } = await api.qrAPI.confirmPayment(confirmation);
      if (!complete(data.transaction)) throw new Error('The confirmation response was incomplete. Checking the server record.');
    } catch (error) {
      // Every ambiguous response is reconciled. A timeout is not a failed debit.
      patch({ phase: 'uncertain', error: 'The result is not confirmed yet. Checking the server record.' });
      try { await reconcile(); } catch { patch({ phase: 'uncertain', error: 'We couldn’t confirm the result. Reconnect and check payment status before doing anything else.' }); }
      if (state.phase === 'uncertain' && error?.response?.status >= 400 && error.response.status < 500) {
        // Keep the exact body even after a rejected retry; never silently issue
        // another OTP or invent another operation after a confirmation attempt.
        patch({ error: `${paymentError(error)} Check payment status before leaving this payment.` });
      }
    }
  };
  const inspectSession = async () => {
    const { data } = await api.otpAPI.getOTPStatus(state.session.sessionId);
    if (data.session?.id !== state.session.sessionId || data.session.requestId !== requestId) throw new Error('Verification status is unavailable. Check payment status again.');
    const session = data.session;
    if (session.status === 'verified' && !session.isExpired) return true;
    if (session.status === 'consumed') { await reconcile(); return false; }
    patch({ phase: 'code', attemptsLeft: Math.max(0, session.maxAttempts - session.attempts),
      error: session.isExpired || ['expired', 'blocked', 'superseded'].includes(session.status)
        ? 'This verification code is no longer usable. Request a new code when the timer allows.'
        : 'The code has not been verified. Enter your code and try again.' });
    return false;
  };
  return {
    getState: () => state,
    dispose: () => { disposed = true; },
    initialize: () => run(async () => { if (await refresh()) patch({ phase: 'idle' }); }),
    send: (resend = false) => run(async () => {
      if (confirmation || ['verification_unknown', 'terminal', 'completed'].includes(state.phase) ||
        (state.session && !resend) || serverNow() < (state.resendAt || 0)) return;
      if (!await refresh()) return;
      try {
        const { data } = await (resend ? api.otpAPI.resendOTP(requestId) : api.otpAPI.sendOTP(requestId));
        if (!data.success || !data.sessionId || !Number.isFinite(new Date(data.expiresAt).getTime()) || !Number.isFinite(new Date(data.resendAt).getTime())) {
          throw new Error('Verification could not be started. Wait before requesting another code.');
        }
        patch({ phase: 'code', session: data, resendAt: new Date(data.resendAt).getTime(), attemptsLeft: null });
      } catch (error) {
        const retryAfter = error?.response?.data?.retryAfter;
        patch({ phase: state.session ? 'code' : 'idle', resendAt: serverNow() + (Number.isFinite(retryAfter) ? Math.max(1, retryAfter) : 60) * 1000 });
        throw error;
      }
    }),
    verify: code => run(async () => {
      if (confirmation || ['verification_unknown', 'terminal', 'completed'].includes(state.phase)) return;
      if (!/^\d{6}$/.test(code || '')) throw new Error('Enter the complete six-digit verification code.');
      if (!state.session) throw new Error('Request a verification code first.');
      if (!await refresh()) return;
      if (new Date(state.session.expiresAt).getTime() <= serverNow()) throw new Error('This verification code has expired. Request a new code.');
      patch({ phase: 'verifying' });
      let verified = false;
      try {
        const { data } = await api.otpAPI.verifyOTP(state.session.sessionId, code);
        verified = data.success === true && data.status === 'verified' && data.sessionId === state.session.sessionId && data.requestId === requestId;
        if (!verified) throw new Error('Verification status is unavailable.');
      } catch (error) {
        if (!error?.response || error.response.status >= 500 || error.response.status === 409) {
          patch({ phase: 'verification_unknown' });
          try { verified = await inspectSession(); } catch { patch({ phase: 'verification_unknown', error: 'Verification may have succeeded. Check payment status before requesting another code.' }); return; }
        } else {
          patch({ phase: 'code', attemptsLeft: error.response.data?.attemptsLeft ?? state.attemptsLeft });
          throw error;
        }
      }
      if (!verified) return;
      confirmation = Object.freeze({ requestId, cardId, sessionId: state.session.sessionId, idempotencyKey });
      await confirm();
    }),
    check: () => run(async () => {
      if (confirmation) return reconcile();
      if (state.phase === 'verification_unknown') {
        if (await inspectSession()) {
          confirmation = Object.freeze({ requestId, cardId, sessionId: state.session.sessionId, idempotencyKey });
          await confirm();
        }
        return;
      }
      await reconcile();
    }),
    retryConfirmation: () => run(async () => {
      if (!confirmation) return;
      await reconcile();
      if (state.phase === 'uncertain') await confirm();
    }),
    resume: () => run(async () => {
      if (confirmation) return reconcile();
      if (state.session) {
        const data = await readRequest();
        if (!(data.paymentRequest.status === 'completed' && complete(data.transaction)) && !terminal(data.paymentRequest)) {
          // Verified status after an interrupted verify still requires the
          // user's explicit check action before continuing confirmation.
          patch({ phase: 'verification_unknown', error: 'Welcome back. Check payment status to resume this verification.' });
        }
      } else if (await refresh()) patch({ phase: 'idle' });
    }),
  };
}
