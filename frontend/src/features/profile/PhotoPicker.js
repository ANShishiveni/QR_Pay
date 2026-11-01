import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { AppButton } from '../../components/ui';
import { readProfilePhotoAsset } from './photoReader';

export default function PhotoPicker({ onSelect, disabled = false }) {
  const select = () => onSelect(async () => {
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false,
        allowsMultipleSelection: false, quality: 1, base64: false, exif: false });
    } catch { throw new Error('We could not open your photo picker. Please try again.'); }
    if (result.canceled) return null;
    return readProfilePhotoAsset(result.assets?.[0]);
  });
  return <AppButton title="Change photo" icon="image-outline" variant="secondary" onPress={select} disabled={disabled} testID="profile-photo-button" />;
}
