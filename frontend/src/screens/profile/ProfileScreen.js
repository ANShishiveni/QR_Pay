import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  Avatar,
  List,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userAPI } from '../../config/api';
import { theme, colors, spacing, typography } from '../../styles/theme';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
    loadStats();
  }, []);

  const loadUserData = async () => {
    try {
      const storedUserData = await AsyncStorage.getItem('userData');
      if (storedUserData) {
        setUserData(JSON.parse(storedUserData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await userAPI.getStats();
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatAmount = (amount) => {
    return `N$ ${parseFloat(amount).toFixed(2)}`;
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
    <ScrollView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Avatar.Text
            size={80}
            label={`${userData?.firstName?.[0] || ''}${userData?.lastName?.[0] || ''}`}
            style={styles.avatar}
          />
          <Title style={styles.userName}>
            {userData?.firstName} {userData?.lastName}
          </Title>
          <Paragraph style={styles.userEmail}>{userData?.email}</Paragraph>
          {userData?.phoneNumber && (
            <Paragraph style={styles.userPhone}>{userData.phoneNumber}</Paragraph>
          )}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Quick Stats */}
        {stats && (
          <Card style={styles.statsCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Account Overview</Title>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.totalTransactions}</Text>
                  <Text style={styles.statLabel}>Transactions</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatAmount(stats.totalSent)}</Text>
                  <Text style={styles.statLabel}>Total Sent</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatAmount(stats.totalReceived)}</Text>
                  <Text style={styles.statLabel}>Total Received</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Menu Options */}
        <Card style={styles.menuCard}>
          <Card.Content>
            <List.Item
              title="My Cards"
              description="Manage your linked payment cards"
              left={(props) => <List.Icon {...props} icon="credit-card" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Cards')}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title="Transaction History"
              description="View all your payment history"
              left={(props) => <List.Icon {...props} icon="history" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Transactions')}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title="Security Settings"
              description="Manage your account security"
              left={(props) => <List.Icon {...props} icon="shield-account" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => Alert.alert('Coming Soon', 'Security settings will be available in a future update.')}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title="Help & Support"
              description="Get help and contact support"
              left={(props) => <List.Icon {...props} icon="help-circle" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => Alert.alert('Help & Support', 'For support, please contact us at support@qrmoneytransfer.com')}
              style={styles.menuItem}
            />
          </Card.Content>
        </Card>

        {/* App Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>About This App</Title>
            <Paragraph style={styles.infoText}>
              QR Money Transfer is a prototype application designed to demonstrate 
              cross-bank money transfers in Namibia using QR codes and Visa card integration.
            </Paragraph>
            <Paragraph style={styles.infoText}>
              This application uses sandbox APIs for demonstration purposes and is not 
              intended for real financial transactions.
            </Paragraph>
            <View style={styles.versionInfo}>
              <Text style={styles.versionText}>Version 1.0.0</Text>
              <Text style={styles.versionText}>© 2024 QR Money Transfer</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Logout Button */}
        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutButton}
          icon="logout"
          textColor={colors.error}
          buttonColor={colors.white}
          theme={{
            colors: {
              primary: colors.error,
            },
          }}
        >
          Logout
        </Button>
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
    fontSize: typography.body1.fontSize,
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
  avatar: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  userName: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: typography.body1.fontSize,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  userPhone: {
    fontSize: typography.body2.fontSize,
    color: colors.white,
    opacity: 0.8,
  },
  content: {
    padding: spacing.lg,
  },
  statsCard: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  menuCard: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  menuItem: {
    paddingVertical: spacing.sm,
  },
  infoCard: {
    elevation: 2,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  infoText: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.body2.lineHeight,
    marginBottom: spacing.md,
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  versionText: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  logoutButton: {
    marginTop: spacing.lg,
    borderColor: colors.error,
  },
});