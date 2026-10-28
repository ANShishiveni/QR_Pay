import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppCard, AppHeader, AppScreen, AppText, AppTextField, ErrorState, FormError, LoadingSkeleton, StatusBadge } from '../../components/ui';
import { userAPI } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { nameError, errorMessage } from '../auth/authFormUtils';
import useProfile from '../../features/profile/useProfile';
import ProfileAvatar from '../../features/profile/ProfileAvatar';
import PhotoPicker from '../../features/profile/PhotoPicker';

export default function MyProfileScreen({ navigation }) {
  const { profile, loading, error, refresh, replace } = useProfile(navigation);
  const { checkAuthStatus } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState('');
  const [photo, setPhoto] = useState(null);
  const lock = useRef(false);
  useEffect(() => { if (profile) { setFirstName(profile.firstName || ''); setLastName(profile.lastName || ''); } }, [profile?.uid]);
  const begin = label => { if (lock.current) return false; lock.current = true; setBusy(label); setFailure(''); setSuccess(''); return true; };
  const end = () => { lock.current = false; setBusy(''); };
  const saveNames = async () => {
    const next = { firstName: nameError(firstName, 'first name'), lastName: nameError(lastName, 'last name') };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !begin('names')) return;
    try {
      const response = await userAPI.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      replace(response.data.user);
      setSuccess('Your name has been saved.');
      await checkAuthStatus({ background: true });
    } catch (cause) { setFailure(errorMessage(cause, 'We could not save your name. Try again.')); }
    finally { end(); }
  };
  const selectPhoto = async read => {
    if (!begin('reading')) return;
    try { const value = await read(); if (value) setPhoto(value); }
    catch (cause) { setFailure(cause.message || 'We could not read that photo. Choose another image.'); }
    finally { end(); }
  };
  const savePhoto = async () => {
    if (!photo || !begin('photo')) return;
    try {
      const response = await userAPI.uploadPhoto({ photo });
      replace({ ...profile, photoUrl: response.data.photoUrl });
      setPhoto(null);
      setSuccess('Your profile photo has been saved.');
      await checkAuthStatus({ background: true });
    } catch (cause) { setFailure(errorMessage(cause, 'We could not save your photo. Try again.')); }
    finally { end(); }
  };
  return <AppScreen contentStyle={{ maxWidth: 680, gap: 20 }}>
    <AppHeader title="My profile" kicker="ACCOUNT DETAILS" subtitle="Make this demo account your own." onBack={() => navigation.goBack()} />
    {loading && !profile ? <LoadingSkeleton label="Loading profile details" lines={4} /> : !profile ? <ErrorState message={error} onRetry={refresh} /> : <>
      <FormError message={failure || error} />{success ? <AppText accessibilityRole="alert" color="primary">{success}</AppText> : null}
      <AppCard style={{ gap: 16, alignItems: 'center' }}><ProfileAvatar profile={profile} photo={photo} size={88} />
        <PhotoPicker onSelect={selectPhoto} disabled={!!busy} />
        <AppText variant="caption" color="textSecondary">PNG, JPEG or WebP · maximum 1 MB</AppText>
        {photo ? <View style={{ alignSelf: 'stretch', gap: 8 }}><AppText variant="body2" color="textSecondary">Preview only. Save to upload this photo to your demo account.</AppText><AppButton title="Save photo" loading={busy === 'photo'} disabled={!!busy} onPress={savePhoto} /><AppButton title="Discard photo" variant="ghost" disabled={!!busy} onPress={() => setPhoto(null)} /></View> : null}
      </AppCard>
      <AppCard style={{ gap: 18 }}><AppText variant="h3" accessibilityRole="header">Your name</AppText>
        <AppTextField label="First name" value={firstName} onChangeText={value => { setFirstName(value); setSuccess(''); setErrors(current => ({ ...current, firstName: '' })); }} error={errors.firstName} autoComplete="given-name" maxLength={60} editable={!busy} />
        <AppTextField label="Last name" value={lastName} onChangeText={value => { setLastName(value); setSuccess(''); setErrors(current => ({ ...current, lastName: '' })); }} error={errors.lastName} autoComplete="family-name" maxLength={60} editable={!busy} />
        <AppButton title="Save name" onPress={saveNames} loading={busy === 'names'} disabled={!!busy} />
      </AppCard>
      <AppCard style={{ gap: 16 }}><AppText variant="h3" accessibilityRole="header">Contact details</AppText>
        <AppTextField label="Email address" value={profile.email || ''} editable={false} hint="Read-only in this demo" />
        <StatusBadge status={profile.emailVerified ? 'verified' : 'pending'} label={profile.emailVerified ? 'Email verified' : 'Email not verified'} />
        <AppTextField label="Phone number" value={profile.phoneNumber || 'Not provided'} editable={false} hint="Read-only in this demo" />
        <StatusBadge status={profile.phoneVerified ? 'verified' : 'pending'} label={profile.phoneVerified ? 'Phone verified' : 'Phone not verified'} />
        <AppText variant="body2" color="textSecondary">Contact changes require ownership verification. Verified email and phone change services are not available in this environment. A synthetic demo verification code does not verify a real phone number.</AppText>
      </AppCard>
    </>}
  </AppScreen>;
}
