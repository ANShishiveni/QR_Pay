import React, { useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppCard, AppScreen, AppText, BrandMark, DemoModeBadge } from '../../components/ui';
import { useAppTheme } from '../../context/ThemeContext';

const panels = [
  { title: 'Payments, made clear.', message: 'Create a request, scan a QR, and follow each step in one place.', icon: 'qr-code-outline', label: '01 / REQUEST & SCAN' },
  { title: 'Every step, in view.', message: 'Review the amount and recipient. Verify your approval. Keep a clear record of each simulated payment.', icon: 'receipt-outline', label: '02 / REVIEW & TRACK' },
  { title: 'A safer space to try.', message: 'NamPay is a sandbox prototype. Use test accounts and test instruments to explore the flow. No real money moves.', icon: 'shield-checkmark-outline', label: '03 / EXPLORE WITH CONFIDENCE' },
];

export default function OnboardingScreen({ onComplete, loading = false }) {
  const [step, setStep] = useState(0);
  const heading = useRef(null);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const panel = panels[step];
  const next = () => {
    if (step === panels.length - 1) { onComplete(); return; }
    setStep(current => current + 1);
    requestAnimationFrame(() => {
      if (Platform.OS === 'web') heading.current?.focus?.();
      else { const tag = findNodeHandle(heading.current); if (tag) AccessibilityInfo.setAccessibilityFocus(tag); }
    });
  };

  return <AppScreen contentStyle={styles.screen} testID="onboarding-screen">
    <View style={styles.top}><BrandMark /><AppButton title="Skip" variant="ghost" onPress={onComplete} disabled={loading} testID="onboarding-skip" /></View>
    <View style={[styles.main, wide && styles.mainWide]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[styles.art, { backgroundColor: colors.hero }, wide && styles.artWide]}>
        <View style={[styles.artLabel, { borderColor: colors.heroMuted }]}><AppText variant="caption" color="heroMuted">BUILT FOR THE DEMONSTRATION</AppText></View>
        <View style={[styles.symbol, { backgroundColor: colors.surface }]}><Ionicons name={panel.icon} size={86} color={colors.primary} /></View>
        {step === 0 ? <View style={styles.artCaption}><AppText variant="h3" color="heroText">One request. One clear flow.</AppText><AppText variant="body2" color="heroMuted">Request · Scan · Simulate</AppText></View> : step === 1 ?
          <View style={styles.miniSteps}>{['Review', 'Verify', 'Record'].map((label, index) => <View key={label} style={styles.miniStep}><View style={[styles.stepNumber, { backgroundColor: colors.surface }]}><AppText variant="label" color="primary">{index + 1}</AppText></View><AppText variant="body2" color="heroText">{label}</AppText></View>)}</View> :
          <View style={styles.artCaption}><AppText variant="h3" color="heroText">Test instruments only.</AppText><AppText variant="body2" color="heroMuted">No real funds. No bank settlement.</AppText></View>}
      </View>
      <View style={[styles.copy, wide && styles.copyWide]}>
        <View style={{ gap: 16 }}><DemoModeBadge /><AppText variant="kicker" color="primary">{panel.label}</AppText>
          <AppText ref={heading} variant="h1" accessibilityRole="header" tabIndex={-1}>{panel.title}</AppText>
          <AppText color="textSecondary">{panel.message}</AppText>
        </View>
        {step === 2 ? <AppCard style={{ padding: 16 }}><AppText variant="body2" color="textSecondary">You choose when to allow camera access. NamPay asks only when you open the scanner.</AppText></AppCard> : null}
        <View style={styles.bottom}>
          <View style={styles.progress} accessibilityLabel={`Introduction, step ${step + 1} of ${panels.length}`} accessible>
            {panels.map((_, index) => <View key={index} style={[styles.dot, { width: step === index ? 28 : 8, backgroundColor: step === index ? colors.primary : colors.controlBorder }]} />)}
          </View>
          <AppButton title={step === 2 ? 'Get started' : 'Continue'} icon={step === 2 ? 'arrow-forward-outline' : undefined} onPress={next} loading={loading} testID="onboarding-next" />
          <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>Designed for Namibia. Demonstration only.</AppText>
        </View>
      </View>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 1180, paddingTop: 20, paddingBottom: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 8 },
  main: { flex: 1, gap: 28 }, mainWide: { flexDirection: 'row', gap: 64, alignItems: 'center', paddingVertical: 24 },
  art: { minHeight: 270, borderRadius: 24, padding: 24, alignItems: 'center', justifyContent: 'space-between', gap: 24 }, artWide: { flex: 1, minHeight: 560, paddingVertical: 48 },
  artLabel: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  symbol: { width: 138, height: 138, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  artCaption: { alignItems: 'center', gap: 6 },
  copy: { gap: 24 }, copyWide: { flex: 1, maxWidth: 470 }, bottom: { gap: 18, marginTop: 8 },
  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, dot: { height: 8, borderRadius: 5 },
  miniSteps: { flexDirection: 'row', gap: 24 }, miniStep: { alignItems: 'center', gap: 8 }, stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
