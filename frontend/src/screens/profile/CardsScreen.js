import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { AppScreen, AppHeader, AppText, AppCard, AppButton, DemoModeBadge, MaskedCard, StatusBadge, SecurityPrompt, FormError, LoadingSkeleton, EmptyState, ErrorState, ConfirmBottomSheet } from '../../components/ui';
import { paymentAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import useFocusedResource from '../qr/useFocusedResource';
import { checkedCards, checkedTestInstruments, cardAvailability, cardOperationApplied } from './cardModel';

const successMessage = { add: 'Test card added.', remove: 'Test card removed.', default: 'Default test card updated.' };

export default function CardsScreen({ navigation }) {
  const { user } = useAuth();
  const loadCards = useCallback(async () => checkedCards((await paymentAPI.getCards()).data, user?.uid), [user?.uid]);
  const loadCatalog = useCallback(async () => checkedTestInstruments((await paymentAPI.getTestInstruments()).data), []);
  const state = useFocusedResource(loadCards, navigation, 60000);
  const catalog = useFocusedResource(loadCatalog, navigation, 300000);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const operationRef = useRef(null);
  const cards = state.data?.cards || [];
  const available = (catalog.data || []).filter(item => !cards.some(card => card.testCardId === item.id));
  const locked = busy || Boolean(uncertain) || Boolean(state.error) || state.loading;

  const finish = useCallback((operation, current) => {
    const applied = cardOperationApplied(operation, current.cards);
    setUncertain(null); operationRef.current = null;
    setMessage(applied ? successMessage[operation.type] : '');
    setError(applied ? '' : 'That change is not present in your latest card list. Review the cards below before trying again.');
    if (applied && operation.type === 'add') { setAdding(false); setSelectedId(null); }
  }, []);
  const mutate = async operation => {
    if (operationRef.current || locked) return;
    operationRef.current = operation; setBusy(true); setMessage(''); setError('');
    try {
      if (operation.type === 'add') await paymentAPI.addCard({ testCardId: operation.testCardId });
      else if (operation.type === 'remove') await paymentAPI.removeCard(operation.id);
      else await paymentAPI.setDefaultCard(operation.id);
    } catch { /* A failed response does not establish whether a change was saved. */ }
    const current = await state.refresh(true);
    setConfirmation(null); setBusy(false);
    if (current) finish(operation, current);
    else {
      setUncertain({ operation });
      setError('We couldn’t confirm the change. Check your cards before making another change.');
    }
  };
  const checkCards = async () => {
    const current = await state.refresh(true);
    if (current && uncertain) finish(uncertain.operation, current);
  };
  const refresh = () => Promise.all([checkCards(), catalog.refresh()]);
  const showAdd = () => { setAdding(true); setMessage(''); setError(''); };
  return <AppScreen refreshControl={<RefreshControl refreshing={(state.refreshing || catalog.refreshing) && !state.loading} onRefresh={refresh} />}>
    <AppHeader title="Test cards" kicker="YOUR DEMO INSTRUMENTS" subtitle="Choose a synthetic card for simulated payments." onBack={() => navigation.goBack()} />
    <DemoModeBadge />
    <SecurityPrompt title="Predefined test cards only" message="Choose from the demo catalog. No real card number, security code or bank account is needed. No real funds can move." />
    {message ? <AppText color="success" accessibilityLiveRegion="polite">{message}</AppText> : null}
    <FormError message={error} />
    {uncertain ? <AppButton title="Check my cards" variant="secondary" loading={state.refreshing} onPress={checkCards} /> : null}
    {state.loading ? <LoadingSkeleton label="Loading your test cards" /> : state.error ? <ErrorState title="Cards unavailable" message="Your latest card list could not be checked. Refresh before changing cards." retryLabel="Refresh test cards" onRetry={checkCards} /> : <>
      {cards.length > 0 && state.data.defaultCount !== 1 ? <SecurityPrompt title="Choose one default card" message="The server has no single default for these older records. Choose an available test card as default or remove a record to update the list." /> : null}
      {cards.length ? <View style={{ gap: 16 }}>{cards.map(card => {
        const availability = catalog.data ? cardAvailability(card, catalog.data, user?.uid) : 'catalog-unavailable';
        const cardLabel = `${card.brand} ending ${card.last4 || 'unavailable'}`;
        return <AppCard key={card.id} testID={`linked-card-${card.id}`} style={{ gap: 12 }}>
          <MaskedCard card={card} />
          <AppText variant="body2" color="textSecondary">{card.bankLabel}</AppText>
          {availability === 'ready' ? <AppText variant="caption" color="textSecondary">Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear} · simulation only</AppText>
            : <StatusBadge status="failed" label={availability === 'expired' ? 'Expired · remove and add again' : availability === 'catalog-unavailable' ? 'Catalog unavailable' : 'Replace before paying'} />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availability === 'ready' && (!card.isDefault || state.data.defaultCount !== 1) ? <AppButton title={`Make ${cardLabel} default`} variant="secondary" disabled={locked} onPress={() => mutate({ type: 'default', id: card.id })} /> : null}
            <AppButton title={`Remove ${cardLabel}`} variant="ghost" disabled={locked} onPress={() => setConfirmation({ type: 'remove', id: card.id, label: cardLabel })} />
          </View>
        </AppCard>;
      })}</View> : <EmptyState title="No test cards yet" message="Add a predefined test card when you want to approve a simulation. You can create requests without one." icon="card-outline" />}
    </>}
    {catalog.loading ? <LoadingSkeleton label="Loading the test-card catalog" lines={2} /> : catalog.error ? <ErrorState title="Test-card catalog unavailable" message="The demo choices could not be loaded. Try again before adding a card." retryLabel="Retry test-card catalog" onRetry={() => catalog.refresh()} /> : adding ? <AppCard style={{ gap: 16 }}>
      <AppText variant="h3" accessibilityRole="header">Choose a test card</AppText>
      <AppText color="textSecondary">The server supplies a valid demo expiry. These instruments cannot make real payments.</AppText>
      {available.length ? <>
        {available.map(instrument => <MaskedCard key={instrument.id} card={instrument} selected={instrument.id === selectedId} onPress={locked ? undefined : () => setSelectedId(instrument.id)} />)}
        <AppButton title="Add selected test card" disabled={locked || !available.some(item => item.id === selectedId)} onPress={() => {
          const instrument = available.find(item => item.id === selectedId);
          if (instrument) setConfirmation({ type: 'add', testCardId: instrument.id, label: `${instrument.brand} ending ${instrument.last4}` });
        }} />
      </> : <AppText color="textSecondary">All available test cards are already linked.</AppText>}
      <AppButton title="Close card choices" variant="ghost" disabled={busy} onPress={() => setAdding(false)} />
    </AppCard> : <AppButton title="Add a test card" icon="add-outline" disabled={locked || !catalog.data} onPress={showAdd} />}
    <ConfirmBottomSheet visible={Boolean(confirmation)} title={confirmation?.type === 'add' ? 'Add this test card?' : 'Remove this test card?'}
      message={confirmation?.type === 'add' ? `${confirmation.label} is a synthetic instrument for NamPay demonstrations only.` : `${confirmation?.label || 'This card'} will be removed. If it is the default, the server will choose one remaining card. Your past receipts remain available.`}
      confirmLabel={confirmation?.type === 'add' ? 'Add test card' : 'Remove test card'} destructive={confirmation?.type === 'remove'} loading={busy}
      onCancel={() => setConfirmation(null)} onConfirm={() => confirmation && mutate(confirmation)} />
  </AppScreen>;
}
