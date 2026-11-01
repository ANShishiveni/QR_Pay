# NamPay 2.0 design system

Phase 2 establishes the shared UI, onboarding, authentication and navigation shell. NamPay remains a sandbox prototype: requests and receipts describe simulated payments and never imply bank settlement or a stored wallet balance.

## Visual direction and tokens

The interface uses quiet navy surfaces, emerald actions, native system type and line icons. Amounts, recipient identity and the next action take priority. Solid surfaces, borders and spacing provide hierarchy; gradients and decorative shadows are unnecessary.

Source: [`frontend/src/styles/theme.js`](../../frontend/src/styles/theme.js). Read dynamic values through `useAppTheme()` from `ThemeContext`, rather than importing a static palette into a screen.

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `background` | `#F6F8FA` | `#0B1420` | App canvas |
| `surface` | `#FFFFFF` | `#142131` | Forms and cards |
| `surfaceRaised` | `#FFFFFF` | `#1B2A3D` | Toasts and elevated surfaces |
| `text` | `#142230` | `#F4F7FA` | Primary copy |
| `textSecondary` | `#59697A` | `#AAB9CA` | Supporting copy |
| `primary` / `success` | `#06796B` | `#40C8AD` | Actions and confirmed outcomes |
| `primarySoft` | `#E4F4EF` | `#153D36` | Selected state and soft accent |
| `border` | `#DDE5EC` | `#2B3C50` | Decorative card separators |
| `controlBorder` | `#7A8997` | `#6E8196` | Visible input boundary |
| `error` | `#B42332` | `#FF9FA8` | Invalid input and failures |
| `warning` | `#7A4C00` | `#F5CA79` | Pending/uncertain states |
| `hero` | `#11263D` | `#1B344B` | Onboarding and wide auth panel |

Use paired tokens (`onPrimary`/`primary`, `onError`/`error`, `error`/`errorSoft`, etc.). The light emerald was adjusted after the contrast test found the earlier value below 4.5:1 on its soft surface; the final pair is 4.67:1. Automated checks require at least 4.5:1 for the documented text pairs and 3:1 for control boundaries. Decorative separators are not input boundaries.

Spacing follows 4, 8, 16, 24, 32 and 48 points. Controls have a 12-point radius, cards 18 and feature panels 24. Elevation tokens are flat 0, raised 2 and modal 8; reserve elevation for overlays, and use distinct surfaces/borders as the primary visual cue.

System fonts scale with device preferences. Type variants are `hero` 40/48, `h1` 30/38, `h2` 24/32, `h3` 20/28, `h4` 18/26, `body` 16/24, `body2` 14/21, `label` 14/20, `caption` 12/18, `kicker` 12/18 and `button` 15/22 (font size/line height). Avoid fixed-height text containers and truncating payment amounts or recipient names.

`ThemeProvider` supports `system`, `light` and `dark`, persists only the non-sensitive device `appearance` preference, and accepts the verified user's `preferences.theme`. A slower device preference read cannot overwrite the verified account preference. React Native's reduced-motion preference controls navigation and sheet transitions; skeletons are intentionally static. Paper, navigation, status bars and toast surfaces use the same palette.

## Component catalog

All components are exported from [`frontend/src/components/ui/index.js`](../../frontend/src/components/ui/index.js). Props below are the primary public API; native props are forwarded where appropriate.

| Component | Props and behavior |
| --- | --- |
| `AppScreen` | `scroll`, `padded`, `contentStyle`, `refreshControl`, `edges`; safe area, keyboard-aware scrolling, centered maximum width. Defaults to all safe-area edges; tab screens can omit bottom when already handled by the tab bar. |
| `AppText` | `variant`, `color`, `style`; accepts a semantic color token or a literal color. Ref forwarding allows focus on headings. |
| `AppHeader` | `title`, `subtitle`, `kicker`, `onBack`, `right`; accessible heading and labeled 44-point back action. |
| `BrandMark` | `inverse`, `compact`; wordmark with a single accessible name. |
| `AppButton` | `title`, `onPress`, `variant`, `icon`, `loading`, `disabled`; primary/secondary/ghost/danger, minimum 52-point height, busy and disabled semantics. Mutation handlers must additionally guard duplicate submissions. |
| `IconButton` | `name`, `label`, `onPress`, `disabled`; a required meaningful label and minimum 44-point target. |
| `AppTextField` | `label`, `value`, `onChangeText`, `error`, `hint`, `leading`, `trailing`; a persistent label, visible focus border, accessible error/hint and native input/ref support. |
| `PhoneField` | Text-field props plus phone keyboard and autocomplete. Validation and verification remain separate concerns. |
| `MoneyInput` | Text-field props with NAD label, decimal keyboard, N$ prefix and limit hint. Parse with `parseAmountMinor` before requesting a mutation. |
| `FormError` | `message` or `children`; visible alert with polite announcement. Never pass raw transport errors. |
| `AppCard` | `children`, `onPress`, `accessibilityLabel`, `style`; bordered surface, optionally an accessible action. |
| `DemoModeBadge` | `compact`; explicit demo label, with “NO REAL MONEY” in full form. |
| `StatusBadge` | `status`, `label`, `tone`; every status has readable text, not color alone. |
| `AmountDisplay` | `amountMinor`, `label`, `size`; integer NAD cents only. Missing/invalid data says “Amount unavailable.” |
| `MaskedCard` | `card`, `selected`, `onPress`; renders brand, last four and default status. Never reads PAN or CVV fields. |
| `TransactionRow` | `transaction`, `onPress`; canonical integer amount, counterparty, sent/received role, date and status. Missing status is unavailable, never presumed completed. |
| `RequestCountdown` | `expiresAt`, `serverTime`, `onExpire`; accepts ISO timestamps or epoch milliseconds, accounts for server clock offset, calls expiry once, and reports missing expiry explicitly. Display is advisory: server status still authorizes every action. |
| `ConfirmBottomSheet` | `visible`, `title`, `message`, `children`, `onConfirm`, `onCancel`, `loading`, `destructive`, `returnFocusRef`; reduced motion, safe bottom inset, scrollable content and focus handoff. Busy mutations block repeated confirms/dismissals. |
| `PaymentResult` | `status`, `amountMinor`, `recipient`, `onReceipt`, `onRetry`; uncertain/processing states request server reconciliation. Only confirmed `completed` enables a receipt action. |
| `ReceiptView` | `transaction`, `onShare`; canonical fields and explicit “not proof of bank settlement” disclosure. Missing records do not invent success. |
| `LoadingSkeleton` | `lines`, `label`; stable, non-animated, accessible busy placeholder. |
| `EmptyState` / `ErrorState` | `title`, `message`, optional action or retry; readable context and one useful next action. |
| `OfflineBanner` | `visible`, `message`, `onRetry`; announced connection state with an independently accessible retry action. |
| `SecurityPrompt` | `title`, `message`; contextual verification or simulation explanation. |
| `AuthLayout` | `title`, `subtitle`, `kicker`, `children`, `footer`, `onBack`; compact form below 900 points, two-column navy panel and form above it. |

Example screen:

```jsx
const { colors } = useAppTheme();
return (
  <AppScreen>
    <AppHeader title="Request a payment" kicker="DEMONSTRATION" />
    <DemoModeBadge />
    <MoneyInput value={amount} onChangeText={setAmount} error={amountError} />
    <FormError message={requestError} />
    <AppButton title="Create request" onPress={createRequest} loading={submitting} />
  </AppScreen>
);
```

Amount formatting is `formatMoney(amountMinor)`, never a fabricated balance or a display float used as ledger state. Dates use `Africa/Windhoek` and say “Date unavailable” for invalid data. Requests, transactions and card data must be mapped from authorized server records before reaching a display component.

## Navigation, onboarding and auth

The visible tabs are **Home**, **Payments**, **Activity** and **Profile**. Protected stack routes preserve `QR` and `QRGenerate` aliases, `QRScan`, `PaymentConfirm`, `Cards`, `MyProfile`, `Transactions`, `Settings`, `OTPVerification` and `BiometricAuth`. Auth and protected stacks have separate navigation keys, so signing out removes the protected history. The Phase 2 Payments and Activity tabs initially host their existing screens; the ordered Phase 3/4 work migrates their content to this catalog.

Session verification and appearance/first-launch preference reads finish before the app shell is exposed. Three onboarding panels explain request/scan, review/verification and the demo restriction. Skip and Get started persist only `onboardingComplete`. No camera, biometric or notification permission is requested during onboarding. Storage failure does not strand a user in onboarding.

Login/register support inline validation, password visibility, duplicate-submit guards and safe retry. Account creation and session verification remain distinct: a failed verification does not claim account creation failed. Phone entry is optional and never claims ownership verification. Password creation/reset requires at least 12 characters and at most 72 UTF-8 bytes, matching the server.

Recovery checks `/auth/capabilities`, explains unavailable delivery without promising an email, and uses a non-enumerating response. Reset requires a private, expiring, one-use recovery code; success clears sensitive form state and requires a fresh sign-in. Cookie-based web authentication and SecureStore-based native authentication remain the Phase 1 contracts.

## Accessibility and interaction rules

- Use 44-point minimum interactive targets; primary actions are 52 points. Keep the full amount, recipient and demo status readable during payment confirmation.
- Give icon buttons an action label. Use `accessibilityRole="header"` for section/screen headings, and announce inline failures without exposing backend internals.
- Input focus uses a visible 2-point accent border. Buttons retain platform keyboard focus treatment. Onboarding moves focus to the new heading; sheets focus the title and restore the trigger on dismissal.
- Do not announce a countdown every second. Announce consequential status changes in the consuming flow.
- Keep forms scrollable when keyboards or larger text reduce available space. Sheets scroll within 90% of screen height and include bottom safe-area padding.
- Honor reduced motion, including navigation. Status labels, icons and explanatory text carry meaning in addition to color.
- Never show a successful payment based on a timeout or optimistic local state. Reconcile server status before presenting a final outcome or allowing another payment attempt.

## Evidence and remaining verification

Automated component coverage checks busy controls, field semantics, masked instrument privacy, integer-money receipts, unknown payment states, accessible loading/error states, numeric/ISO server-offset expiry, blocked sheet dismissal, onboarding progression, appearance races and palette contrast. Auth component tests cover validation, cookie verification, duplicate requests, partial registration success, unavailable recovery, reset proof and safe retries.

The root browser smoke covers first launch, form validation, registration, four visible tabs, HttpOnly cookie isolation, reload verification and logout revocation. It also checks horizontal overflow at compact and wide sizes. The screenshots use empty forms or synthetic accounts:

- [Compact light login](screenshots/auth-login-light-compact.png)
- [Compact light registration](screenshots/auth-register-light-compact.png)
- [Wide dark login](screenshots/auth-login-dark-wide.png)

Commands: `cd frontend && npm test`, `npm run typecheck`; run `node scripts/browser-auth-smoke.cjs` from the repository root with the disposable local API and web development server described in the testing documentation.

**Not verified by browser/component tests:** Android physical-device and emulator rendering, native keyboard/cutout/rotation behavior, TalkBack/VoiceOver focus traversal, iOS, and 200% native font scaling. Those checks remain in the Phase 5/6 device matrix. Static legacy palettes remain only to preserve screens during ordered migration; they do not establish dark-mode completion for those later-phase screens.
