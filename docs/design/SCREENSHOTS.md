# Screenshot gallery

These browser captures show NamPay’s synthetic demonstration flows. They are
visual evidence of the captured states, not proof of real payment settlement or
native-device verification. All current files are PNGs in
[`screenshots/`](screenshots/).

Compact runs use a **390 × 844** browser viewport; wide runs use **1280 × 900**.
The dimensions below are the image dimensions. Taller images come from the
shared full-page capture helper. The browser scripts use disposable local demo
accounts and exclude passwords, recovery proofs and verification codes from
captures.

The 20 current captures were regenerated on **31 October 2026**, after the Metro
web-root sizing fix, wrapping header/settings layouts and shorter “Device check”
heading. The complete
[`ci-browser.sh`](../../scripts/ci-browser.sh) run passed all five checks: auth,
payments, features, and reliability with reduced and normal motion. The final
normal-motion run supplied the reliability images. These functional/layout
checks do not establish readability on every screen at enlarged text; see the
coverage limits below. The two historical baseline images were retained separately.

## Onboarding and authentication

Capture source: [`browser-auth-smoke.cjs`](../../scripts/browser-auth-smoke.cjs).

| Capture | Theme / layout | Image pixels | State |
| --- | --- | --- | --- |
| [Onboarding](screenshots/onboarding-light-compact.png) | Light, compact | 390 × 844 | First-launch explanation and demo disclosure. |
| [Sign in](screenshots/auth-login-light-compact.png) | Light, compact | 390 × 844 | Empty sign-in form. |
| [Registration](screenshots/auth-register-light-compact.png) | Light, compact | 390 × 1203 | Empty account-creation form. |
| [Sign in, wide](screenshots/auth-login-dark-wide.png) | Dark, wide | 1280 × 900 | Two-column auth layout and dark palette. |

## Request, scan and simulated payment

Capture source: [`browser-payments-smoke.cjs`](../../scripts/browser-payments-smoke.cjs).
The script uses two independent synthetic accounts and imports the generated QR
image. It deliberately drops the confirmation response to exercise uncertainty
before reading the canonical result.

| Capture | Theme / layout | Image pixels | State |
| --- | --- | --- | --- |
| [Active request](screenshots/request-active-light-compact.png) | Light, compact | 390 × 1263 | Server-created QR, amount and expiry. |
| [Scanner](screenshots/scanner-light-compact.png) | Light, compact | 390 × 1031 | Scanner entry before gallery import; not a hardware-camera result. |
| [Payment review](screenshots/payment-review-light-compact.png) | Light, compact | 390 × 1140 | Recipient, amount and masked test instrument. |
| [Verification](screenshots/payment-verification-light-compact.png) | Light, compact | 390 × 1219 | Issued challenge before entering its private code. |
| [Uncertain payment](screenshots/payment-uncertain-light-compact.png) | Light, compact | 390 × 844 | Lost response; no optimistic success claim. |
| [Confirmed result](screenshots/payment-result-light-compact.png) | Light, compact | 390 × 844 | Server-confirmed simulated outcome. |

## Home, cards, activity and settings

Capture source: [`browser-features-smoke.cjs`](../../scripts/browser-features-smoke.cjs).
The activity fixture is created through the local QR/OTP API; the separate
payment script above exercises the payment UI itself.

| Capture | Theme / layout | Image pixels | State |
| --- | --- | --- | --- |
| [Home](screenshots/home-light-compact.png) | Light, compact | 390 × 844 | Server totals and a pending request; no wallet balance. |
| [Test cards](screenshots/test-cards-light-compact.png) | Light, compact | 390 × 1116 | Two predefined masked instruments after changing the default. |
| [Activity filters](screenshots/activity-filters-light-compact.png) | Light, compact | 390 × 1106 | Direction, date, search and status filters. |
| [Transaction and receipt](screenshots/transaction-receipt-light-compact.png) | Light, compact | 390 × 1742 | Owned transaction and explicitly simulated receipt. |
| [Settings](screenshots/settings-dark-compact.png) | Dark, compact | 390 × 1167 | Saved dark appearance and disabled in-app alerts. |

## Reliability, inbox and accessibility examples

Capture source: [`browser-reliability-smoke.cjs`](../../scripts/browser-reliability-smoke.cjs).
See [reliability evidence](../testing/RELIABILITY.md) and
[accessibility evidence and remaining checks](../testing/ACCESSIBILITY.md) for
the assertions behind these images.

| Capture | Theme / layout | Image pixels | State |
| --- | --- | --- | --- |
| [Offline request draft](screenshots/offline-request-light-compact.png) | Light, compact | 390 × 844 | Retained inputs and a write blocked before transport. |
| [Confirmation dialog](screenshots/confirmation-light-compact.png) | Light, compact | 390 × 844 | Sign-out confirmation used for browser keyboard/focus checks. |
| [Inbox](screenshots/notifications-light-compact.png) | Light, compact | 390 × 844 | An owned request event after server-confirmed read acknowledgement. |
| [Profile, wide](screenshots/profile-light-wide.png) | Light, wide | 1280 × 900 | Profile navigation with alerts muted and history preserved. |
| [Settings at 200% CSS zoom](screenshots/settings-browser-zoom-200.png) | Light, compact viewport | 390 × 3862 | Stacked back/title and heading/switch layouts after `document.body.style.zoom = '2'`; Settings, In-app alerts and Device check headings retain whole words. |

## Historical baseline

These pre-refactor images are retained for comparison. They are not current
acceptance evidence, and their original capture helper is not part of the four
current browser scripts above.

| Capture | Image pixels |
| --- | --- |
| [Original sign in](screenshots/baseline-login.png) | 390 × 844 |
| [Original registration](screenshots/baseline-registration.png) | 390 × 844 |

## Coverage limits

- Current dark screenshots cover wide sign-in and compact settings. There is
  no corresponding dark capture for every request, payment, activity or inbox
  state, and no complete wide-layout gallery.
- These files contain no Android emulator, Android physical-device or iOS
  captures. Hardware camera scanning, native keyboards/safe areas/rotation,
  SecureStore restart, biometrics and native share sheets remain separate
  device checks.
- The 200% image is **CSS zoom in Chromium**, not native font scaling or a
  TalkBack/VoiceOver test. Direct inspection confirms that the Settings title
  fits and the In-app alerts and Device check headings stack above their switches
  without splitting words. The no-horizontal-overflow check passed. This fixes
  the earlier isolated final-letter wrap; every screen at enlarged text and full
  manual accessibility coverage still need review.
- A static image cannot establish focus order, announcements, contrast in every
  composition, reduced-motion behavior or touch-target usability. Use the
  executed script evidence and the [test matrix](../testing/TEST_MATRIX.md)
  alongside this gallery.

To refresh images, run the linked browser scripts against the documented
**local disposable demo** setup. They reuse these filenames, so a later run
replaces earlier captures. [`browser-helpers.cjs`](../../scripts/browser-helpers.cjs)
contains the capture and viewport-overflow helpers; the scripts do not generate
native screenshots.
