import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthLayout, AppButton, AppCard, AppText, AppTextField, FormError } from '../../components/ui';
import { authAPI } from '../../config/api';
import { errorMessage, passwordError } from './authFormUtils';

export default function ResetPasswordScreen({ navigation, route }) {
  const [token, setToken] = useState(typeof route?.params?.token === 'string' ? route.params.token : '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [available, setAvailable] = useState(null);
  const [checking, setChecking] = useState(true);
  const submitting = useRef(false);
  const mounted = useRef(true);

  const checkAvailability = useCallback(async () => {
    setChecking(true);
    setFailure('');
    try {
      const response = await authAPI.getCapabilities();
      if (mounted.current) setAvailable(response.data.passwordRecovery === true);
    } catch (cause) {
      if (mounted.current) setFailure(errorMessage(cause, 'We could not check recovery availability. Please try again.'));
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    checkAvailability();
    return () => { mounted.current = false; };
  }, [checkAvailability]);

  const submit = async () => {
    if (submitting.current || available !== true) return;
    const next = {
      token: /^[a-f0-9]{64}$/.test(token.trim()) ? '' : 'Enter the recovery code from your private instructions.',
      password: passwordError(password),
      confirmation: confirmation && confirmation === password ? '' : 'Passwords must match.',
    };
    setErrors(next);
    setFailure('');
    if (Object.values(next).some(Boolean)) return;
    submitting.current = true;
    setBusy(true);
    try {
      await authAPI.resetPassword({ token: token.trim(), newPassword: password });
      setToken('');
      setPassword('');
      setConfirmation('');
      setComplete(true);
    } catch (cause) {
      setFailure(errorMessage(cause, 'We could not reset your password. Please try again.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <AuthLayout kicker="A FRESH START" title={complete ? 'Password updated.' : 'Choose a new password.'}
      subtitle={complete ? 'Sign in to start a new verified session.' : 'Use the code from your private recovery instructions.'} onBack={() => navigation.goBack()}>
      <FormError message={failure} />
      {checking ? <AppText accessibilityLiveRegion="polite">Checking recovery availability…</AppText> : null}
      {!checking && available === null ? <AppButton title="Retry availability check" onPress={checkAvailability} variant="secondary" /> : null}
      {!checking && available === false ? <AppCard style={{ gap: 10 }}>
        <AppText variant="h3">Account recovery is not available in this environment.</AppText>
        <AppText color="textSecondary">Contact your demo operator for a verified recovery method.</AppText>
      </AppCard> : null}
      {complete ? <>
        <AppCard accessibilityLiveRegion="polite"><AppText>Your old sessions have ended. Use your new password to sign in.</AppText></AppCard>
        <AppButton title="Return to sign in" onPress={() => navigation.navigate('Login')} />
      </> : available === true ? <>
        <AppTextField label="Recovery code" value={token} onChangeText={value => { setToken(value); setErrors(current => ({ ...current, token: '' })); }} error={errors.token}
          hint="This private code expires and can only be used once." secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={128} editable={!busy} />
        <AppTextField label="New password" value={password} onChangeText={value => { setPassword(value); setErrors(current => ({ ...current, password: '' })); }} error={errors.password}
          hint="Use at least 12 characters. A memorable passphrase works well." secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} />
        <AppTextField label="Confirm new password" value={confirmation} onChangeText={value => { setConfirmation(value); setErrors(current => ({ ...current, confirmation: '' })); }} error={errors.confirmation}
          secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
        <AppButton title={visible ? 'Hide passwords' : 'Show passwords'} variant="ghost" icon={visible ? 'eye-off-outline' : 'eye-outline'} onPress={() => setVisible(value => !value)} disabled={busy} />
        <AppButton title="Reset password" onPress={submit} loading={busy} disabled={busy} />
        <AppButton title="Request new instructions" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} disabled={busy} />
      </> : null}
      {!complete ? <AppButton title="Back to sign in" variant="ghost" onPress={() => navigation.navigate('Login')} disabled={busy} /> : null}
    </AuthLayout>
  );
}
