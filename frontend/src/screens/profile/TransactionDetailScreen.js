import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { paymentAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { AppScreen, AppHeader, AppText, AppButton, AppCard, DemoModeBadge, AmountDisplay, StatusBadge,
  ReceiptView, LoadingSkeleton, ErrorState, SecurityPrompt } from '../../components/ui';
import { activityTransaction } from '../../features/activity/activityModel';
import { shareReceipt } from '../../services/receipts/shareReceipt';
import { formatDate } from '../../utils/money';

export default function TransactionDetailScreen({ route, navigation }) {
  const transactionId = route.params?.transactionId;
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState({ record: null, uid: null, id: null, loading: true, error: '' });
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const shareBusy = useRef(false);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setState({ record: null, uid, id: transactionId, loading: true, error: '' });
    setReceiptVisible(false); setShareMessage('');
    try {
      if (!transactionId || !uid) throw new Error('Open a transaction from your activity to view its details.');
      const { data } = await paymentAPI.getTransaction(transactionId);
      const record = activityTransaction(data.transaction, uid, transactionId);
      if (mounted.current && current === sequence.current) setState({ record, uid, id: transactionId, loading: false, error: '' });
    } catch (error) {
      if (mounted.current && current === sequence.current) setState({ record: null, uid, id: transactionId, loading: false,
        error: error?.response?.status === 404 ? 'This transaction is unavailable for your account.'
          : error?.response?.data?.error || error?.message || 'Transaction details could not be loaded.' });
    }
  }, [transactionId, uid]);
  useEffect(() => {
    mounted.current = true; load();
    let focused = navigation?.isFocused?.() !== false;
    const focus = navigation.addListener?.('focus', () => { focused = true; load(); });
    const blur = navigation.addListener?.('blur', () => { focused = false; });
    const app = AppState.addEventListener('change', value => { if (value === 'active' && focused) load(); });
    return () => { mounted.current = false; sequence.current += 1; focus?.(); blur?.(); app.remove(); };
  }, [load, navigation]);
  const record = state.uid === uid && state.id === transactionId ? state.record : null;
  const completed = record && ['completed', 'succeeded'].includes(record.status);
  const share = async () => {
    if (shareBusy.current || !completed) return;
    shareBusy.current = true; setSharing(true); setShareMessage('');
    try {
      const result = await shareReceipt(record);
      if (mounted.current) setShareMessage(result.action === 'saved' ? 'Simulated receipt downloaded.' : result.action === 'copied' ? 'Simulated receipt copied as text.' : result.action === 'shared' ? 'Simulated receipt shared.' : '');
    } catch (error) { if (mounted.current) setShareMessage(error.message || 'The receipt could not be shared. Try again.'); }
    finally { shareBusy.current = false; if (mounted.current) setSharing(false); }
  };
  return <AppScreen contentStyle={{ maxWidth: 680, gap: 20 }}>
    <AppHeader title="Transaction details" subtitle="Your authorized record of this simulation." onBack={() => navigation.goBack()} />
    <DemoModeBadge />
    {!record ? state.loading || state.id !== transactionId || state.uid !== uid ? <LoadingSkeleton label="Loading transaction details" />
      : <ErrorState title="Transaction unavailable" message={state.error} onRetry={load} retryLabel="Retry transaction details" /> : <>
      <AppCard style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
          <StatusBadge status={record.status === 'succeeded' ? 'completed' : record.status} />
          <AppText variant="label">{record.role === 'sent' ? 'Sent' : 'Received'} · Simulation</AppText>
        </View>
        <AmountDisplay amountMinor={record.amountMinor} label={record.role === 'sent' ? 'You simulated sending' : 'You simulated receiving'} />
        {[['Transaction ID', record.id], ['From', record.payerName], ['To', record.requesterName],
          ['Reference', record.reference || 'No reference'], ['Method', record.methodLabel],
          ['Date · Africa/Windhoek', formatDate(record.completedAt || record.timestamp || record.createdAt)]].map(([label, value]) =>
          <View key={label} style={{ gap: 4 }}><AppText variant="caption" color="textSecondary">{label}</AppText><AppText selectable>{value}</AppText></View>)}
        {record.description ? <AppText color="textSecondary">{record.description}</AppText> : null}
      </AppCard>
      {record.legacy ? <SecurityPrompt title="Historical simulation" message="This retained transaction may predate QR requests. Its original record remains available without creating a new request." /> : null}
      {completed ? <>
        <AppButton title={receiptVisible ? 'Hide simulated receipt' : 'View simulated receipt'} variant="secondary" onPress={() => setReceiptVisible(value => !value)} icon="receipt-outline" />
        {receiptVisible ? <ReceiptView transaction={{ ...record, status: record.status === 'succeeded' ? 'completed' : record.status }} /> : null}
        <AppButton title="Share simulated receipt" onPress={share} loading={sharing} icon="share-outline" />
        {shareMessage ? <AppText accessibilityLiveRegion="polite">{shareMessage}</AppText> : null}
      </> : <SecurityPrompt title="Receipt not available" message="A completion receipt is available only after the server confirms a completed simulation." />}
      <SecurityPrompt title="No real funds transferred" message="This transaction is a NamPay demonstration. It is not a bank transfer or proof of settlement." />
    </>}
  </AppScreen>;
}
