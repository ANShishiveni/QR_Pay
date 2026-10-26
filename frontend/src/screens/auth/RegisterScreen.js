import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout, AppButton, AppText, AppTextField, PhoneField, FormError } from '../../components/ui';
import { authAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { emailError, errorMessage, nameError, normalizeEmail, passwordError, phoneError } from './authFormUtils';

const initialForm = { firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' };

export default function RegisterScreen({ navigation }) {
  const { login } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const change = key => value => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })); };

  const submit = async () => {
    if (submitting.current) return;
    const next = {
      firstName: nameError(form.firstName, 'first name'), lastName: nameError(form.lastName, 'last name'),
      email: emailError(form.email), phoneNumber: phoneError(form.phoneNumber), password: passwordError(form.password),
      confirmPassword: form.confirmPassword === form.password && form.confirmPassword ? '' : 'Passwords must match.',
    };
    setErrors(next); setFailure('');
    if (Object.values(next).some(Boolean)) return;
    submitting.current = true; setBusy(true);
    let created = false;
    try {
      const response = await authAPI.register({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: normalizeEmail(form.email), phoneNumber: form.phoneNumber.trim(), password: form.password });
      created = true;
      await login(response.data.token);
      setForm(initialForm);
    } catch (error) {
      setFailure(created ? 'Your account was created. Sign in to finish verifying your session.' : errorMessage(error, 'We could not create your account. Please try again.'));
    } finally { submitting.current = false; setBusy(false); }
  };

  return (
    <AuthLayout kicker="LET’S GET STARTED" title="Your demo starts here." subtitle="Create an account to request, scan, and simulate." onBack={() => navigation.goBack()}
      footer={<View style={styles.footer}><AppText color="textSecondary">Already have an account?</AppText><AppButton title="Sign in" variant="ghost" onPress={() => navigation.navigate('Login')} disabled={busy} /></View>}
    >
      <FormError message={failure} />
      <View style={styles.names}>
        <View style={styles.name}><AppTextField label="First name" value={form.firstName} onChangeText={change('firstName')} error={errors.firstName} autoComplete="given-name" textContentType="givenName" maxLength={60} editable={!busy} /></View>
        <View style={styles.name}><AppTextField label="Last name" value={form.lastName} onChangeText={change('lastName')} error={errors.lastName} autoComplete="family-name" textContentType="familyName" maxLength={60} editable={!busy} /></View>
      </View>
      <AppTextField label="Email address" value={form.email} onChangeText={change('email')} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} />
      <PhoneField label="Phone number (optional)" value={form.phoneNumber} onChangeText={change('phoneNumber')} error={errors.phoneNumber} hint="Adding a number does not verify phone ownership." autoComplete="tel" textContentType="telephoneNumber" editable={!busy} />
      <AppTextField label="Password" value={form.password} onChangeText={change('password')} error={errors.password} hint="Use at least 12 characters. A memorable passphrase works well." secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} />
      <AppTextField label="Confirm password" value={form.confirmPassword} onChangeText={change('confirmPassword')} error={errors.confirmPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
      <AppButton title={visible ? 'Hide passwords' : 'Show passwords'} variant="ghost" icon={visible ? 'eye-off-outline' : 'eye-outline'} onPress={() => setVisible(value => !value)} disabled={busy} />
      <AppButton title="Create demo account" icon="arrow-forward" onPress={submit} loading={busy} disabled={busy} />
      <AppText variant="caption" color="textSecondary" style={styles.note}>Use synthetic details for this prototype. NamPay does not open bank accounts or transfer real money.</AppText>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, name: { flex: 1, minWidth: 130 },
  footer: { alignItems: 'center', gap: 4 }, note: { textAlign: 'center', marginTop: 4 },
});
