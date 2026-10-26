import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AuthLayout, AppButton, AppCard, AppText, AppTextField, FormError } from '../../components/ui';
import { authAPI } from '../../config/api';
import { emailError, errorMessage, normalizeEmail } from './authFormUtils';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [failure, setFailure] = useState('');
  const [available, setAvailable] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const mounted = useRef(true);
  const submitting = useRef(false);

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
    const validation = emailError(email);
    setError(validation);
    setFailure('');
    if (validation) return;
    submitting.current = true;
    setBusy(true);
    try {
      await authAPI.forgotPassword(normalizeEmail(email));
      if (mounted.current) setSent(true);
    } catch (cause) {
      if (mounted.current) setFailure(errorMessage(cause, 'We could not request recovery instructions. Please try again.'));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <AuthLayout kicker="ACCOUNT RECOVERY" title={sent ? 'Check your instructions.' : 'Let’s get you back in.'}
      subtitle="Recovery requires proof that the account is yours." onBack={() => navigation.goBack()}>
      <FormError message={failure} />
      {checking ? <AppText accessibilityLiveRegion="polite">Checking recovery availability…</AppText> : null}
      {!checking && available === null ? <AppButton title="Retry availability check" onPress={checkAvailability} variant="secondary" /> : null}
      {!checking && available === false ? <AppCard style={{ gap: 10 }}>
        <AppText variant="h3">Account recovery is not available in this environment.</AppText>
        <AppText color="textSecondary">Contact your demo operator for help. Your password cannot be reset without a verified recovery method.</AppText>
      </AppCard> : null}
      {sent ? <AppCard style={{ gap: 10 }} accessibilityLiveRegion="polite">
        <AppText variant="label">If this account can receive recovery instructions, they have been sent.</AppText>
        <AppText color="textSecondary">Follow your private recovery instructions. In a local demo, your demo operator provides them.</AppText>
      </AppCard> : available === true ? <>
        <AppTextField label="Email address" value={email} onChangeText={value => { setEmail(value); setError(''); }} error={error}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
          editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
        <AppButton title="Request recovery instructions" onPress={submit} loading={busy} disabled={busy} />
        <AppText variant="caption" color="textSecondary">For privacy, this screen does not reveal whether an account exists.</AppText>
      </> : null}
      {available === true ? <AppButton title="I have recovery instructions" variant="secondary" onPress={() => navigation.navigate('ResetPassword')} disabled={busy} /> : null}
      <AppButton title="Back to sign in" variant="ghost" onPress={() => navigation.navigate('Login')} disabled={busy} />
    </AuthLayout>
  );
}
