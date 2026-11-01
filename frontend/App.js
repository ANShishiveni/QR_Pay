import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { AppButton, AppCard, AppScreen, AppText, BrandMark } from './src/components/ui';
import { accessibilityStateProps } from './src/components/ui/accessibility';
import { NetworkProvider, useNetwork } from './src/context/NetworkContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import preferences from './src/utils/asyncStorage';
import OnboardingScreen from './src/screens/auth/OnboardingScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen';
import OTPVerificationScreen from './src/screens/auth/OTPVerificationScreen';
import BiometricAuthScreen from './src/screens/auth/BiometricAuthScreen';
import HomeScreen from './src/screens/main/HomeScreen';
import QRGenerateScreen from './src/screens/qr/QRGenerateScreen';
import QRScanScreen from './src/screens/qr/QRScanScreen';
import QRRequestsScreen from './src/screens/qr/QRRequestsScreen';
import QRRequestDetailsScreen from './src/screens/qr/QRRequestDetailsScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';
import MyProfileScreen from './src/screens/profile/MyProfileScreen';
import CardsScreen from './src/screens/profile/CardsScreen';
import TransactionsScreen from './src/screens/profile/TransactionsScreen';
import SettingsScreen from './src/screens/profile/SettingsScreen';
import TransactionDetailScreen from './src/screens/profile/TransactionDetailScreen';
import ChangePasswordScreen from './src/screens/profile/ChangePasswordScreen';
import HelpScreen from './src/screens/profile/HelpScreen';
import AboutScreen from './src/screens/profile/AboutScreen';
import NotificationsScreen from './src/screens/profile/NotificationsScreen';
import PaymentConfirmScreen from './src/screens/payment/PaymentConfirmScreen';
import PaymentsScreen from './src/screens/payment/PaymentsScreen';
import PaymentResultScreen from './src/screens/payment/PaymentResultScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const icons = { Home: ['home-outline', 'home'], Payments: ['qr-code-outline', 'qr-code'], Activity: ['receipt-outline', 'receipt'], Profile: ['person-outline', 'person'] };

function TabButton({ accessibilityState = {}, ...props }) {
  const keyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).filter(tab => tab.getClientRects().length && tab.getAttribute('aria-disabled') !== 'true');
    const index = tabs.indexOf(event.currentTarget);
    if (index < 0 || !tabs.length) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); tabs[next].click();
  };
  return <Pressable {...props} accessibilityRole="tab" {...accessibilityStateProps(accessibilityState, 'tab')}
    {...(Platform.OS === 'web' ? { tabIndex: accessibilityState.selected ? 0 : -1, onKeyDown: keyDown } : {})} />;
}

function focusScreenHeading() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // Arrow-key activation keeps focus inside the tablist.
  if (document.activeElement?.getAttribute('role') === 'tab') return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const headings = Array.from(document.querySelectorAll('h1, [role="heading"][aria-level="1"]'));
    const heading = headings.filter(node => node.getClientRects().length && !node.closest('[aria-hidden="true"]') && getComputedStyle(node).visibility !== 'hidden').pop();
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }));
}

export function LoadingScreen() {
  const { colors } = useAppTheme();
  return <AppScreen scroll={false} contentStyle={styles.loading}>
    <BrandMark /><ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Checking your session" />
    <AppText variant="label">Getting NamPay ready</AppText><AppText color="textSecondary" style={{ textAlign: 'center' }}>Checking your session securely.</AppText>
  </AppScreen>;
}

export function MainTabs() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerShown: false,
    tabBarAccessibilityLabel: route.name === 'Profile' && unreadCount > 0 ? `Profile, ${unreadCount} unread updates` : route.name,
    tabBarButton: props => <TabButton {...props} />,
    tabBarBadge: route.name === 'Profile' && unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
    tabBarIcon: ({ focused, color }) => <Ionicons name={icons[route.name][focused ? 1 : 0]} size={22} color={color} />,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textSecondary,
    tabBarActiveBackgroundColor: colors.primarySoft,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 68 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8, elevation: 0 },
    tabBarItemStyle: { minHeight: 52, borderRadius: 12, marginHorizontal: 5 },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 3 },
    sceneStyle: { backgroundColor: colors.background },
  })}>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Payments" component={PaymentsScreen} />
    <Tab.Screen name="Activity" component={TransactionsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>;
}

export function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark, reduceMotion, appearanceReady } = useAppTheme();
  const [onboardingDone, setOnboardingDone] = useState(null);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  useEffect(() => {
    let active = true;
    preferences.getItem('onboardingComplete').then(value => { if (active) setOnboardingDone(value === 'true'); })
      .catch(() => { if (active) setOnboardingDone(false); });
    return () => { active = false; };
  }, []);
  const navigationTheme = useMemo(() => ({
    ...(isDark ? DarkTheme : DefaultTheme), dark: isDark,
    colors: { ...(isDark ? DarkTheme.colors : DefaultTheme.colors), primary: colors.primary, background: colors.background,
      card: colors.surface, text: colors.text, border: colors.border, notification: colors.error },
  }), [isDark, colors]);
  const completeOnboarding = async () => {
    if (savingOnboarding) return;
    setSavingOnboarding(true);
    try { await preferences.setItem('onboardingComplete', 'true'); }
    catch { Toast.show({ type: 'info', text1: 'Introduction complete', text2: 'Your device could not save this preference. You can still continue.' }); }
    finally { setOnboardingDone(true); setSavingOnboarding(false); }
  };

  if (isLoading || !appearanceReady || onboardingDone === null) return <LoadingScreen />;
  if (!isAuthenticated && !onboardingDone) return <OnboardingScreen onComplete={completeOnboarding} loading={savingOnboarding} />;
  return <NavigationContainer theme={navigationTheme} onStateChange={focusScreenHeading}>
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: !reduceMotion, cardStyle: { backgroundColor: colors.background } }}>
      {isAuthenticated ? <Stack.Group navigationKey="authenticated">
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="QR" component={QRGenerateScreen} />
        <Stack.Screen name="QRGenerate" component={QRGenerateScreen} />
        <Stack.Screen name="QRScan" component={QRScanScreen} />
        <Stack.Screen name="QRRequests" component={QRRequestsScreen} />
        <Stack.Screen name="QRRequestDetails" component={QRRequestDetailsScreen} />
        <Stack.Screen name="PaymentConfirm" component={PaymentConfirmScreen} />
        <Stack.Screen name="PaymentResult" component={PaymentResultScreen} />
        <Stack.Screen name="Cards" component={CardsScreen} />
        <Stack.Screen name="MyProfile" component={MyProfileScreen} />
        <Stack.Screen name="Transactions" component={TransactionsScreen} />
        <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
        <Stack.Screen name="BiometricAuth" component={BiometricAuthScreen} />
      </Stack.Group> : <Stack.Group navigationKey="guest">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Group>}
    </Stack.Navigator>
  </NavigationContainer>;
}

function ConnectionNotice() {
  const { status, checking, retry } = useNetwork();
  const { user, authError, checkAuthStatus } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  if (status !== 'unreachable' && !(user && authError)) return null;
  const reconnect = async () => { if (await retry()) await checkAuthStatus({ background: true }); };
  return <View style={{ backgroundColor: colors.warningSoft, paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 8, gap: 6 }}>
    <AppText variant="body2" color="warning" accessibilityRole="alert" accessibilityLiveRegion="polite">{status === 'unreachable'
      ? 'Connection unavailable. Changes are paused. Reconnect to check the latest status.' : authError}</AppText>
    <AppButton title="Check connection" variant="secondary" onPress={reconnect} loading={checking} />
  </View>;
}

function ThemedContent() {
  const { paperTheme, colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toastConfig = Object.fromEntries(['success', 'error', 'info'].map(type => [type, ({ text1, text2 }) =>
    <AppCard accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, { borderColor: colors[type], backgroundColor: colors.surfaceRaised }]}>
      {text1 ? <AppText variant="label">{text1}</AppText> : null}{text2 ? <AppText variant="body2" color="textSecondary" style={{ marginTop: 5 }}>{text2}</AppText> : null}
    </AppCard>]));
  return <PaperProvider theme={paperTheme}>
    <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
    <View style={{ flex: 1 }}><ConnectionNotice /><AppContent /></View><Toast config={toastConfig} topOffset={insets.top + 16} />
  </PaperProvider>;
}

function AppearanceBridge() {
  const { user } = useAuth();
  return <ThemeProvider preference={user?.preferences?.theme}><ThemedContent /></ThemeProvider>;
}

export default function App() {
  return <SafeAreaProvider><NetworkProvider><AuthProvider><NotificationProvider><AppearanceBridge /></NotificationProvider></AuthProvider></NetworkProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', gap: 20 },
  toast: { width: '90%', maxWidth: 500, borderLeftWidth: 4, padding: 16 },
});
