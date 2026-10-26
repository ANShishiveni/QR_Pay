import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, findNodeHandle, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { formatDate, formatMoney } from '../../utils/money';

export const AppText = forwardRef(function AppText({ variant = 'body', color, style, children, ...props }, ref) {
  const { colors, typography } = useAppTheme();
  return <Text ref={ref} {...props} style={[typography[variant] || typography.body, { color: colors[color] || color || colors.text }, style]}>{children}</Text>;
});

export function AppScreen({ children, scroll = true, padded = true, style, contentStyle, refreshControl, edges, ...props }) {
  const { colors } = useAppTheme();
  const content = [styles.screenContent, padded && styles.screenPadding, contentStyle];
  return (
    <SafeAreaView edges={edges || ['top', 'bottom', 'left', 'right']} style={[styles.screen, { backgroundColor: colors.background }, style]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? <ScrollView {...props} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={refreshControl}
          contentContainerStyle={content}>{children}</ScrollView> : <View {...props} style={content}>{children}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BrandMark({ inverse = false, compact = false }) {
  const { colors } = useAppTheme();
  return <View style={styles.brand} accessible accessibilityLabel="NamPay, simulated payments">
    <View style={[styles.brandIcon, { backgroundColor: inverse ? 'rgba(255,255,255,0.12)' : colors.primarySoft }]}>
      <Ionicons name="scan-outline" size={compact ? 23 : 27} color={inverse ? colors.heroText : colors.primary} />
    </View>
    <AppText variant={compact ? 'h3' : 'h2'} color={inverse ? colors.heroText : colors.navy} style={{ letterSpacing: -0.8 }}>NamPay</AppText>
    <View style={[styles.version, { borderColor: inverse ? colors.heroMuted : colors.border }]}><AppText variant="caption" color={inverse ? colors.heroMuted : colors.textSecondary}>2.0</AppText></View>
  </View>;
}

export function AppHeader({ title, subtitle, kicker, onBack, right, style }) {
  const { colors } = useAppTheme();
  return <View style={[styles.header, style]}>
    <View style={styles.headerTop}>
      {onBack ? <IconButton name="arrow-back" label="Go back" onPress={onBack} /> : null}
      <View style={styles.flex}>
        {kicker ? <AppText variant="kicker" color={colors.primary} style={styles.kicker}>{kicker.toUpperCase()}</AppText> : null}
        <AppText variant="h1" accessibilityRole="header">{title}</AppText>
      </View>
      {right || null}
    </View>
    {subtitle ? <AppText color={colors.textSecondary} style={styles.subtitle}>{subtitle}</AppText> : null}
  </View>;
}

export function IconButton({ name, label, onPress, disabled, color, style, ...props }) {
  const { colors } = useAppTheme();
  return <Pressable {...props} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? colors.primarySoft : 'transparent', opacity: disabled ? 0.5 : 1 }, style]}>
    <Ionicons name={name} size={23} color={color || colors.text} />
  </Pressable>;
}

export function AppButton({ title, children, onPress, variant = 'primary', icon, loading = false, disabled = false, style, textStyle, ...props }) {
  const { colors } = useAppTheme();
  const blocked = disabled || loading;
  const fills = { primary: colors.primary, secondary: colors.surface, ghost: 'transparent', danger: colors.error };
  const foreground = blocked ? colors.onDisabled : ['primary', 'danger'].includes(variant) ? (variant === 'primary' ? colors.onPrimary : colors.onError) : colors.primary;
  return <Pressable {...props} onPress={onPress} disabled={blocked} accessibilityRole="button"
    accessibilityLabel={props.accessibilityLabel || (typeof title === 'string' ? title : undefined)}
    accessibilityState={{ disabled: blocked, busy: loading }}
    style={({ pressed }) => [styles.button, { backgroundColor: blocked ? colors.disabled : fills[variant] || fills.primary,
      borderColor: variant === 'secondary' ? colors.border : 'transparent', opacity: pressed ? 0.82 : 1 }, style]}>
    {loading ? <ActivityIndicator color={foreground} size="small" /> : icon ? <Ionicons name={icon} color={foreground} size={20} /> : null}
    <AppText variant="button" color={foreground} style={[styles.buttonText, textStyle]}>{title || children}</AppText>
  </Pressable>;
}

export const AppTextField = forwardRef(function AppTextField({ label, error, hint, style, inputStyle, trailing, leading, onFocus, onBlur, ...props }, ref) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return <View style={[styles.field, style]}>
    <AppText variant="label" style={styles.fieldLabel}>{label}</AppText>
    <View style={[styles.inputFrame, { backgroundColor: colors.surface, borderColor: error ? colors.error : focused ? colors.primary : colors.controlBorder, borderWidth: focused || error ? 2 : 1 }]}>
      {leading}
      <TextInput ref={ref} {...props} accessibilityLabel={props.accessibilityLabel || label} accessibilityHint={error || hint || props.accessibilityHint}
        placeholderTextColor={colors.textSecondary} selectionColor={colors.primary}
        onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, { color: colors.text }, Platform.OS === 'web' && { outlineStyle: 'none' }, inputStyle]} />
      {trailing}
    </View>
    {error ? <AppText variant="caption" color={colors.error} accessibilityRole="alert" style={styles.fieldHint}>{error}</AppText>
      : hint ? <AppText variant="caption" color={colors.textSecondary} style={styles.fieldHint}>{hint}</AppText> : null}
  </View>;
});

export const PhoneField = props => <AppTextField keyboardType="phone-pad" autoComplete="tel" maxLength={20} {...props} />;
export const MoneyInput = props => <AppTextField label="Amount (NAD)" keyboardType="decimal-pad" maxLength={9}
  hint="Between N$0.01 and N$10,000.00" leading={<AppText variant="h3" style={{ paddingLeft: 16 }}>N$</AppText>} {...props} />;

export function FormError({ message, children, style }) {
  const { colors } = useAppTheme();
  if (!message && !children) return null;
  return <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: colors.errorSoft }, style]}>
    <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
    <AppText variant="body2" color={colors.error} style={styles.flex}>{message || children}</AppText>
  </View>;
}

export function AppCard({ children, style, onPress, accessibilityLabel, ...props }) {
  const { colors } = useAppTheme();
  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  return onPress ? <Pressable {...props} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.84 : 1 }]}>{children}</Pressable>
    : <View {...props} style={cardStyle}>{children}</View>;
}

export function DemoModeBadge({ style, compact = false }) {
  const { colors } = useAppTheme();
  return <View style={[styles.badge, { backgroundColor: colors.primarySoft }, style]}>
    <Ionicons name="flask-outline" size={13} color={colors.primary} />
    <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700', letterSpacing: 0.6 }}>{compact ? 'DEMO' : 'DEMO · NO REAL MONEY'}</AppText>
  </View>;
}

const statusLabels = { pending: 'Pending', processing: 'Processing', completed: 'Completed', paid: 'Paid', expired: 'Expired', cancelled: 'Cancelled', failed: 'Failed', verified: 'Verified', consumed: 'Used' };
export function StatusBadge({ status = 'pending', label, tone, style }) {
  const { colors } = useAppTheme();
  const colorKey = tone || (['completed', 'paid', 'verified'].includes(status) ? 'success' : ['failed', 'expired'].includes(status) ? 'error' : status === 'cancelled' ? 'info' : 'warning');
  return <View style={[styles.badge, { backgroundColor: colors[`${colorKey}Soft`] || colors.infoSoft }, style]}>
    <AppText variant="caption" color={colors[colorKey] || colors.info} style={{ fontWeight: '600' }}>{label || statusLabels[status] || status}</AppText>
  </View>;
}

export function AmountDisplay({ amountMinor, label, style, color, size = 'hero' }) {
  const { colors } = useAppTheme();
  const amount = Number.isSafeInteger(amountMinor) ? formatMoney(amountMinor) : 'Amount unavailable';
  return <View style={style}>{label ? <AppText variant="caption" color={color || colors.textSecondary} style={{ marginBottom: 6 }}>{label}</AppText> : null}
    <AppText variant={size} color={color} accessibilityLabel={amount}>{amount}</AppText></View>;
}

export function MaskedCard({ card = {}, selected, onPress, style }) {
  const { colors } = useAppTheme();
  const last4 = String(card.last4 || '••••').slice(-4);
  return <AppCard onPress={onPress} accessibilityLabel={`${card.brand || 'Demo'} test instrument ending ${last4}${card.isDefault ? ', default' : ''}`}
    style={[styles.maskedCard, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }, style]}>
    <View style={styles.rowBetween}><Ionicons name="card-outline" size={26} color={colors.primary} /><AppText variant="caption" color={colors.textSecondary}>TEST INSTRUMENT</AppText></View>
    <AppText variant="h3" style={{ marginTop: 18, letterSpacing: 2 }}>••••  ••••  ••••  {last4}</AppText>
    <View style={[styles.rowBetween, { marginTop: 16 }]}><AppText variant="label">{card.brand || 'Demo card'}</AppText>{card.isDefault ? <StatusBadge status="verified" label="Default" /> : null}</View>
  </AppCard>;
}

export function TransactionRow({ transaction = {}, onPress }) {
  const { colors } = useAppTheme();
  const sent = ['sent', 'send'].includes(transaction.role || transaction.type);
  const amount = Number.isSafeInteger(transaction.amountMinor) ? formatMoney(transaction.amountMinor) : 'Amount unavailable';
  return <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${sent ? 'Sent' : 'Received'} ${amount}, ${transaction.counterpartyName || 'simulated payment'}, ${transaction.status || 'status unavailable'}`}
    style={({ pressed }) => [styles.transaction, { borderBottomColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
    <View style={[styles.transactionIcon, { backgroundColor: sent ? colors.infoSoft : colors.primarySoft }]}><Ionicons name={sent ? 'arrow-up-outline' : 'arrow-down-outline'} size={22} color={sent ? colors.info : colors.primary} /></View>
    <View style={styles.flex}><AppText variant="label">{transaction.counterpartyName || transaction.description || 'Simulated payment'}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>{sent ? 'Sent' : 'Received'} · {formatDate(transaction.completedAt || transaction.timestamp || transaction.createdAt || '')}</AppText></View>
    <View style={{ alignItems: 'flex-end', gap: 4 }}><AppText variant="label">{sent ? '−' : '+'}{amount}</AppText><AppText variant="caption" color={colors.textSecondary}>{statusLabels[transaction.status] || transaction.status || 'Status unavailable'}</AppText></View>
  </Pressable>;
}

export function EmptyState({ title = 'Nothing here yet', message, icon = 'file-tray-outline', actionLabel, onAction, style }) {
  const { colors } = useAppTheme();
  return <View style={[styles.empty, style]}><View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name={icon} size={30} color={colors.primary} /></View>
    <AppText variant="h3" style={styles.center}>{title}</AppText>{message ? <AppText color={colors.textSecondary} style={styles.center}>{message}</AppText> : null}
    {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} variant="secondary" /> : null}</View>;
}

export function ErrorState({ title = 'We couldn’t load this', message = 'Check your connection and try again.', onRetry, retryLabel = 'Try again' }) {
  return <EmptyState title={title} message={message} icon="cloud-offline-outline" actionLabel={retryLabel} onAction={onRetry} />;
}

export function LoadingSkeleton({ lines = 3, label = 'Loading', style }) {
  const { colors } = useAppTheme();
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={[styles.skeleton, style]}>
    {Array.from({ length: lines }, (_, i) => <View key={i} style={{ height: i === 0 ? 24 : 14, borderRadius: 6, backgroundColor: colors.disabled, width: i === lines - 1 ? '62%' : '100%' }} />)}
  </View>;
}

export function SecurityPrompt({ title = 'Your approval is required', message = 'Review the request and complete verification before confirming a simulated payment.' }) {
  const { colors } = useAppTheme();
  return <View style={[styles.feedback, { backgroundColor: colors.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={23} color={colors.primary} />
    <View style={styles.flex}><AppText variant="label">{title}</AppText><AppText variant="body2" color={colors.textSecondary} style={{ marginTop: 4 }}>{message}</AppText></View></View>;
}

export function RequestCountdown({ expiresAt, serverTime, onExpire }) {
  const { colors } = useAppTheme();
  const [now, setNow] = useState(Date.now());
  const expired = useRef(false);
  const timestamp = value => typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  const expires = timestamp(expiresAt);
  const offset = useMemo(() => {
    const server = timestamp(serverTime);
    return Number.isFinite(server) ? server - Date.now() : 0;
  }, [serverTime, expiresAt]);
  useEffect(() => {
    expired.current = false;
    setNow(Date.now());
  }, [expiresAt]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((expires - now - offset) / 1000)) || 0;
  useEffect(() => { if (seconds === 0 && !expired.current) { expired.current = true; onExpire?.(); } }, [seconds, onExpire]);
  const label = !Number.isFinite(expires) ? 'Expiry unavailable' : seconds ? `Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Request expired';
  return <View style={styles.inline}><Ionicons name="time-outline" size={17} color={seconds <= 30 ? colors.error : colors.textSecondary} />
    <AppText variant="body2" color={seconds <= 30 ? colors.error : colors.textSecondary}>{label}</AppText></View>;
}

export function ConfirmBottomSheet({ visible, title, message, children, confirmLabel = 'Confirm', onConfirm, onCancel, loading, destructive, returnFocusRef }) {
  const { colors, reduceMotion } = useAppTheme();
  const insets = useSafeAreaInsets();
  const titleRef = useRef(null);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible) {
      if (Platform.OS === 'web') returnFocusRef?.current?.focus?.();
      else { const tag = findNodeHandle(returnFocusRef?.current); if (tag) AccessibilityInfo.setAccessibilityFocus(tag); }
    }
    wasVisible.current = visible;
  }, [visible, returnFocusRef]);
  const focusTitle = () => {
    if (Platform.OS === 'web') titleRef.current?.focus?.();
    else { const tag = findNodeHandle(titleRef.current); if (tag) AccessibilityInfo.setAccessibilityFocus(tag); }
  };
  const close = () => { if (!loading) onCancel?.(); };
  return <Modal visible={!!visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={close} onShow={focusTitle}>
    <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
      <ScrollView accessibilityViewIsModal role="dialog" accessibilityLabel={title} keyboardShouldPersistTaps="handled"
        style={[styles.sheetFrame, { backgroundColor: colors.surface }]} contentContainerStyle={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <AppText ref={titleRef} variant="h2" accessibilityRole="header" tabIndex={-1}>{title}</AppText>
        {message ? <AppText color={colors.textSecondary}>{message}</AppText> : null}{children}
        <AppButton title={confirmLabel} loading={loading} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} />
        <AppButton title="Cancel" variant="ghost" onPress={close} disabled={loading} />
      </ScrollView>
    </View>
  </Modal>;
}

export function PaymentResult({ status, amountMinor, recipient, onReceipt, onRetry }) {
  const { colors } = useAppTheme();
  const completed = status === 'completed';
  const uncertain = ['processing', 'unknown', 'uncertain'].includes(status);
  const title = completed ? 'Simulated payment completed' : uncertain ? 'Checking your payment' : 'Payment not completed';
  return <View style={styles.empty}><View style={[styles.resultIcon, { backgroundColor: completed ? colors.primarySoft : colors.warningSoft }]}>
    <Ionicons name={completed ? 'checkmark-outline' : uncertain ? 'time-outline' : 'alert-outline'} size={42} color={completed ? colors.primary : colors.warning} /></View>
    <DemoModeBadge /><AppText variant="h2" style={styles.center} accessibilityRole="header">{title}</AppText>
    <AmountDisplay amountMinor={amountMinor} />{recipient ? <AppText color={colors.textSecondary}>To {recipient}</AppText> : null}
    <AppText style={styles.center} color={colors.textSecondary}>{completed ? 'No real funds were transferred.' : uncertain ? 'We’ll use the server’s latest record before showing a result. Please don’t start a new payment.' : 'No completed payment was confirmed. Check the request before trying again.'}</AppText>
    {completed && onReceipt ? <AppButton title="View simulated receipt" onPress={onReceipt} icon="receipt-outline" /> : null}
    {!completed && onRetry ? <AppButton title="Check status" onPress={onRetry} variant="secondary" /> : null}
  </View>;
}

export function ReceiptView({ transaction = {}, onShare }) {
  const { colors } = useAppTheme();
  return <AppCard style={{ gap: 20 }}><View style={styles.rowBetween}><BrandMark compact /><DemoModeBadge compact /></View>
    <View style={[styles.receiptAmount, { borderColor: colors.border }]}><AppText variant="kicker" color={colors.textSecondary}>SIMULATED RECEIPT</AppText>
      <AmountDisplay amountMinor={transaction.amountMinor} style={{ marginVertical: 12 }} /><StatusBadge status={transaction.status || 'unknown'} label={!transaction.status ? 'Status unavailable' : undefined} /></View>
    {[['Transaction', transaction.id || transaction.transactionId], ['From', transaction.payerName], ['To', transaction.requesterName], ['Reference', transaction.reference || 'No reference'], ['Method', transaction.methodLabel], ['Date', formatDate(transaction.completedAt || transaction.timestamp || '')]].map(([label, value]) => value ?
      <View key={label} style={styles.receiptRow}><AppText variant="body2" color={colors.textSecondary}>{label}</AppText><AppText variant="body2" style={{ flex: 1, textAlign: 'right' }} selectable>{value}</AppText></View> : null)}
    <SecurityPrompt title="No real funds transferred" message="This receipt records a NamPay demonstration. It is not proof of bank settlement." />
    {onShare ? <AppButton title="Share simulated receipt" icon="share-outline" onPress={onShare} variant="secondary" /> : null}
  </AppCard>;
}

export function OfflineBanner({ visible, message = 'You’re offline. Reconnect to refresh the latest status.', onRetry }) {
  const { colors } = useAppTheme();
  if (!visible) return null;
  return <View accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: colors.warningSoft }]}>
    <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} /><AppText accessibilityRole="alert" variant="body2" color={colors.warning} style={styles.flex}>{message}</AppText>
    {onRetry ? <IconButton name="refresh-outline" label="Retry connection" onPress={onRetry} color={colors.warning} /> : null}
  </View>;
}

export function AuthLayout({ title, subtitle, kicker, children, footer, onBack }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  return <AppScreen contentStyle={[styles.authScreen, wide && { maxWidth: 1180 }]}>
    <View style={[styles.authColumns, wide && { flexDirection: 'row', alignItems: 'stretch' }]}>
      {wide ? <View style={[styles.authHero, { backgroundColor: colors.hero }]}><BrandMark inverse />
        <View style={{ gap: 22 }}><View style={styles.heroSymbol}><Ionicons name="qr-code-outline" size={70} color={colors.heroText} /></View>
          <AppText variant="hero" color={colors.heroText}>Request. Scan.{ '\n' }Simulate.</AppText>
          <AppText color={colors.heroMuted}>A clear, considered way to explore QR payments in Namibia.</AppText></View>
        <View style={{ gap: 10 }}><AppText variant="label" color={colors.heroText}>Built for a safe demonstration.</AppText><AppText variant="body2" color={colors.heroMuted}>Test accounts. Test instruments. No real money.</AppText></View>
      </View> : null}
      <View style={[styles.authForm, wide && { padding: 40 }]}>
        {!wide ? <View style={styles.rowBetween}><BrandMark /><DemoModeBadge compact /></View> : <DemoModeBadge />}
        <AppHeader title={title} subtitle={subtitle} kicker={kicker} onBack={onBack} style={{ marginTop: wide ? 22 : 32 }} />
        <View style={{ gap: 18 }}>{children}</View>{footer ? <View style={styles.authFooter}>{footer}</View> : null}
        <AppText variant="caption" color={colors.textSecondary} style={[styles.center, { marginTop: 28 }]}>NamPay is a sandbox prototype. No real funds are transferred.</AppText>
      </View>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, screenContent: { flexGrow: 1, width: '100%', maxWidth: 980, alignSelf: 'center' }, screenPadding: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  flex: { flex: 1, minWidth: 0 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 7 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, version: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  header: { marginBottom: 24 }, headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, kicker: { marginBottom: 7 }, subtitle: { marginTop: 8 }, iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  button: { minHeight: 52, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, buttonText: { textAlign: 'center', flexShrink: 1 },
  field: { width: '100%' }, fieldLabel: { marginBottom: 8 }, inputFrame: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, minHeight: 54 }, input: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, lineHeight: 23 }, fieldHint: { marginTop: 6 },
  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12 }, card: { borderWidth: 1, borderRadius: 18, padding: 20 }, badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  maskedCard: { minWidth: 220 }, transaction: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, minHeight: 76 }, transactionIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 36 }, emptyIcon: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, center: { textAlign: 'center' }, skeleton: { gap: 14, paddingVertical: 16 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' }, sheetFrame: { width: '100%', maxWidth: 560, maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, flexGrow: 0 }, sheet: { padding: 24, gap: 16 }, sheetHandle: { width: 40, height: 4, borderRadius: 3, alignSelf: 'center', marginBottom: 4 },
  resultIcon: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }, receiptAmount: { alignItems: 'center', paddingVertical: 22, borderTopWidth: 1, borderBottomWidth: 1 }, receiptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  authScreen: { justifyContent: 'center', paddingVertical: 32, maxWidth: 520 }, authColumns: { gap: 20 }, authHero: { flex: 1, minHeight: 690, borderRadius: 24, padding: 36, justifyContent: 'space-between' }, authForm: { flex: 1, minWidth: 0, paddingVertical: 10 }, authFooter: { marginTop: 22, gap: 6 }, heroSymbol: { width: 120, height: 120, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
});
