import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Text,
  ActivityIndicator,
  Chip,
  Searchbar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../../config/api';
import { theme, colors, spacing } from '../../styles/theme';

export default function TransactionsScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchQuery, selectedFilter]);

  const loadTransactions = async () => {
    try {
      const response = await userAPI.getTransactions({ limit: 50 });
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const filterTransactions = () => {
    let filtered = transactions;

    // Filter by type
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(t => t.type === selectedFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.senderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.receiverName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  };

  const formatAmount = (amount, type) => {
    const formattedAmount = `N$ ${parseFloat(amount).toFixed(2)}`;
    return type === 'send' ? `-${formattedAmount}` : `+${formattedAmount}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type) => {
    return type === 'send' ? 'arrow-up' : 'arrow-down';
  };

  const getTransactionColor = (type) => {
    return type === 'send' ? colors.error : colors.success;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'failed':
        return colors.error;
      default:
        return colors.gray;
    }
  };

  const renderTransaction = ({ item }) => (
    <Card style={styles.transactionCard}>
      <Card.Content>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionIcon}>
            <Ionicons
              name={getTransactionIcon(item.type)}
              size={24}
              color={getTransactionColor(item.type)}
            />
          </View>
          <View style={styles.transactionDetails}>
            <Text style={styles.transactionDescription}>
              {item.description}
            </Text>
            <Text style={styles.transactionPerson}>
              {item.type === 'send' 
                ? `To: ${item.receiverName}`
                : `From: ${item.senderName}`
              }
            </Text>
            <Text style={styles.transactionDate}>
              {formatDate(item.timestamp)}
            </Text>
          </View>
          <View style={styles.transactionAmount}>
            <Text style={[
              styles.amountText,
              { color: getTransactionColor(item.type) }
            ]}>
              {formatAmount(item.amount, item.type)}
            </Text>
            <Chip
              mode="flat"
              textStyle={styles.statusChipText}
              style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
            >
              {item.status}
            </Chip>
          </View>
        </View>

        {/* Bank Information */}
        {(item.senderBank || item.receiverBank) && (
          <View style={styles.bankInfo}>
            <Text style={styles.bankLabel}>Banks:</Text>
            <Text style={styles.bankText}>
              {item.senderBank} → {item.receiverBank}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <Card style={styles.emptyCard}>
      <Card.Content style={styles.emptyContent}>
        <Ionicons name="receipt-outline" size={64} color={colors.gray} />
        <Title style={styles.emptyTitle}>No Transactions Found</Title>
        <Paragraph style={styles.emptySubtitle}>
          {searchQuery || selectedFilter !== 'all' 
            ? 'No transactions match your current filters'
            : 'You haven\'t made any transactions yet'
          }
        </Paragraph>
      </Card.Content>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="list" size={32} color={colors.white} />
          <Title style={styles.headerTitle}>Transaction History</Title>
          <Paragraph style={styles.headerSubtitle}>
            View all your payment transactions
          </Paragraph>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Search and Filters */}
        <View style={styles.filtersContainer}>
          <Searchbar
            placeholder="Search transactions..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            theme={{
              colors: {
                primary: colors.primary,
              },
            }}
          />

          <View style={styles.filterChips}>
            <Chip
              selected={selectedFilter === 'all'}
              onPress={() => setSelectedFilter('all')}
              style={styles.filterChip}
              textStyle={styles.filterChipText}
            >
              All
            </Chip>
            <Chip
              selected={selectedFilter === 'send'}
              onPress={() => setSelectedFilter('send')}
              style={styles.filterChip}
              textStyle={styles.filterChipText}
            >
              Sent
            </Chip>
            <Chip
              selected={selectedFilter === 'receive'}
              onPress={() => setSelectedFilter('receive')}
              style={styles.filterChip}
              textStyle={styles.filterChipText}
            >
              Received
            </Chip>
          </View>
        </View>

        {/* Transactions List */}
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: spacing.sm,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  filtersContainer: {
    marginBottom: spacing.lg,
  },
  searchBar: {
    marginBottom: spacing.md,
    elevation: 2,
  },
  filterChips: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  filterChip: {
    backgroundColor: colors.white,
  },
  filterChipText: {
    fontSize: 12,
  },
  listContainer: {
    paddingBottom: spacing.xl,
  },
  transactionCard: {
    elevation: 2,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  transactionPerson: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  statusChip: {
    height: 28,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
    textTransform: 'capitalize',
    textAlign: 'center',
    lineHeight: 12,
  },
  bankInfo: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bankLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  bankText: {
    fontSize: 12,
    color: colors.text,
    marginTop: spacing.xs,
  },
  emptyCard: {
    elevation: 2,
    borderRadius: 12,
    marginTop: spacing.xl,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});