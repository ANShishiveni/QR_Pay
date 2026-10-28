import React, { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';
import { AppScreen, AppHeader, AppText, AppCard, AppButton, AmountDisplay, DemoModeBadge, EmptyState, ErrorState, LoadingSkeleton, TransactionRow } from '../../components/ui';
import { userAPI, paymentAPI, qrAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { checkedActivityPage, mergeActivity } from '../../features/activity/activityModel';
import useFocusedResource from '../qr/useFocusedResource';
import { checkedRequestList } from '../qr/requestUtils';
import RequestList from '../qr/RequestList';
import { checkedHomeStats } from './homeModel';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const loadStats = useCallback(async () => checkedHomeStats((await userAPI.getStats()).data), []);
  const loadActivity = useCallback(async () => {
    const page = checkedActivityPage((await paymentAPI.getPaymentHistory({ limit: 5, offset: 0 })).data, user?.uid, 0, 5);
    return mergeActivity([], page.transactions).slice(0, 5);
  }, [user?.uid]);
  const loadRequests = useCallback(async () => checkedRequestList((await qrAPI.getRequests({ status: 'pending' })).data), []);
  const stats = useFocusedResource(loadStats, navigation, 60000);
  const activity = useFocusedResource(loadActivity, navigation, 60000);
  const requests = useFocusedResource(loadRequests, navigation, 60000);
  const refresh = () => Promise.all([stats.refresh(), activity.refresh(), requests.refresh()]);
  const refreshing = [stats, activity, requests].some(section => section.refreshing && !section.loading);
  const firstName = typeof user?.firstName === 'string' ? user.firstName.trim() : '';
  return <AppScreen edges={['top', 'left', 'right']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
    <AppHeader kicker="YOUR NAMPAY" title={firstName ? `Hello, ${firstName}.` : 'Welcome to NamPay.'} subtitle="Your requests and simulated payments, together." />
    <DemoModeBadge />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <AppButton title="Scan to pay" icon="scan-outline" style={{ flexGrow: 1, flexBasis: 220 }} onPress={() => navigation.navigate('QRScan')} />
      <AppButton title="Request a payment" icon="qr-code-outline" variant="secondary" style={{ flexGrow: 1, flexBasis: 220 }} onPress={() => navigation.navigate('QRGenerate')} />
    </View>
    <AppCard style={{ gap: 20 }}>
      <View style={{ gap: 4 }}><AppText variant="h3" accessibilityRole="header">Your demo activity</AppText><AppText variant="body2" color="textSecondary">Completed simulations · no real funds transferred</AppText></View>
      {stats.loading ? <LoadingSkeleton label="Loading simulated totals" lines={2} /> : stats.error ? <ErrorState title="Totals unavailable" message="We couldn’t load your simulated totals. Your other activity may still be available." retryLabel="Retry totals" onRetry={() => stats.refresh()} /> : stats.data ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          <AmountDisplay label="Simulated sent" amountMinor={stats.data.totalSentMinor} size="h2" style={{ flexGrow: 1, flexBasis: 200 }} />
          <AmountDisplay label="Simulated received" amountMinor={stats.data.totalReceivedMinor} size="h2" style={{ flexGrow: 1, flexBasis: 200 }} />
        </View>
        <AppText variant="caption" color="textSecondary">{stats.data.totalTransactions} completed {stats.data.totalTransactions === 1 ? 'simulation' : 'simulations'} · all time</AppText>
      </> : null}
    </AppCard>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <AppText variant="h3" accessibilityRole="header">Pending requests</AppText><AppButton title="View all requests" variant="ghost" onPress={() => navigation.navigate('QRRequests')} />
    </View>
    {requests.loading ? <LoadingSkeleton label="Loading pending requests" /> : requests.error ? <ErrorState title="Requests unavailable" message="Your requests could not be refreshed. Try again to see their latest status." retryLabel="Retry requests" onRetry={() => requests.refresh()} />
      : requests.data?.requests.length ? <RequestList requests={requests.data.requests.slice(0, 3)} navigation={navigation} />
        : <EmptyState title="No pending requests" message="Create a QR request when you’re ready to receive a simulated payment." icon="qr-code-outline" />}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <AppText variant="h3" accessibilityRole="header">Latest activity</AppText><AppButton title="View all activity" variant="ghost" onPress={() => navigation.navigate('Transactions')} />
    </View>
    {activity.loading ? <LoadingSkeleton label="Loading latest activity" /> : activity.error ? <ErrorState title="Activity unavailable" message="Your recent activity could not be refreshed. No new result has been assumed." retryLabel="Retry activity" onRetry={() => activity.refresh()} />
      : activity.data?.length ? <AppCard style={{ paddingVertical: 4 }}>{activity.data.map(transaction => <TransactionRow key={transaction.id} transaction={transaction} onPress={() => navigation.navigate('TransactionDetail', { transactionId: transaction.id })} />)}</AppCard>
        : <EmptyState title="Your activity starts here" message="After your first simulation, you’ll see its result and receipt here." icon="receipt-outline" />}
    <AppButton title="Manage test cards" variant="secondary" icon="card-outline" onPress={() => navigation.navigate('Cards')} />
  </AppScreen>;
}
