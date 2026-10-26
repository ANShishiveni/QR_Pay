import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout, AppButton, AppText, AppTextField, FormError } from '../../components/ui';
import { authAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { emailError, errorMessage, normalizeEmail } from './authFormUtils';

export default function LoginScreen({ navigation }) {
  const { login, authError, checkAuthStatus } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    const next = { email: emailError(email), password: password ? '' : 'Enter your password.' };
    setErrors(next);
    setFailure('');
    if (Object.values(next).some(Boolean)) return;
    submitting.current = true;
    setBusy(true);
    try {
      const response = await authAPI.login({ email: normalizeEmail(email), password });
      // Web uses its HttpOnly cookie; native receives a token for SecureStore.
      await login(response.data.token);
      setPassword('');
    } catch (error) {
      setFailure(errorMessage(error, 'We could not sign you in. Please try again.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <AuthLayout kicker="WELCOME BACK" title="Good to see you." subtitle="Sign in to your NamPay demo account."
      footer={<View style={styles.footer}><AppText color="textSecondary">New to NamPay?</AppText><AppButton title="Create an account" variant="ghost" onPress={() => navigation.navigate('Register')} disabled={busy} /></View>}
    >
      {authError ? <><FormError message={authError} /><AppButton title="Retry session check" variant="secondary" onPress={checkAuthStatus} disabled={busy} /></> : null}
      <FormError message={failure} />
      <AppTextField label="Email address" value={email} onChangeText={value => { setEmail(value); setErrors(current => ({ ...current, email: '' })); }} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} returnKeyType="next" />
      <AppTextField label="Password" value={password} onChangeText={value => { setPassword(value); setErrors(current => ({ ...current, password: '' })); }} error={errors.password} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
      <View style={styles.actions}>
        <AppButton title={visible ? 'Hide password' : 'Show password'} icon={visible ? 'eye-off-outline' : 'eye-outline'} variant="ghost" onPress={() => setVisible(value => !value)} disabled={busy} />
        <AppButton title="Forgot password?" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} disabled={busy} />
      </View>
      <AppButton title="Sign in" icon="arrow-forward" onPress={submit} loading={busy} disabled={busy} />
      <AppText variant="caption" color="textSecondary" style={styles.note}>A safe place to explore QR payments. No real funds move.</AppText>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  footer: { alignItems: 'center', gap: 4 },
  note: { textAlign: 'center', marginTop: 4 },
});
