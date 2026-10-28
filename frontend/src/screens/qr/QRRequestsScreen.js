import React, { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { AppScreen, AppHeader, AppText, AppButton, DemoModeBadge, EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { qrAPI } from '../../config/api';
import useFocusedResource from './useFocusedResource';
import { checkedRequestList } from './requestUtils';
import RequestList from './RequestList';

const filters = [['all', 'All'], ['pending', 'Pending'], ['completed', 'Completed'], ['expired', 'Expired'], ['cancelled', 'Cancelled']];
export default function QRRequestsScreen({ navigation }) {
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => checkedRequestList((await qrAPI.getRequests({ status: 'all' })).data), []);
  const state = useFocusedResource(load, navigation);
  const requests = (state.data?.requests || []).filter(request => filter === 'all' || request.status === filter);
  return <AppScreen refreshControl={<RefreshControl refreshing={state.refreshing && !state.loading} onRefresh={() => state.refresh()} />}>
    <AppHeader kicker="PAYMENT REQUESTS" title="Your requests" subtitle="Follow the progress of every QR you create." onBack={() => navigation.goBack()} />
    <DemoModeBadge />
    <AppButton title="Request a payment" icon="add-outline" onPress={() => navigation.navigate('QRGenerate')} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {filters.map(([key, label]) => <AppButton key={key} title={label} variant={filter === key ? 'primary' : 'secondary'}
        accessibilityLabel={`Filter requests: ${label}`} accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} />)}
    </View>
    {state.loading ? <LoadingSkeleton label="Loading your requests" /> : state.error ? <ErrorState title="Requests unavailable" message={state.error} onRetry={() => state.refresh()} />
      : requests.length ? <><AppText variant="caption" color="textSecondary">{requests.length} {requests.length === 1 ? 'request' : 'requests'} · latest first</AppText><RequestList requests={requests} navigation={navigation} /></>
        : <EmptyState title={filter === 'all' ? 'No requests yet' : `No ${filter} requests`} message={filter === 'all' ? 'Create a QR request to invite someone to make a simulated payment.' : 'Choose another filter or create a new request.'} />}
  </AppScreen>;
}
