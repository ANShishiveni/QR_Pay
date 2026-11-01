import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { otpAPI, paymentAPI, qrAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { AppScreen, AppHeader, AppText, AppButton, AppCard, AppTextField, DemoModeBadge, AmountDisplay,
  MaskedCard, RequestCountdown, FormError, SecurityPrompt, LoadingSkeleton } from '../../components/ui';
import { createPaymentFlow } from '../../features/payments/paymentFlow';

export default function OTPVerificationScreen({ route, navigation }) {
  const { user } = useAuth();
  const { requestId, cardId } = route.params || {};
  const key = useRef(route.params?.idempotencyKey || null);
  if (!key.current) key.current = Crypto.randomUUID();
  const [flow, setFlow] = useState({ phase: 'loading', busy: true, error: '' });
  const [code, setCode] = useState('');
  const [clock, setClock] = useState(Date.now());
  const controller = useRef(null);
  useEffect(() => {
    let focused = navigation.isFocused?.() !== false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let pendingResult = null;
    const showResult = transaction => {
      if (!focused || !foreground) { pendingResult = transaction; return; }
      pendingResult = null;
      setCode('');
      navigation.replace('PaymentResult', { requestId, transactionId: transaction.id || transaction.transactionId });
    };
    const instance = createPaymentFlow({ api: { otpAPI, paymentAPI, qrAPI }, requestId, cardId, uid: user?.uid,
      idempotencyKey: key.current, onChange: setFlow, onComplete: showResult });
    controller.current = instance;
    if (focused && foreground) instance.initialize();
    const resume = () => {
      if (!focused || !foreground) return;
      if (pendingResult) showResult(pendingResult);
      else instance.resume(); // Reads current status; never retries a confirmation.
    };
    const focus = navigation.addListener?.('focus', () => { focused = true; resume(); });
    const blur = navigation.addListener?.('blur', () => { focused = false; setCode(''); });
    const active = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      setCode('');
      resume();
    });
    const leave = navigation.addListener?.('beforeRemove', event => {
      if (['verifying', 'confirming', 'uncertain', 'verification_unknown'].includes(instance.getState().phase)) event.preventDefault();
    });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => { instance.dispose(); active.remove(); focus?.(); blur?.(); leave?.(); clearInterval(timer); };
  }, [requestId, cardId, user?.uid, navigation]);
  const serverNow = clock + (flow.offset || 0);
  const resendSeconds = Math.max(0, Math.ceil(((flow.resendAt || 0) - serverNow) / 1000));
  const sessionExpired = flow.session && new Date(flow.session.expiresAt).getTime() <= serverNow;
  const requestExpired = flow.request && new Date(flow.request.expiresAt).getTime() <= serverNow;
  const uncertain = ['uncertain', 'verification_unknown'].includes(flow.phase);
  const submitting = ['verifying', 'confirming'].includes(flow.phase);
  const terminal = flow.phase === 'terminal';
  const verify = () => { const submitted = code; setCode(''); controller.current?.verify(submitted); };
  return <AppScreen contentStyle={{ maxWidth: 640, gap: 20 }}>
    <AppHeader title="Verify this payment" subtitle="Authorize one simulated payment. No real funds will be transferred."
      onBack={uncertain || submitting ? undefined : () => navigation.goBack()} />
    <DemoModeBadge />
    {flow.request ? <AppCard style={{ gap: 14 }}>
      <AmountDisplay amountMinor={flow.request.amountMinor} label="Simulated payment total" />
      <AppText variant="h3">To {flow.request.requesterName || 'NamPay requester'}</AppText>
      <AppText color="textSecondary">{flow.request.reference || 'No reference'}</AppText>
      <RequestCountdown expiresAt={flow.request.expiresAt} serverTime={flow.serverTime} />
    </AppCard> : flow.busy ? <LoadingSkeleton label="Checking payment authorization" /> : null}
    {flow.card ? <MaskedCard card={flow.card} selected /> : null}
    <FormError message={flow.error} />
    {submitting ? <LoadingSkeleton label={flow.phase === 'verifying' ? 'Verifying code' : 'Confirming simulated payment'} lines={2} /> : null}
    {uncertain ? <AppCard style={{ gap: 16 }}>
      <AppText variant="h3">Checking your payment</AppText>
      <AppText>Keep this payment open. A connection loss does not mean it failed. We will check the server before showing a result.</AppText>
      <AppButton title="Check payment status" variant="secondary" onPress={() => controller.current?.check()} loading={flow.busy} />
      {flow.phase === 'uncertain' ? <AppButton title="Retry same confirmation" onPress={() => controller.current?.retryConfirmation()} disabled={flow.busy} /> : null}
    </AppCard> : null}
    {!terminal && !uncertain && !submitting && flow.request ? <>
      {flow.session ? <View style={{ gap: 16 }}>
        <SecurityPrompt title={flow.session.provider === 'mock' ? 'Local demo verification' : 'Check your verified destination'}
          message={flow.session.provider === 'mock' ? 'Use the six-digit code in your private local demo inbox. No SMS was sent. Ask your demo operator for the code.' : `A code was sent to ${flow.session.maskedDestination || 'your verified account destination'}.`} />
        <AppTextField label="Payment verification code" value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" textContentType="oneTimeCode"
          secureTextEntry maxLength={6} editable={!flow.busy && !sessionExpired && !requestExpired}
          hint={sessionExpired ? 'This code has expired.' : 'Enter all six digits. The code authorizes only this request.'} />
        {Number.isFinite(flow.attemptsLeft) ? <AppText accessibilityLiveRegion="polite">{flow.attemptsLeft} verification attempts remaining</AppText> : null}
        <AppButton title="Verify and confirm payment" onPress={verify} loading={flow.busy}
          disabled={code.length !== 6 || !!sessionExpired || !!requestExpired || flow.attemptsLeft === 0} />
        <AppButton title="Resend verification code" variant="ghost" onPress={() => { setCode(''); controller.current?.send(true); }}
          disabled={resendSeconds > 0 || flow.busy || !!requestExpired} />
      </View> : <AppButton title="Send verification code" onPress={() => controller.current?.send()} loading={flow.busy}
        disabled={resendSeconds > 0 || !!requestExpired} icon="shield-checkmark-outline" />}
      {resendSeconds > 0 ? <AppText variant="caption" color="textSecondary">A new code is available in {resendSeconds}s.</AppText> : null}
      {requestExpired ? <FormError message="The request has expired. Return to the scanner and ask for a fresh QR request." /> : null}
    </> : null}
    {terminal ? <AppButton title="Return to payment review" variant="secondary" onPress={() => navigation.goBack()} /> : null}
    {!flow.request && !flow.busy ? <AppButton title="Retry payment review" onPress={() => controller.current?.initialize()} /> : null}
    <SecurityPrompt title="Verification stays on the server" message="Your device unlock cannot authorize this payment. The code, request, amount and account must all pass server verification." />
  </AppScreen>;
}
