import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { AppScreen, AppHeader, AppText, AppButton, AppTextField, DemoModeBadge, TransactionRow,
  LoadingSkeleton, EmptyState, ErrorState, FormError } from '../../components/ui';
import { activityQuery, DEFAULT_ACTIVITY_FILTERS } from '../../features/activity/activityModel';
import useActivityFeed from '../../features/activity/useActivityFeed';
import { accessibilityStateProps } from '../../components/ui/accessibility';

function FilterChip({ title, label = title, selected, onPress }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} {...accessibilityStateProps({ selected })} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
      backgroundColor: selected ? colors.primary : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 })}>
    <AppText variant="label" color={selected ? colors.onPrimary : colors.textSecondary}>{title}</AppText>
  </Pressable>;
}
export default function TransactionsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [filters, setFilters] = useState(DEFAULT_ACTIVITY_FILTERS);
  const [draft, setDraft] = useState({ search: '', fromDate: '', toDate: '' });
  const [expanded, setExpanded] = useState(false);
  const [filterError, setFilterError] = useState('');
  const feed = useActivityFeed(user?.uid, filters, navigation);
  const activeFilters = Object.keys(DEFAULT_ACTIVITY_FILTERS).some(key => filters[key] !== DEFAULT_ACTIVITY_FILTERS[key]);
  const apply = () => {
    try { const next = { ...filters, ...draft }; activityQuery(next); setFilterError(''); setFilters(next); }
    catch (error) { setFilterError(error.message); }
  };
  const reset = () => { setFilters(DEFAULT_ACTIVITY_FILTERS); setDraft({ search: '', fromDate: '', toDate: '' }); setFilterError(''); };
  const header = <View style={{ gap: 18, paddingTop: 24, paddingBottom: 16 }}>
    <AppHeader title="Activity" subtitle="Your simulated payments, with a clear record for every transaction." />
    <DemoModeBadge />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {[['all', 'All'], ['sent', 'Sent'], ['received', 'Received']].map(([value, title]) => <FilterChip key={value} title={title}
        label={value === 'all' ? 'All activity' : title} selected={filters.type === value} onPress={() => setFilters(previous => ({ ...previous, type: value }))} />)}
    </View>
    <AppTextField label="Search activity" value={draft.search} onChangeText={search => setDraft(previous => ({ ...previous, search }))}
      placeholder="Name, reference or transaction ID" maxLength={120} returnKeyType="search" onSubmitEditing={apply} />
    <AppButton title={expanded ? 'Hide date and status filters' : 'Date and status filters'} variant="ghost" onPress={() => setExpanded(value => !value)}
      accessibilityState={{ expanded }}
      accessibilityHint={expanded ? 'Date and status filters are expanded.' : 'Expand date and status filters.'} />
    {expanded ? <View style={{ gap: 14 }}>
      <AppText variant="label">Payment status</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['all', 'completed', 'pending', 'failed', 'cancelled', 'expired'].map(status => <FilterChip key={status}
          title={status === 'all' ? 'Any status' : status.charAt(0).toUpperCase() + status.slice(1)} label={`Status: ${status}`} selected={filters.status === status}
          onPress={() => setFilters(previous => ({ ...previous, status }))} />)}
      </View>
      <AppTextField label="From date" value={draft.fromDate} onChangeText={fromDate => setDraft(previous => ({ ...previous, fromDate }))}
        placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" hint="Namibia calendar date (YYYY-MM-DD)." />
      <AppTextField label="To date" value={draft.toDate} onChangeText={toDate => setDraft(previous => ({ ...previous, toDate }))}
        placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" hint="Includes the full day in Africa/Windhoek." />
    </View> : null}
    <FormError message={filterError} />
    <AppButton title="Apply search and dates" variant="secondary" onPress={apply} />
    {activeFilters ? <AppButton title="Clear activity filters" variant="ghost" onPress={reset} /> : null}
    {feed.items.length ? <AppText variant="caption" color="textSecondary">Showing {feed.items.length} of {feed.pagination?.total ?? feed.items.length} matching transactions</AppText> : null}
    {feed.error && feed.items.length ? <View style={{ gap: 10 }}><FormError message={feed.error} /><AppText variant="caption" color="textSecondary">Showing your last loaded activity.</AppText>
      <AppButton title="Refresh activity" variant="secondary" onPress={feed.refresh} loading={feed.refreshing} /></View> : null}
  </View>;
  return <AppScreen scroll={false} contentStyle={{ flex: 1, paddingVertical: 0, maxWidth: 860 }}>
    <FlatList data={feed.items} keyExtractor={item => item.id} ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={colors.primary} />}
      renderItem={({ item }) => <TransactionRow transaction={item} onPress={() => navigation.navigate('TransactionDetail', { transactionId: item.id })} />}
      ListEmptyComponent={feed.loading || feed.refreshing ? <LoadingSkeleton label="Loading activity" lines={5} />
        : feed.error ? <ErrorState title="Activity is unavailable" message={feed.error} onRetry={feed.refresh} retryLabel="Retry activity" />
          : <EmptyState title={activeFilters ? 'No matching activity' : 'Your activity starts here'} message={activeFilters
            ? 'Try a different name, date or status.' : 'Complete a simulated payment to see its record and receipt here.'}
            actionLabel={activeFilters ? 'Clear activity filters' : 'Scan a payment request'} onAction={activeFilters ? reset : () => navigation.navigate('QRScan')} />}
      ListFooterComponent={feed.pagination?.hasMore ? <View style={{ paddingTop: 20 }}><AppButton title="Load more activity" variant="secondary"
        onPress={feed.loadMore} loading={feed.loadingMore} disabled={feed.refreshing || feed.loading} /></View> : null} />
  </AppScreen>;
}
