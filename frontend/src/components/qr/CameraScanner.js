import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AppText, LoadingSkeleton } from '../ui';

// This component is mounted only after the user explicitly chooses Start camera.
export default function CameraScanner({ onRead, onError }) {
  const [permission, requestPermission] = useCameraPermissions();
  const requested = useRef(false);
  const alive = useRef(true);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!permission || permission.granted || requested.current) return;
    requested.current = true;
    requestPermission().then(result => {
      if (alive.current && !result.granted) errorHandler.current({ kind: 'permission', canAskAgain: result.canAskAgain });
    }).catch(() => { if (alive.current) errorHandler.current({ kind: 'unavailable' }); });
  }, [permission, requestPermission]);
  if (!permission?.granted) return <View style={styles.loading}><LoadingSkeleton label="Checking camera permission" /><AppText>Waiting for camera access…</AppText></View>;
  return <CameraView style={styles.camera} facing="back" mode="picture" mute autofocus="on" enableTorch={false}
    barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={event => onRead(event.data)}
    onMountError={() => onError({ kind: 'unavailable' })} accessibilityLabel="Camera preview for a payment QR code" />;
}

const styles = StyleSheet.create({ camera: { flex: 1 }, loading: { flex: 1, padding: 24, justifyContent: 'center' } });
