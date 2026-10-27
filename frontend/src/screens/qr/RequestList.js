import React from 'react';
import { View } from 'react-native';
import { AppCard, AppText, AmountDisplay, StatusBadge } from '../../components/ui';
import { formatDate, formatMoney } from '../../utils/money';

export default function RequestList({ requests, navigation }) {
  return <View style={{ gap: 12 }}>{requests.map(request => <AppCard key={request.id}
    onPress={() => navigation.navigate('QRRequestDetails', { requestId: request.id })}
    accessibilityLabel={`Request ${formatMoney(request.amountMinor)}, ${request.status}${request.reference ? `, ${request.reference}` : ''}`}
    style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
      <AmountDisplay amountMinor={request.amountMinor} size="h3" /><StatusBadge status={request.status} label={request.status === 'completed' ? 'Simulated payment received' : undefined} />
    </View>
    <AppText variant="label">{request.reference || request.description || 'Payment request'}</AppText>
    <AppText variant="caption" color="textSecondary">Created {formatDate(request.createdAt)}</AppText>
  </AppCard>)}</View>;
}
