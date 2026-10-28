import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppScreen, AppText, ErrorState, FormError, LoadingSkeleton } from '../../components/ui';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../config/api';
import biometricService from '../../services/biometricService';
import useProfile from '../../features/profile/useProfile';

export default function SettingsScreen({ navigation }) {
  const { profile, loading, error, refresh, replace } = useProfile(navigation);
  const { colors, setMode } = useAppTheme();
  const { checkAuthStatus } = useAuth();
  const [values, setValues] = useState({ theme: 'system', notifications: true, biometrics: false });
  const [biometrics, setBiometrics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const appearanceRefs = useRef({});
  const appearanceModes = ['system', 'light', 'dark'];
  const selectAppearance = mode => {
    if (busy) return;
    setMessage('');
    setValues(current => ({ ...current, theme: mode }));
  };
  const appearanceKeyDown = (event, mode) => {
    if (busy) return;
    const index = appearanceModes.indexOf(mode);
    let next;
    if (event.key === ' ' || event.key === 'Spacebar') next = mode;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = appearanceModes[(index + 1) % appearanceModes.length];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = appearanceModes[(index + appearanceModes.length - 1) % appearanceModes.length];
    else if (event.key === 'Home') next = appearanceModes[0];
    else if (event.key === 'End') next = appearanceModes[appearanceModes.length - 1];
    else return;
    event.preventDefault();
    event.stopPropagation();
    selectAppearance(next);
    appearanceRefs.current[next]?.focus?.();
  };
  useEffect(() => { if (profile) setValues({ theme: 'system', notifications: true, biometrics: false, ...profile.preferences }); }, [profile?.uid]);
  useEffect(() => {
    let active = true;
    biometricService.checkAvailability().then(status => { if (active) setBiometrics(status); }).catch(() => { if (active) setBiometrics({ canUseBiometrics: false }); });
    return () => { active = false; };
  }, []);
  const toggleBiometrics = async enabled => {
    if (lock.current) return;
    setMessage('');
    if (!enabled) { setValues(current => ({ ...current, biometrics: false })); return; }
    if (!biometrics?.canUseBiometrics) return;
    lock.current = true; setBusy(true); setFailure('');
    try {
      const result = await biometricService.authenticate({ promptMessage: 'Enable optional device confirmation', disableDeviceFallback: true });
      if (result.success) setValues(current => ({ ...current, biometrics: true }));
      else setFailure('Device confirmation was not completed. Your preference is unchanged.');
    } catch { setFailure('Device confirmation is unavailable. You can still use server verification.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFailure(''); setMessage('');
    try {
      const response = await userAPI.updatePreferences(values);
      const saved = response.data.preferences;
      replace({ ...profile, preferences: saved });
      setValues(saved);
      let localFailure = false;
      try {
        await setMode(saved.theme);
        if (saved.biometrics && biometrics?.canUseBiometrics) await biometricService.enableBiometric();
        else await biometricService.disableBiometric();
      } catch { localFailure = true; }
      setMessage(localFailure ? 'Account preferences saved. This device could not save every local preference.' : 'Your preferences have been saved.');
      await checkAuthStatus({ background: true });
    } catch { setFailure('We could not save your preferences. Your changes are still here; try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <AppScreen contentStyle={{ maxWidth: 680, gap: 20 }}>
    <AppHeader title="Settings" kicker="MAKE IT YOURS" subtitle="Appearance, updates and account security." onBack={() => navigation.goBack()} />
    {loading && !profile ? <LoadingSkeleton label="Loading preferences" lines={4} /> : !profile ? <ErrorState message={error} onRetry={refresh} /> : <>
      <FormError message={failure || error} />{message ? <AppText color="primary" accessibilityRole="alert">{message}</AppText> : null}
      <AppCard style={{ gap: 16 }}><AppText variant="h3" accessibilityRole="header">Appearance</AppText><AppText color="textSecondary" variant="body2">Choose a theme, then save your preferences.</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
          {appearanceModes.map(mode => <Pressable key={mode} ref={node => { appearanceRefs.current[mode] = node; }} accessible accessibilityRole="radio" accessibilityLabel={`${mode[0].toUpperCase()}${mode.slice(1)}`} accessibilityState={{ checked: values.theme === mode, disabled: busy }} disabled={busy} onPress={() => selectAppearance(mode)}
            {...(Platform.OS === 'web' ? { 'aria-checked': values.theme === mode, 'aria-disabled': busy, tabIndex: !busy && values.theme === mode ? 0 : -1, onKeyDown: event => appearanceKeyDown(event, mode) } : {})}
            style={{ minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: values.theme === mode ? colors.primary : colors.controlBorder, backgroundColor: values.theme === mode ? colors.primarySoft : colors.surface }}><AppText variant="label" color={values.theme === mode ? 'primary' : 'text'}>{mode[0].toUpperCase()}{mode.slice(1)}</AppText></Pressable>)}
        </View>
      </AppCard>
      <AppCard style={{ gap: 16 }}><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><View style={{ flex: 1 }}><AppText variant="h3" accessibilityRole="header">In-app alerts</AppText></View>
        <Switch accessibilityLabel="Show in-app alerts" accessibilityState={{ disabled: busy, checked: values.notifications }} value={values.notifications} onValueChange={value => { setMessage(''); setValues(current => ({ ...current, notifications: value })); }} disabled={busy} trackColor={{ false: colors.controlBorder, true: colors.primary }} thumbColor={colors.surface} />
        </View><AppText variant="body2" color="textSecondary">Save whether NamPay shows in-app alerts. Your event and payment histories remain available. Push notifications are not enabled.</AppText>
      </AppCard>
      <AppCard style={{ gap: 16 }}><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}><View style={{ flex: 1 }}><AppText variant="h3" accessibilityRole="header">Device confirmation</AppText></View>
        <Switch accessibilityLabel="Optional device confirmation" accessibilityState={{ disabled: busy || (!biometrics?.canUseBiometrics && !values.biometrics), checked: values.biometrics }} value={values.biometrics} onValueChange={toggleBiometrics} disabled={busy || (!biometrics?.canUseBiometrics && !values.biometrics)} trackColor={{ false: colors.controlBorder, true: colors.primary }} thumbColor={colors.surface} />
        </View><AppText variant="body2" color="textSecondary">{biometrics === null ? 'Checking this device’s biometric capability…' : biometrics.canUseBiometrics ? 'Use an enrolled biometric for optional confirmation on this device.' : 'Biometric confirmation is unavailable on this device. Your account preference does not enable unsupported hardware.'}</AppText>
        <AppText variant="body2" color="textSecondary">This optional local prompt never replaces the server verification code required to approve a simulated payment.</AppText>
      </AppCard>
      <AppButton title="Save preferences" onPress={save} loading={busy} />
      <AppCard style={{ gap: 8 }}><AppText variant="h3" accessibilityRole="header">Account security</AppText><AppButton title="Change password" variant="ghost" icon="lock-closed-outline" onPress={() => navigation.navigate('ChangePassword')} disabled={busy} /><AppButton title="Help and FAQ" variant="ghost" onPress={() => navigation.navigate('Help')} disabled={busy} /><AppButton title="About and privacy" variant="ghost" onPress={() => navigation.navigate('About')} disabled={busy} /></AppCard>
    </>}
  </AppScreen>;
}
