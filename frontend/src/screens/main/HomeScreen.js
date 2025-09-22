import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  Avatar,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../../utils/asyncStorage';
import { userAPI, paymentAPI } from '../../config/api';
import { colors, spacing } from '../../styles/theme';

export default function HomeScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
    loadStats();
    loadRecentTransactions();
  }, []);

  const loadUserData = async () => {
    try {
      // Load fresh profile data from API to get photo URL
      const response = await userAPI.getProfile();
      setUserData(response.data.user);
      
      // Also store in AsyncStorage for offline access
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to stored data
      const storedUserData = await AsyncStorage.getItem('userData');
      if (storedUserData) {
        setUserData(JSON.parse(storedUserData));
      }
    }
  };

  const loadStats = async () => {
    try {
      const response = await userAPI.getStats();
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentTransactions = async () => {
    try {
      const response = await userAPI.getTransactions({ limit: 5 });
      setRecentTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserData(),
      loadStats(),
      loadRecentTransactions(),
    ]);
    setRefreshing(false);
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'generate':
        navigation.navigate('QR');
        break;
      case 'scan':
        navigation.navigate('QRScan');
        break;
      case 'cards':
        navigation.navigate('Cards');
        break;
      case 'transactions':
        navigation.navigate('Transactions');
        break;
      default:
        break;
    }
  };

  const formatAmount = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 'N$ 0.00';
    
    // Format with commas for thousands separator
    const formatted = numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `N$ ${formatted}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NA', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            {userData?.photoUrl ? (
              <Image source={{ uri: userData.photoUrl }} style={styles.profilePhoto} />
            ) : (
              <Avatar.Text
                size={50}
                label={`${userData?.firstName?.[0] || ''}${userData?.lastName?.[0] || ''}`}
                style={styles.avatar}
              />
            )}
            <View style={styles.userDetails}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName}>
                {userData?.firstName} {userData?.lastName}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Title style={styles.sectionTitle}>Quick Actions</Title>
        <View style={styles.actionGrid}>
          <Card style={styles.actionCard} onPress={() => handleQuickAction('generate')}>
            <Card.Content style={styles.actionContent}>
              <Ionicons name="qr-code" size={32} color={colors.primary} />
              <Text style={styles.actionText}>Request Payment</Text>
              <Text style={styles.actionSubtext}>(QR)</Text>
            </Card.Content>
          </Card>

          <Card style={styles.actionCard} onPress={() => handleQuickAction('scan')}>
            <Card.Content style={styles.actionContent}>
              <Ionicons name="scan" size={32} color={colors.secondary} />
              <Text style={styles.actionText}>Send Money</Text>
              <Text style={styles.actionSubtext}>(Scan QR)</Text>
            </Card.Content>
          </Card>

          <Card style={styles.actionCard} onPress={() => handleQuickAction('cards')}>
            <Card.Content style={styles.actionContent}>
              <Ionicons name="card" size={32} color={colors.info} />
              <Text style={styles.actionText}>My Cards</Text>
            </Card.Content>
          </Card>

          <Card style={styles.actionCard} onPress={() => handleQuickAction('transactions')}>
            <Card.Content style={styles.actionContent}>
              <Ionicons name="list" size={32} color={colors.warning} />
              <Text style={styles.actionText}>History</Text>
            </Card.Content>
          </Card>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsSection}>
          <Title style={styles.sectionTitle}>Your Statistics</Title>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <Text style={styles.statValue}>{stats.totalTransactions}</Text>
                <Text style={styles.statLabel}>Total Transactions</Text>
              </Card.Content>
            </Card>

            <Card style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <Text style={styles.statValue}>{formatAmount(stats.totalSent)}</Text>
                <Text style={styles.statLabel}>Total Sent</Text>
              </Card.Content>
            </Card>

            <Card style={styles.statCard}>
              <Card.Content style={styles.statContent}>
                <Text style={styles.statValue}>{formatAmount(stats.totalReceived)}</Text>
                <Text style={styles.statLabel}>Total Received</Text>
              </Card.Content>
            </Card>
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.transactionsSection}>
        <View style={styles.transactionsHeader}>
          <Title style={styles.sectionTitle}>Recent Transactions</Title>
          <Button
            mode="text"
            onPress={() => handleQuickAction('transactions')}
            labelStyle={styles.viewAllButton}
          >
            View All
          </Button>
        </View>

        {recentTransactions.length > 0 ? (
          <Card style={styles.transactionsCard}>
            <Card.Content>
              {recentTransactions.map((transaction, index) => (
                <View key={transaction.id}>
                  <View style={styles.transactionItem}>
                    <View style={styles.transactionIcon}>
                      <Ionicons
                        name={transaction.type === 'send' ? 'arrow-up' : 'arrow-down'}
                        size={24}
                        color={transaction.type === 'send' ? colors.error : colors.success}
                      />
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionDescription}>
                        {transaction.description}
                      </Text>
                      <Text style={styles.transactionPerson}>
                        {transaction.type === 'send' 
                          ? `To: ${transaction.receiverName}`
                          : `From: ${transaction.senderName}`
                        }
                      </Text>
                      <Text style={styles.transactionDate}>
                        {formatDate(transaction.timestamp)}
                      </Text>
                    </View>
                    <View style={styles.transactionAmount}>
                      <Text style={[
                        styles.amountText,
                        { color: transaction.type === 'send' ? colors.error : colors.success }
                      ]}>
                        {transaction.type === 'send' ? '-' : '+'}{formatAmount(transaction.amount)}
                      </Text>
                    </View>
                  </View>
                  {index < recentTransactions.length - 1 && <Divider style={styles.divider} />}
                </View>
              ))}
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Ionicons name="receipt-outline" size={48} color={colors.gray} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Start by generating or scanning a QR code
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
    </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: colors.white,
    marginRight: spacing.md,
  },
  profilePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    marginRight: spacing.md,
  },
  userDetails: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
  },
  quickActions: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    marginBottom: spacing.md,
    elevation: 2,
  },
  actionContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  actionText: {
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statsSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  statCard: {
    flex: 1,
    marginHorizontal: spacing.xs,
    elevation: 2,
    minWidth: 0, // Allow flex shrinking
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  transactionsSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAllButton: {
    color: colors.primary,
  },
  transactionsCard: {
    elevation: 2,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontWeight: '500',
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
  },
  divider: {
    marginVertical: spacing.sm,
  },
  emptyCard: {
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});