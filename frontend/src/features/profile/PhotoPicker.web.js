import React, { useRef } from 'react';
import { AppButton } from '../../components/ui';
import { readProfilePhotoFile } from './photoReader.web';

export default function PhotoPicker({ onSelect, disabled = false }) {
  const input = useRef(null);
  const select = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && !disabled) onSelect(() => readProfilePhotoFile(file));
  };
  return <>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" data-testid="profile-photo-input"
      aria-label="Choose profile photo file" disabled={disabled} onChange={select} style={{ display: 'none' }} />
    <AppButton title="Change photo" icon="image-outline" variant="secondary" disabled={disabled} onPress={() => input.current?.click()} testID="profile-photo-button" />
  </>;
}
