import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { AppText } from '../../components/ui';
import { useAppTheme } from '../../context/ThemeContext';

export default function ProfileAvatar({ profile, photo, size = 76 }) {
  const { colors } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const uri = photo || profile?.photoUrl;
  useEffect(() => setFailed(false), [uri]);
  const allowed = typeof uri === 'string' && uri.length <= 1400000 && /^data:image\/(png|jpeg|webp);base64,/.test(uri);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return allowed && !failed ? <Image source={{ uri }} style={shape} accessibilityLabel="Profile photo" onError={() => setFailed(true)} />
    : <View accessible accessibilityLabel="Profile initials" style={[shape, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}><AppText variant="h2" color="primary">{`${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase() || 'N'}</AppText></View>;
}
