import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import jsQR from 'jsqr';
import { AppButton, AppText } from '../ui';

// Expo SDK 53's web scanner loads a CDN worker. This preview uses the bundled
// decoder instead; image pixels never leave the browser.
export default function CameraScanner({ onRead, onError }) {
  const video = useRef(null);
  const stream = useRef(null);
  const readHandler = useRef(onRead);
  const errorHandler = useRef(onError);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [torchError, setTorchError] = useState('');
  readHandler.current = onRead;
  errorHandler.current = onError;
  useEffect(() => {
    let alive = true;
    let timer;
    const stop = () => stream.current?.getTracks().forEach(track => track.stop());
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { errorHandler.current({ kind: 'unsupported' }); return; }
      try {
        const source = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!alive) { source.getTracks().forEach(track => track.stop()); return; }
        stream.current = source;
        const track = source.getVideoTracks()[0];
        setTorchAvailable(track?.getCapabilities?.().torch === true);
        track.onended = () => { if (alive) errorHandler.current({ kind: 'unavailable' }); };
        video.current.srcObject = source;
        await video.current.play();
        if (!alive) return;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas unavailable');
        const scan = () => {
          if (!alive) return;
          const frame = video.current;
          if (frame?.readyState >= 2 && frame.videoWidth && frame.videoHeight) {
            const ratio = Math.min(1, 960 / frame.videoWidth, 960 / frame.videoHeight);
            canvas.width = Math.max(1, Math.round(frame.videoWidth * ratio));
            canvas.height = Math.max(1, Math.round(frame.videoHeight * ratio));
            try {
              context.drawImage(frame, 0, 0, canvas.width, canvas.height);
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
              const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
              if (result?.data) { readHandler.current(result.data); return; }
            } catch { errorHandler.current({ kind: 'unavailable' }); return; }
          }
          timer = setTimeout(scan, 250);
        };
        scan();
      } catch (error) {
        stop();
        if (alive) errorHandler.current({ kind: ['NotAllowedError', 'PermissionDeniedError'].includes(error?.name) ? 'permission' : 'unavailable', canAskAgain: true });
      }
    };
    start();
    return () => { alive = false; clearTimeout(timer); stop(); if (video.current) video.current.srcObject = null; };
  }, []);

  const toggleTorch = async () => {
    if (torchBusy) return;
    setTorchBusy(true);
    setTorchError('');
    try { await stream.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(value => !value); }
    catch { setTorchError('The light is unavailable. Try brighter surroundings.'); setTorchAvailable(false); }
    finally { setTorchBusy(false); }
  };
  return <View style={styles.container}>
    <video ref={video} autoPlay muted playsInline aria-label="Camera preview for a payment QR code" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    {torchAvailable ? <View style={styles.controls}><AppButton title={torch ? 'Turn light off' : 'Turn light on'} variant="secondary" icon="flashlight-outline" loading={torchBusy} onPress={toggleTorch} /></View> : null}
    {torchError ? <View style={styles.controls}><AppText accessibilityRole="alert">{torchError}</AppText></View> : null}
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, controls: { position: 'absolute', bottom: 16, left: 16, right: 16 } });
