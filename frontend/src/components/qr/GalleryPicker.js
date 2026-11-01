import React from 'react';
import * as ImagePicker from 'expo-image-picker';
import { AppButton } from '../ui';
import { decodeGalleryAsset } from '../../services/qr/galleryDecoder.native';

export default function GalleryPicker({ onPick, disabled }) {
  const pick = () => onPick(async () => {
    let result;
    try { result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, quality: 1, exif: false, base64: false }); }
    catch { throw new Error('We could not open your photo picker. Try again or use the camera.'); }
    if (result.canceled) return null;
    return decodeGalleryAsset(result.assets?.[0]);
  });
  return <AppButton title="Choose QR image" variant="secondary" icon="image-outline" onPress={pick} disabled={disabled} testID="qr-gallery-button" />;
}
