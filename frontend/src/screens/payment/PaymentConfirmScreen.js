import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { paymentAPI, qrAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { AppScreen, AppHeader, AppText, AppButton, AppCard, DemoModeBadge, AmountDisplay,
  MaskedCard, RequestCountdown, StatusBadge, LoadingSkeleton, ErrorState, EmptyState, FormError, SecurityPrompt } from '../../components/ui';
import { loadReview, paymentError } from '../../features/payments/paymentFlow';
import { formatMoney } from '../../utils/money';
import biometricService from '../../services/biometricService';

export default function PaymentConfirmScreen({ route, navigation }) {
  // Compatibility DTOs supply only an ID. Display values come from the server.
  const requestId = route.params?.requestId || route.params?.paymentRequest?.id;
  const { user } = useAuth();
  const uid = user?.uid;
  const [review, setReview] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [device, setDevice] = useState({ status: 'disabled', message: '' });
  const [deviceFeedback, setDeviceFeedback] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  const moved = useRef(false);
  const idempotencyKey = useRef(null);
  const deviceStatus = useCallback(async () => {
    if (user?.preferences?.biometrics !== true) return { status: 'disabled', message: '' };
    if (Platform.OS === 'web') return { status: 'unavailable', message: 'Device confirmation is unavailable on the web. Continue with server verification to authorize this simulation.' };
    try {
      if (!await biometricService.isBiometricEnabled()) return { status: 'disabled', message: 'Optional device confirmation is not enabled on this device. Server verification is still required.' };
      const capability = await biometricService.checkAvailability();
      return capability.canUseBiometrics && capability.isAvailable && capability.isEnrolled
        ? { status: 'ready', message: 'Your enrolled biometric will confirm this device before server verification. It cannot authorize a payment on its own.' }
        : { status: 'unavailable', message: 'An enrolled biometric is unavailable on this device. You can continue with server verification; device confirmation is optional.' };
    } catch { return { status: 'unavailable', message: 'Device confirmation is unavailable right now. You can continue with server verification; device confirmation is optional.' }; }
  }, [user?.preferences?.biometrics]);
  const refresh = useCallback(async () => {
    if (busy.current || !mounted.current) return;
    busy.current = true;
    setLoading(true); setError(''); setDeviceFeedback('');
    try {
      if (!requestId || !uid) throw new Error('Scan a payment request to begin.');
      const [next, capability] = await Promise.all([loadReview({ qrAPI, paymentAPI }, requestId, uid), deviceStatus()]);
      if (!mounted.current) return;
      setReview(next);
      setDevice(capability);
      setExpired(new Date(next.request.expiresAt).getTime() <= new Date(next.serverTime).getTime());
      setCardId(current => next.cards.some(card => card.id === current) ? current : (next.cards.find(card => card.isDefault) || next.cards[0])?.id || null);
    } catch (failure) { if (mounted.current) setError(paymentError(failure)); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  }, [requestId, uid, deviceStatus]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const focus = navigation.addListener?.('focus', () => { moved.current = false; refresh(); });
    const active = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { mounted.current = false; focus?.(); active.remove(); };
  }, [navigation, refresh]);
  const proceed = async () => {
    if (busy.current || moved.current || !cardId || !review) return;
    busy.current = true; setLoading(true); setError(''); setDeviceFeedback('');
    try {
      const validate = next => {
        setReview(next);
        if (next.request.status !== 'pending' || new Date(next.request.expiresAt).getTime() <= new Date(next.serverTime).getTime()) {
          setExpired(true); throw new Error('This request is no longer available. Ask for a new QR request.');
        }
        if (next.request.requesterUid === uid) throw new Error('You cannot pay your own request.');
        if (!next.cards.some(card => card.id === cardId)) { setCardId(null); throw new Error('Choose an available test instrument before continuing.'); }
        if (['amountMinor', 'requesterUid', 'requesterName', 'reference'].some(key => next.request[key] !== review.request[key])) {
          throw new Error('The request details changed. Review the updated details before continuing.');
        }
      };
      const [next, capability] = await Promise.all([loadReview({ qrAPI, paymentAPI }, requestId, uid), deviceStatus()]);
      if (!mounted.current) return;
      validate(next); setDevice(capability);
      // A newly unavailable device gets a readable explanation before another
      // deliberate tap continues through the required server verification.
      if (device.status === 'ready' && capability.status !== 'ready') return;
      if (capability.status === 'ready') {
        let result;
        try { result = await biometricService.authenticate({ promptMessage: 'Confirm this device before server verification', disableDeviceFallback: true, cancelLabel: 'Stay on review' }); }
        catch { result = { success: false }; }
        if (!mounted.current) return;
        if (!result.success) { setDeviceFeedback('Device confirmation was cancelled or unsuccessful. You can stay here and try again. Server verification is still required.'); return; }
        // A native prompt can remain open past request expiry or card removal.
        // Its result is local only: re-read every server-controlled input.
        const afterPrompt = await loadReview({ qrAPI, paymentAPI }, requestId, uid);
        if (!mounted.current) return;
        validate(afterPrompt);
      }
      idempotencyKey.current ||= Crypto.randomUUID();
      moved.current = true;
      navigation.navigate('OTPVerification', { requestId, cardId, idempotencyKey: idempotencyKey.current });
    } catch (failure) { if (mounted.current) setError(paymentError(failure)); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  };
  const request = review?.request;
  const unavailable = request && (request.status !== 'pending' || expired || request.requesterUid === uid);
  return <AppScreen contentStyle={{ maxWidth: 640, gap: 20 }}>
    <AppHeader title="Review payment" subtitle="Check the recipient, amount and test instrument before verification." onBack={() => navigation.goBack()} />
    <DemoModeBadge />
    {!review ? loading ? <LoadingSkeleton label="Loading payment review" /> : <ErrorState message={error} onRetry={refresh} /> : <>
      <AppCard style={{ gap: 18 }}>
        <StatusBadge status={expired && request.status === 'pending' ? 'expired' : request.status} />
        <AmountDisplay amountMinor={request.amountMinor} label="You will simulate paying" />
        <View style={{ gap: 5 }}><AppText variant="caption" color="textSecondary">TO</AppText><AppText variant="h2">{request.requesterName || 'NamPay requester'}</AppText></View>
        <AppText color="textSecondary">{request.reference || 'No reference'}</AppText>
        {request.description ? <AppText>{request.description}</AppText> : null}
        <RequestCountdown expiresAt={request.expiresAt} serverTime={review.serverTime} onExpire={() => setExpired(true)} />
      </AppCard>
      {unavailable ? <EmptyState title={request.requesterUid === uid ? 'This is your request' : 'Request unavailable'}
        message={request.requesterUid === uid ? 'Share this QR with another demo account to receive a simulated payment.' : `This request is ${expired && request.status === 'pending' ? 'expired' : request.status}. Ask for a fresh request.`}
        actionLabel={request.status === 'completed' && review.transaction ? 'View payment result' : 'Back to scanner'}
        onAction={() => request.status === 'completed' && review.transaction
          ? navigation.navigate('PaymentResult', { requestId, transactionId: review.transaction.id }) : navigation.goBack()} /> : <>
        <AppText variant="h3">Pay with a test instrument</AppText>
        {review.cards.length ? review.cards.map(card => <View key={card.id} style={{ gap: 5 }}>
          <MaskedCard card={card} selected={card.id === cardId} onPress={() => { if (!busy.current) setCardId(card.id); }} />
          {card.id === cardId ? <AppText variant="caption" color="primary" accessibilityLiveRegion="polite">Selected test instrument</AppText> : null}
        </View>) : <EmptyState title="Add a test instrument" message="Choose a predefined demo instrument before confirming. No real card details are needed."
          actionLabel="Manage test instruments" onAction={() => navigation.navigate('Cards')} />}
        <AppCard style={{ gap: 10 }}><AppText>Simulation fee: N$0.00</AppText><AppText variant="h3">Total: {formatMoney(request.amountMinor)}</AppText></AppCard>
        {device.message || deviceFeedback ? <SecurityPrompt title="Optional device confirmation" message={deviceFeedback || device.message} /> : null}
        <FormError message={error} />
        <AppButton title="Continue to verification" onPress={proceed} loading={loading} disabled={!cardId || !!error} icon="shield-checkmark-outline" />
        {error ? <AppButton title="Refresh payment review" variant="secondary" onPress={refresh} disabled={loading} /> : null}
      </>}
      <SecurityPrompt title="A demonstration, with no real money" message="Verification authorizes one simulated payment for this amount and request. Your test instrument will not be charged." />
    </>}
  </AppScreen>;
}
