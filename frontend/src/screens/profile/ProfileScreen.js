import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppScreen, AppText, ConfirmBottomSheet, DemoModeBadge, ErrorState, FormError, LoadingSkeleton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useProfile from '../../features/profile/useProfile';
import ProfileAvatar from '../../features/profile/ProfileAvatar';
import { useNotifications } from '../../context/NotificationContext';

export default function ProfileScreen({ navigation }) {
  const { logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { profile, loading, error, refresh } = useProfile(navigation);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const lock = useRef(false);
  const signOut = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await logout(); }
    catch { setFailure('Signed out on this screen. Reconnect to finish ending your server session.'); }
    finally { lock.current = false; setBusy(false); setConfirm(false); }
  };
  return <AppScreen contentStyle={{ gap: 20 }}>
    <AppHeader title="Your profile" kicker="ACCOUNT" subtitle="Your details, your preferences." />
    {loading && !profile ? <LoadingSkeleton label="Loading profile" lines={4} /> : !profile ? <ErrorState message={error} onRetry={refresh} /> : <>
      <FormError message={error || failure} />
      <AppCard style={{ gap: 16 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}><ProfileAvatar profile={profile} />
        <View style={{ flex: 1, gap: 5 }}><AppText variant="h2">{profile.firstName} {profile.lastName}</AppText><AppText variant="body2" color="textSecondary">{profile.email}</AppText></View></View><DemoModeBadge />
      </AppCard>
      <AppCard style={{ gap: 8 }}>
        <AppButton title="My profile" icon="person-outline" variant="ghost" onPress={() => navigation.navigate('MyProfile')} />
        <AppButton title="Test instruments" icon="card-outline" variant="ghost" onPress={() => navigation.navigate('Cards')} />
        <AppButton title="Settings" icon="settings-outline" variant="ghost" onPress={() => navigation.navigate('Settings')} />
        <AppButton title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'} icon="notifications-outline" variant="ghost" onPress={() => navigation.navigate('Notifications')} />
        <AppButton title="Help and FAQ" icon="help-circle-outline" variant="ghost" onPress={() => navigation.navigate('Help')} />
        <AppButton title="About and privacy" icon="information-circle-outline" variant="ghost" onPress={() => navigation.navigate('About')} />
      </AppCard>
      <AppText variant="caption" color="textSecondary">NamPay is a demonstration. Test instruments and receipts do not move real funds.</AppText>
    </>}
    <AppButton title="Sign out" icon="log-out-outline" variant="secondary" onPress={() => { setFailure(''); setConfirm(true); }} />
    <ConfirmBottomSheet visible={confirm} title="Sign out of NamPay?" message="Your local session will be cleared. You’ll need to sign in to view this account again." confirmLabel="Sign out now" onConfirm={signOut} onCancel={() => setConfirm(false)} loading={busy} />
  </AppScreen>;
}
