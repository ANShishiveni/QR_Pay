import React, { useEffect } from 'react';
import { RefreshControl, View } from 'react-native';
import { AppScreen, AppHeader, AppText, AppCard, AppButton, DemoModeBadge, StatusBadge, LoadingSkeleton, EmptyState, ErrorState, OfflineBanner, FormError } from '../../components/ui';
import { useNotifications } from '../../context/NotificationContext';
import { notificationCopy, notificationDestination } from '../../features/notifications/notificationModel';
import { formatDate } from '../../utils/money';

export default function NotificationsScreen({ navigation }) {
  const { items, inboxUnreadCount, alertsEnabled, loading, refreshing, error, markError, readingIds, refresh, markRead } = useNotifications();
  useEffect(() => {
    refresh();
    const unsubscribe = navigation?.addListener?.('focus', () => refresh());
    return () => unsubscribe?.();
  }, [navigation, refresh]);
  const open = item => {
    const destination = notificationDestination(item);
    if (!destination) return;
    markRead(item.id);
    navigation.navigate(destination.name, destination.params);
  };
  return <AppScreen refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={() => refresh()} />}>
    <AppHeader title="Your inbox" kicker="IN-APP UPDATES" subtitle="Updates about your requests and simulated payments." onBack={() => navigation.goBack()} />
    <DemoModeBadge />
    <AppText color="textSecondary">Open an update to check its latest server record. An inbox message is not proof of payment or bank settlement.</AppText>
    {!alertsEnabled ? <AppCard><AppText variant="label">In-app alerts are off</AppText><AppText variant="body2" color="textSecondary">Your inbox and payment history remain available. You can turn alerts on in Settings.</AppText></AppCard> : null}
    <FormError message={markError} />
    {loading ? <LoadingSkeleton label="Loading your inbox" lines={4} /> : error && !items.length ? <ErrorState title="Inbox unavailable" message={error} retryLabel="Refresh inbox" onRetry={() => refresh()} /> : <>
      <OfflineBanner visible={Boolean(error)} message={error ? `${error} Showing your last checked updates.` : undefined} onRetry={() => refresh()} />
      {items.length ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <AppText variant="h3" accessibilityRole="header">{inboxUnreadCount} unread {inboxUnreadCount === 1 ? 'update' : 'updates'}</AppText>
          <AppButton title="Refresh inbox" variant="ghost" loading={refreshing} onPress={() => refresh()} />
        </View>
        {items.map(item => {
          const copy = notificationCopy(item);
          return <AppCard key={item.id} testID={`notification-${item.id}`} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <AppText variant="h3" accessibilityRole="header" style={{ flexShrink: 1 }}>{copy.title}</AppText>
              <StatusBadge status={item.readAt ? 'verified' : 'pending'} label={item.readAt ? 'Read' : 'Unread'} />
            </View>
            <AppText color="textSecondary">{copy.message}</AppText>
            <AppText variant="caption" color="textSecondary">{formatDate(item.createdAt)}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <AppButton title={item.eventType === 'payment_completed' ? 'Check payment record' : 'Open request'} accessibilityLabel={`Open ${copy.title.toLowerCase()}`} testID={`notification-open-${item.id}`} variant="secondary" onPress={() => open(item)} />
              {!item.readAt ? <AppButton title="Mark as read" accessibilityLabel={`Mark ${copy.title.toLowerCase()} as read`} variant="ghost" loading={readingIds.includes(item.id)} onPress={() => markRead(item.id)} /> : null}
            </View>
          </AppCard>;
        })}
      </> : <EmptyState title="You’re all caught up" message="Updates will appear here when you create a request, a request expires, or a simulation completes." icon="notifications-outline" actionLabel="Refresh inbox" onAction={() => refresh()} />}
    </>}
  </AppScreen>;
}
