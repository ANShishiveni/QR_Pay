import React, { useRef, useState } from 'react';
import { AppScreen, AppHeader, AppCard, AppText, AppButton, AppTextField, MoneyInput, DemoModeBadge, FormError, SecurityPrompt } from '../../components/ui';
import { qrAPI } from '../../config/api';
import { parseAmountMinor } from '../../utils/money';
import { checkedRequestResponse } from './requestUtils';

export default function QRGenerateScreen({ navigation, route }) {
  const prefill = route?.params?.prefill;
  const [amount, setAmount] = useState(Number.isSafeInteger(prefill?.amountMinor) ? (prefill.amountMinor / 100).toFixed(2) : '');
  const [reference, setReference] = useState(typeof prefill?.reference === 'string' ? prefill.reference.slice(0, 80) : '');
  const [description, setDescription] = useState(typeof prefill?.description === 'string' ? prefill.description.slice(0, 160) : '');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current || uncertain) return;
    const next = {}; let amountMinor;
    try { amountMinor = parseAmountMinor(amount); } catch (error) { next.amount = error.message; }
    if (reference.trim().length > 80 || /[\u0000-\u001f<>]/.test(reference)) next.reference = 'Use a short reference without special markup (up to 80 characters).';
    if (description.trim().length > 160 || /[\u0000-\u001f<>]/.test(description)) next.description = 'Use a short note without special markup (up to 160 characters).';
    setErrors(next); setFailure('');
    if (Object.keys(next).length) return;
    submitting.current = true; setBusy(true);
    let accepted = false;
    try {
      const { data } = await qrAPI.generateQR({ amountMinor, currency: 'NAD', reference: reference.trim(), description: description.trim(), expiresIn: 300 });
      accepted = true;
      checkedRequestResponse(data, data.paymentRequest?.id);
      navigation.replace('QRRequestDetails', { requestId: data.paymentRequest.id });
    } catch (error) {
      if (accepted || error.isNetworkError || error.response?.status >= 500) {
        setUncertain(true);
        setFailure('The connection ended before we could confirm creation. Check your requests before creating another one.');
      } else setFailure(error.response?.data?.error || error.message || 'Your request could not be created. Try again.');
    } finally { submitting.current = false; setBusy(false); }
  };
  return <AppScreen>
    <AppHeader kicker="REQUEST PAYMENT" title="Let them scan. You receive." subtitle="Create a five-minute request for a simulated payment." onBack={() => navigation.goBack()} />
    <DemoModeBadge />
    <AppCard style={{ gap: 18 }}>
      <MoneyInput value={amount} onChangeText={value => { setAmount(value); setErrors(current => ({ ...current, amount: '' })); }} error={errors.amount} editable={!busy && !uncertain} />
      <AppTextField label="Reference (optional)" value={reference} onChangeText={setReference} error={errors.reference} maxLength={80}
        placeholder="What is this request for?" hint="Keep personal or sensitive details out of your reference." editable={!busy && !uncertain} />
      <AppTextField label="Note (optional)" value={description} onChangeText={setDescription} error={errors.description} maxLength={160}
        hint="Shown to your payer when they review the request." editable={!busy && !uncertain} />
      <FormError message={failure} />
      {uncertain ? <AppButton title="Check my requests" onPress={() => navigation.replace('QRRequests')} icon="list-outline" />
        : <AppButton title="Create QR request" onPress={submit} loading={busy} icon="qr-code-outline" />}
    </AppCard>
    <SecurityPrompt title="No card needed to request" message="Your payer chooses a test instrument and approves the simulation. Creating a QR code never moves real money." />
    <AppText variant="caption" color="textSecondary">Each new request has its own QR code. Expired or cancelled codes cannot be used again.</AppText>
  </AppScreen>;
}
