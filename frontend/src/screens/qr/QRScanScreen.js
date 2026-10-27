import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppCard, AppHeader, AppScreen, AppText, DemoModeBadge, FormError, LoadingSkeleton, SecurityPrompt } from '../../components/ui';
import CameraScanner from '../../components/qr/CameraScanner';
import GalleryPicker from '../../components/qr/GalleryPicker';
import { useAppTheme } from '../../context/ThemeContext';
import { qrAPI } from '../../config/api';
import { prepareScanPayload, scanErrorMessage } from '../../services/qr/scanValidation';

export default function QRScanScreen({ navigation }) {
  const { colors } = useAppTheme();
  const focused = useIsFocused();
  const [cameraRequested, setCameraRequested] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [active, setActive] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const locked = useRef(false);
  const run = useRef(0);
  const alive = useRef(true);
  const focusedRef = useRef(focused);
  const activeRef = useRef(active);
  focusedRef.current = focused;
  const busy = ['reading', 'validating', 'ready'].includes(phase);

  useEffect(() => {
    alive.current = true;
    const listener = AppState.addEventListener('change', state => {
      const current = state === 'active';
      activeRef.current = current;
      setActive(current);
      if (!current) setCameraRequested(false);
    });
    return () => { alive.current = false; run.current += 1; listener.remove(); };
  }, []);
  useEffect(() => {
    run.current += 1;
    locked.current = false;
    setCameraRequested(false);
    setPhase('idle');
  }, [focused]);

  const processScan = useCallback(async (read, source) => {
    if (locked.current || !focusedRef.current || !activeRef.current) return;
    locked.current = true; // Guard synchronously: camera callbacks can arrive before React renders.
    const currentRun = ++run.current;
    setCameraRequested(false);
    setPermissionBlocked(false);
    setError('');
    setPhase(source === 'gallery' ? 'reading' : 'validating');
    const current = () => alive.current && focusedRef.current && run.current === currentRun;
    let validating = false;
    let completed = false;
    try {
      const raw = await read();
      if (!current()) return;
      if (raw === null) return; // Photo picker cancelled; no request is sent.
      const payload = prepareScanPayload(raw);
      if (!activeRef.current) throw new Error('Scanning paused. Return to NamPay and scan the request again.');
      setPhase('validating');
      validating = true;
      const response = await qrAPI.scanQR(payload);
      if (!current()) return;
      if (!activeRef.current) { setError('Scanning paused. Return to NamPay and scan the request again.'); return; }
      const requestId = response.data?.paymentRequest?.id;
      if (typeof requestId !== 'string' || !requestId) throw new Error('Missing request');
      completed = true;
      setPhase('ready');
      navigation.navigate('PaymentConfirm', { requestId });
    } catch (cause) {
      if (current()) setError(validating ? scanErrorMessage(cause) : cause?.message || 'We could not read that image. Try a clear QR image.');
    } finally {
      if (current() && !completed) { locked.current = false; setPhase('idle'); }
    }
  }, [navigation]);

  const cameraError = useCallback(({ kind, canAskAgain }) => {
    setCameraRequested(false);
    setPermissionBlocked(kind === 'permission' && canAskAgain === false);
    setError(kind === 'permission'
      ? 'Camera access is off. Allow access when prompted, update your device or browser settings, or choose a QR image.'
      : kind === 'unsupported' ? 'Camera scanning is unavailable in this browser. Open NamPay over HTTPS or choose a QR image.'
        : 'We could not start your camera. Close other camera apps and retry, or choose a QR image.');
  }, []);
  const startCamera = () => { if (locked.current || !activeRef.current) return; setError(''); setCameraRequested(true); };
  const openSettings = async () => {
    try { await Linking.openSettings(); }
    catch { setError('Open your device settings and allow camera access for NamPay, then return and try again.'); }
  };

  return <AppScreen contentStyle={styles.screen} testID="qr-scan-screen">
    <AppHeader title="Scan a request" kicker="PAYMENTS" subtitle="A clear view. A careful review." onBack={() => navigation.goBack()} />
    <DemoModeBadge />
    <View style={[styles.preview, { backgroundColor: colors.hero, borderColor: colors.border }]}>
      {cameraRequested && focused && active && !busy ? <>
        <CameraScanner onRead={raw => processScan(() => Promise.resolve(raw), 'camera')} onError={cameraError} />
        <View pointerEvents="none" style={styles.frameOverlay}><View style={[styles.frame, { borderColor: colors.heroText }]} /></View>
      </> : <View style={styles.placeholder}>
        <View style={[styles.symbol, { borderColor: colors.heroMuted }]}><Ionicons name={busy ? 'shield-checkmark-outline' : 'scan-outline'} size={54} color={colors.heroText} /></View>
        <AppText variant="h3" color="heroText" style={styles.center}>{busy ? phase === 'reading' ? 'Reading your image' : 'Checking the request' : 'Bring the QR into focus'}</AppText>
        <AppText color="heroMuted" style={styles.center}>{busy ? 'We’ll verify the request before you review any payment.' : 'Start the camera or choose a saved QR image.'}</AppText>
      </View>}
    </View>
    {busy ? <LoadingSkeleton label={phase === 'reading' ? 'Reading QR image' : 'Verifying payment request'} lines={2} /> : null}
    <FormError message={error} />
    <View style={styles.actions}>
      {cameraRequested ? <AppButton title="Pause camera" icon="pause-outline" variant="secondary" onPress={() => setCameraRequested(false)} />
        : <AppButton title={error ? 'Try camera again' : 'Start camera'} icon="camera-outline" onPress={startCamera} disabled={busy || !active} />}
      {permissionBlocked && Platform.OS !== 'web' ? <AppButton title="Open device settings" variant="ghost" onPress={openSettings} disabled={busy} /> : null}
      <GalleryPicker disabled={busy || !active} onPick={read => processScan(read, 'gallery')} />
    </View>
    <AppCard style={{ gap: 10 }}><AppText variant="label">Keep the full code in view</AppText>
      <AppText variant="body2" color="textSecondary">Use a clear image with one QR code. The recipient, amount and expiry are checked with NamPay before the review opens.</AppText>
      <AppText variant="caption" color="textSecondary">Images are decoded on your device. Only the QR request is sent for verification.</AppText>
    </AppCard>
    <SecurityPrompt title="Scanning does not approve a payment" message="You’ll review the amount and recipient, choose a test instrument and verify your approval. No real funds move." />
  </AppScreen>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 620, gap: 18 }, preview: { minHeight: 300, height: 330, borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 16 },
  symbol: { height: 90, width: 90, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  center: { textAlign: 'center' }, actions: { gap: 12 }, frameOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 210, height: 210, borderWidth: 2, borderRadius: 20 },
});
