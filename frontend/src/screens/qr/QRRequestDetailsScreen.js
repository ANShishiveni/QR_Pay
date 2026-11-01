import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Platform, RefreshControl, View } from 'react-native';
import { AppScreen, AppHeader, AppCard, AppText, AppButton, AmountDisplay, DemoModeBadge, StatusBadge,
  RequestCountdown, ConfirmBottomSheet, FormError, ErrorState, LoadingSkeleton, SecurityPrompt } from '../../components/ui';
import { qrAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/money';
import useFocusedResource from './useFocusedResource';
import { checkedRequestResponse, requestImage, requestPrefill } from './requestUtils';
import { shareRequestQr, saveRequestQr } from './shareRequestQr';

const descriptions = {
  pending: 'Show this QR to your payer. They will review and approve the simulated payment.',
  processing: 'The server is checking this request. Wait for the confirmed result.',
  completed: 'A simulated payment was recorded. No real funds were transferred.',
  expired: 'This QR has expired and can no longer be paid.',
  cancelled: 'You cancelled this request. This QR can no longer be paid.',
  failed: 'This request did not complete. Check its details before creating another one.',
};
export default function QRRequestDetailsScreen({ navigation, route }) {
  const requestId = route?.params?.requestId;
  const { user } = useAuth();
  const load = useCallback(async () => {
    if (typeof requestId !== 'string' || !requestId) throw new Error('Choose a request from your request list.');
    return checkedRequestResponse((await qrAPI.getRequest(requestId)).data, requestId);
  }, [requestId]);
  const state = useFocusedResource(load, navigation, 5000);
  const data = state.data?.paymentRequest.id === requestId ? state.data : null;
  const request = data?.paymentRequest;
  const [expiredLocally, setExpiredLocally] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [cancellationUnknown, setCancellationUnknown] = useState(false);
  const mutation = useRef(false);
  const lastStatus = useRef(null);
  const owned = Boolean(request && request.requesterUid === user?.uid);
  const active = owned && request?.status === 'pending' && !expiredLocally && !state.error && !cancellationUnknown;
  const terminal = request && ['completed', 'expired', 'cancelled', 'failed'].includes(request.status);

  useEffect(() => {
    if (!request) return;
    setExpiredLocally(Date.parse(request.expiresAt) <= Date.parse(data.serverTime));
    if (request.status !== 'pending') { setCancellationUnknown(false); setConfirmCancel(false); }
    if (lastStatus.current && lastStatus.current !== request.status) AccessibilityInfo.announceForAccessibility?.(`Request ${request.status === 'completed' ? 'received a simulated payment' : request.status}`);
    lastStatus.current = request.status;
  }, [request?.status, request?.expiresAt, data?.serverTime]);
  const onExpire = useCallback(() => { setExpiredLocally(true); state.refresh(); }, [state.refresh]);

  const cancel = async () => {
    if (mutation.current || !owned || request.status !== 'pending') return;
    mutation.current = true; setCancelling(true); setFailure(''); setNotice('');
    try {
      const response = await qrAPI.cancelRequest(requestId);
      state.replace(checkedRequestResponse(response.data, requestId));
      setCancellationUnknown(false); setConfirmCancel(false);
    } catch (error) {
      const unknown = error.isNetworkError || error.response?.status >= 500;
      setCancellationUnknown(unknown);
      setFailure(unknown ? 'Cancellation has not been confirmed. Check the latest status before sharing this QR again.'
        : error.response?.data?.error || error.message || 'This request could not be cancelled.');
      await state.refresh(true);
      setConfirmCancel(false);
    } finally { mutation.current = false; setCancelling(false); }
  };
  const share = async (save = false) => {
    if (mutation.current || !active) return;
    mutation.current = true; setSharing(true); setFailure(''); setNotice('');
    try {
      // Check status immediately before exporting; a paid/cancelled QR is hidden.
      const fresh = await state.refresh(true);
      if (!fresh || fresh.paymentRequest.status !== 'pending' || Date.parse(fresh.paymentRequest.expiresAt) <= Date.parse(fresh.serverTime)) throw new Error('This request is no longer available to share. Check its latest status.');
      requestImage(fresh);
      const result = await (save ? saveRequestQr(fresh) : shareRequestQr(fresh));
      if (result.action === 'downloaded') setNotice('QR image download started. The request still expires at the time shown.');
    } catch (error) { setFailure(error.message || 'The QR image could not be shared. Try again.'); }
    finally { mutation.current = false; setSharing(false); }
  };

  let image;
  if (active) { try { image = requestImage(data); } catch { /* Render a recoverable unavailable state. */ } }
  return <AppScreen refreshControl={<RefreshControl refreshing={state.refreshing && !state.loading} onRefresh={() => state.refresh()} />}>
    <AppHeader kicker="PAYMENT REQUEST" title="Your QR request" onBack={() => navigation.goBack()}
      right={<DemoModeBadge compact />} />
    {state.loading || (!data && !state.error) ? <LoadingSkeleton label="Loading request details" /> : !data ? <ErrorState title="Request unavailable" message={state.error} onRetry={() => state.refresh()} /> : <>
      <AppCard style={{ gap: 16, alignItems: 'center' }}>
        <StatusBadge status={request.status} label={request.status === 'completed' ? 'Simulated payment received' : undefined} />
        <AmountDisplay amountMinor={request.amountMinor} label="Requested amount" />
        {request.reference ? <AppText variant="label" style={{ textAlign: 'center' }}>{request.reference}</AppText> : null}
        {request.description ? <AppText color="textSecondary" style={{ textAlign: 'center' }}>{request.description}</AppText> : null}
        <AppText color="textSecondary" style={{ textAlign: 'center' }}>{descriptions[request.status]}</AppText>
        {request.status === 'pending' ? <RequestCountdown expiresAt={request.expiresAt} serverTime={data.serverTime} onExpire={onExpire} /> : null}
        {image ? <View style={{ width: '100%', maxWidth: 320, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 16 }}>
          <Image source={{ uri: image }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="contain"
            accessibilityLabel="Payment request QR code" testID="request-qr-image" />
        </View> : null}
        {owned && request.status === 'pending' && !image && !state.error ? <AppText color="textSecondary" accessibilityLiveRegion="polite">
          {expiredLocally ? 'The countdown has ended. Checking the server for the final status.' : cancellationUnknown ? 'Sharing is paused until cancellation is resolved.' : 'The QR image is unavailable. Refresh the request to try again.'}
        </AppText> : null}
        <AppText variant="caption" color="textSecondary">Created {formatDate(request.createdAt)}</AppText>
        <AppText variant="caption" color="textSecondary">Expires {formatDate(request.expiresAt)}</AppText>
      </AppCard>
      <FormError message={state.error ? `The current status could not be checked. ${state.error}` : failure} />
      {notice ? <AppText accessibilityLiveRegion="polite" color="textSecondary">{notice}</AppText> : null}
      {active ? <>
        <AppButton title="Share QR" icon="share-outline" onPress={() => share()} loading={sharing} disabled={cancelling || !image} />
        {Platform.OS === 'web' ? <AppButton title="Save QR image" icon="download-outline" variant="secondary" onPress={() => share(true)} disabled={sharing || cancelling || !image} />
          : <AppText variant="caption" color="textSecondary">The system share sheet lets you choose a supported app or save destination. Gallery access is not required.</AppText>}
      </> : null}
      {owned && request.status === 'pending' && !expiredLocally ? <AppButton title={cancellationUnknown ? 'Retry cancellation' : 'Cancel request'} variant="secondary"
        onPress={() => setConfirmCancel(true)} disabled={sharing || cancelling || Boolean(state.error)} /> : null}
      <AppButton title="Check status" variant="ghost" icon="refresh-outline" onPress={() => state.refresh(true)} loading={state.refreshing} disabled={sharing || cancelling} />
      {request.status === 'completed' && data.transaction?.id ? <AppButton title="View simulated receipt" icon="receipt-outline"
        onPress={() => navigation.navigate('PaymentResult', { requestId, transactionId: data.transaction.id })} /> : null}
      {owned && terminal ? <AppButton title="Create a new request" icon="add-outline" onPress={() => navigation.navigate('QRGenerate', { prefill: requestPrefill(request) })} /> : null}
      <AppButton title="View all requests" variant="ghost" onPress={() => navigation.navigate('QRRequests')} />
      <SecurityPrompt title="A request is not a payment" message="Only the server can confirm that a simulation was completed. No real funds move, and a QR image is not proof of settlement." />
      <ConfirmBottomSheet visible={confirmCancel} title="Cancel this QR request?" message="The existing QR will stop accepting simulated payments. You can create a new request later."
        confirmLabel="Cancel this request" destructive loading={cancelling} onConfirm={cancel} onCancel={() => setConfirmCancel(false)} />
    </>}
  </AppScreen>;
}
