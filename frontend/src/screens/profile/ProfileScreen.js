import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
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
  List,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { userAPI } from '../../config/api';
import { theme, colors, spacing } from '../../styles/theme';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();

  useEffect(() => {
    loadUserData();
  }, []);

  // Refresh profile data when screen comes into focus (e.g., returning from Settings)
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      if (user) {
        // Load fresh profile data from API to get photo URL
        const response = await userAPI.getProfile();
        console.log('📸 Profile data loaded:', response.data.user);
        console.log('📸 Photo URL:', response.data.user.photoUrl);
        setUserData(response.data.user);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to context user data
      if (user) {
        setUserData(user);
      }
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
      await logout();
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
    }
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
          {userData?.photoUrl ? (
            <>
              {console.log('🖼️ Rendering photo with URL:', userData.photoUrl)}
              <Image 
                source={{ uri: userData.photoUrl }} 
                style={styles.profilePhoto}
                onError={(error) => console.log('❌ Image load error:', error)}
                onLoad={() => console.log('✅ Image loaded successfully')}
              />
            </>
          ) : (
            <>
              {console.log('👤 No photo URL, showing avatar with initials:', `${userData?.firstName?.[0] || ''}${userData?.lastName?.[0] || ''}`)}
              <Avatar.Text
                size={80}
                label={`${userData?.firstName?.[0] || ''}${userData?.lastName?.[0] || ''}`}
                style={styles.avatar}
              />
            </>
          )}
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
        {/* Menu Options */}
        <Card style={styles.menuCard}>
          <Card.Content>
            <List.Item
              title="My Profile"
              description="Update your details and profile photo"
              left={(props) => <Ionicons name="person" size={24} color={colors.primary} />}
              right={(props) => <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              onPress={() => navigation.navigate('MyProfile')}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title="My Cards"
              description="Manage your linked payment cards"
              left={(props) => <Ionicons name="card" size={24} color={colors.primary} />}
              right={(props) => <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              onPress={() => navigation.navigate('Cards')}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title="Settings"
              description="Change password and app preferences"
              left={(props) => <Ionicons name="settings" size={24} color={colors.primary} />}
              right={(props) => <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              onPress={() => navigation.navigate('Settings')}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title="Help & Support"
              description="Get help and contact support"
              left={(props) => <Ionicons name="help-circle" size={24} color={colors.primary} />}
              right={(props) => <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              onPress={() => Alert.alert('Help & Support', 'For support, please contact us at support@nampay.com')}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title="Logout"
              description="Sign out of your account"
              left={(props) => <Ionicons name="log-out" size={24} color={colors.error} />}
              right={(props) => <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              onPress={handleLogout}
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
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  userPhone: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
  },
  content: {
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
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
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  versionText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  logoutButton: {
    marginTop: spacing.lg,
    borderColor: colors.error,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});