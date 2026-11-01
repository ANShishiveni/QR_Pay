import React, { useRef } from 'react';
import { AppButton } from '../ui';
import { decodeGalleryFile } from '../../services/qr/galleryDecoder.web';

export default function GalleryPicker({ onPick, disabled }) {
  const input = useRef(null);
  const select = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && !disabled) onPick(() => decodeGalleryFile(file));
  };
  return <>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" aria-label="Choose QR image file" data-testid="qr-gallery-input" disabled={disabled} onChange={select} style={{ display: 'none' }} />
    <AppButton title="Choose QR image" variant="secondary" icon="image-outline" onPress={() => input.current?.click()} disabled={disabled} testID="qr-gallery-button" />
  </>;
}
