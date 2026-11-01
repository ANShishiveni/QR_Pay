import React, { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';
import { AppScreen, AppHeader, AppText, AppCard, AppButton, DemoModeBadge, EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { qrAPI } from '../../config/api';
import useFocusedResource from '../qr/useFocusedResource';
import { checkedRequestList } from '../qr/requestUtils';
import RequestList from '../qr/RequestList';

export default function PaymentsScreen({ navigation }) {
  const load = useCallback(async () => checkedRequestList((await qrAPI.getRequests({ status: 'pending' })).data), []);
  const state = useFocusedResource(load, navigation);
  return <AppScreen edges={['top', 'left', 'right']} refreshControl={<RefreshControl refreshing={state.refreshing && !state.loading} onRefresh={() => state.refresh()} />}>
    <AppHeader kicker="PAYMENTS" title="A simple way to ask and pay." subtitle="Create a request or scan one to begin a simulation." />
    <DemoModeBadge />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      <AppCard style={{ flexGrow: 1, flexBasis: 240, gap: 14 }}>
        <AppText variant="h2">Let someone scan your QR</AppText>
        <AppText color="textSecondary">Choose an amount. Share a request that expires after five minutes.</AppText>
        <AppButton title="Request a payment" icon="qr-code-outline" onPress={() => navigation.navigate('QRGenerate')} />
      </AppCard>
      <AppCard style={{ flexGrow: 1, flexBasis: 240, gap: 14 }}>
        <AppText variant="h2">Ready to simulate a payment?</AppText>
        <AppText color="textSecondary">Scan or import a QR, review its details, and approve with a test instrument.</AppText>
        <AppButton title="Scan a QR code" variant="secondary" icon="scan-outline" onPress={() => navigation.navigate('QRScan')} />
      </AppCard>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <AppText variant="h3" accessibilityRole="header">Waiting for a payer</AppText>
      <AppButton title="View all requests" variant="ghost" onPress={() => navigation.navigate('QRRequests')} />
    </View>
    {state.loading ? <LoadingSkeleton label="Loading your pending requests" /> : state.error ? <ErrorState title="Requests unavailable" message={state.error} onRetry={() => state.refresh()} />
      : state.data?.requests.length ? <RequestList requests={state.data.requests.slice(0, 3)} navigation={navigation} />
        : <EmptyState title="No pending requests" message="Create your first QR request when you are ready. No real money is involved." icon="qr-code-outline" />}
  </AppScreen>;
}
