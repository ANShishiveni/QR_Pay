import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { paymentAPI, qrAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { AppScreen, AppHeader, AppButton, AppText, PaymentResult, ReceiptView, FormError, LoadingSkeleton } from '../../components/ui';
import { confirmedTransaction, paymentError, validateRequest } from '../../features/payments/paymentFlow';
import { shareReceipt } from '../../services/receipts/shareReceipt';

export default function PaymentResultScreen({ route, navigation }) {
  const { user } = useAuth();
  const { requestId, transactionId } = route.params || {};
  const [record, setRecord] = useState(null);
  const [request, setRequest] = useState(null);
  const [status, setStatus] = useState('unknown');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (busy.current || !mounted.current) return;
    busy.current = true; setLoading(true); setError('');
    try {
      let transaction;
      let paymentRequest;
      if (requestId) {
        const { data } = await qrAPI.getRequest(requestId);
        paymentRequest = validateRequest(data.paymentRequest, requestId);
        transaction = data.transaction;
      } else if (transactionId) {
        const { data } = await paymentAPI.getTransaction(transactionId);
        transaction = data.transaction;
      } else throw new Error('A request or transaction is needed to check this result.');
      if (!mounted.current) return;
      setRequest(paymentRequest || null);
      if ((!paymentRequest || paymentRequest.status === 'completed') && confirmedTransaction(transaction, { uid: user?.uid, requestId, transactionId, amountMinor: paymentRequest?.amountMinor })) {
        setRecord(transaction); setStatus('completed');
      } else {
        setRecord(null);
        setStatus(['cancelled', 'expired', 'failed'].includes(paymentRequest?.status) ? paymentRequest.status : 'unknown');
        if (paymentRequest?.status === 'completed') setError('This request is completed, but an authorized receipt for this account is unavailable. We have not confirmed a payment from you.');
        else if (!paymentRequest) setError('A completed simulated transaction could not be verified.');
      }
    } catch (failure) {
      if (mounted.current) setError(paymentError(failure));
    } finally { busy.current = false; if (mounted.current) setLoading(false); }
  }, [requestId, transactionId, user?.uid]);
  useEffect(() => {
    mounted.current = true; refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const focus = navigation.addListener?.('focus', refresh);
    return () => { mounted.current = false; listener.remove(); focus?.(); };
  }, [refresh, navigation]);
  const handleShareReceipt = async () => {
    if (!record) return;
    try {
      await shareReceipt(record);
    } catch { setError('The receipt could not be shared. You can still view it here.'); }
  };
  return <AppScreen contentStyle={{ maxWidth: 640, gap: 20 }}>
    <AppHeader title="Payment result" subtitle="Based on your authorized server record." />
    {loading && !request && !record ? <LoadingSkeleton label="Checking payment result" /> : <PaymentResult status={status}
      amountMinor={record?.amountMinor ?? request?.amountMinor} recipient={record?.requesterName || request?.requesterName}
      onReceipt={record ? () => setReceiptVisible(true) : undefined} />}
    <FormError message={error} />
    {status !== 'completed' || error ? <AppButton title="Check payment status" onPress={refresh} loading={loading} variant="secondary" /> : null}
    {status !== 'completed' && request ? <AppText color="textSecondary">Latest request status: {request.status}</AppText> : null}
    {record && receiptVisible ? <ReceiptView transaction={record} onShare={handleShareReceipt} /> : null}
    <AppButton title="Back to home" onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })} variant="ghost" />
  </AppScreen>;
}
