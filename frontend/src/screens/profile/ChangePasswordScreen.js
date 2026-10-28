import React, { useRef, useState } from 'react';
import { AppButton, AppCard, AppHeader, AppScreen, AppText, AppTextField, FormError } from '../../components/ui';
import { userAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, passwordError } from '../auth/authFormUtils';
import Toast from 'react-native-toast-message';

export default function ChangePasswordScreen({ navigation }) {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current) return;
    const next = { current: currentPassword ? '' : 'Enter your current password.',
      password: passwordError(newPassword) || (newPassword === currentPassword ? 'Choose a different password.' : ''),
      confirmation: confirmation && confirmation === newPassword ? '' : 'Passwords must match.' };
    setErrors(next); setFailure('');
    if (Object.values(next).some(Boolean)) return;
    submitting.current = true; setBusy(true);
    try {
      await userAPI.changePassword({ currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      Toast.show({ type: 'success', text1: 'Password updated', text2: 'Sign in with your new password. Your older sessions have ended.' });
      try { await logout(); } catch { /* AuthContext keeps the session locked and explains pending revocation on login. */ }
    } catch (cause) { setFailure(errorMessage(cause, 'We could not change your password. Try again.')); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <AppScreen contentStyle={{ maxWidth: 600, gap: 20 }}>
    <AppHeader title="Change password" kicker="ACCOUNT SECURITY" subtitle="Confirm your current password to make this change." onBack={() => navigation.goBack()} />
    <FormError message={failure} />
    <AppCard style={{ gap: 18 }}>
      <AppTextField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry={!visible} error={errors.current} autoComplete="current-password" textContentType="password" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <AppTextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!visible} error={errors.password} autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" autoCorrect={false} editable={!busy} hint="Use at least 12 characters and at most 72 UTF-8 bytes." />
      <AppTextField label="Confirm new password" value={confirmation} onChangeText={setConfirmation} secureTextEntry={!visible} error={errors.confirmation} autoComplete="new-password" textContentType="newPassword" autoCapitalize="none" autoCorrect={false} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
      <AppButton title={visible ? 'Hide passwords' : 'Show passwords'} variant="ghost" icon={visible ? 'eye-off-outline' : 'eye-outline'} onPress={() => setVisible(value => !value)} disabled={busy} />
      <AppButton title="Update password" onPress={submit} loading={busy} />
    </AppCard>
    <AppText variant="body2" color="textSecondary">After a successful change, all older sessions are revoked and you’ll sign in again. Your payment records stay in your account.</AppText>
  </AppScreen>;
}
