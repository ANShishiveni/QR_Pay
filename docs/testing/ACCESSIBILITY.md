# Accessibility verification

## Scope and evidence

NamPay uses React Native controls on Android/iOS and React Native Web 0.20 for
the browser build. Passing a native component test does not establish that
the browser emits the same accessibility attributes. The installed web
renderer drops `accessibilityState` and `accessibilityHint`; this was reproduced
with actual React DOM server rendering during the Phase 5 audit.

The shared controls now preserve native state and explicitly emit the relevant
web ARIA attributes. Focused verification:

```bash
cd frontend
npm test -- --ci --runTestsByPath \
  src/components/ui/__tests__/components.test.js \
  src/components/ui/__tests__/accessibility.web.test.js \
  src/screens/qr/__tests__/RequestScreens.test.js \
  src/screens/profile/__tests__/ActivityScreens.test.js
```

Result at this change: **4 suites, 56 tests passed**. Five tests use the actual
installed React Native Web and React DOM server renderer, rather than native
component mocks. Browser interaction evidence is a separate gate below.

## Shared control behavior

- Buttons retain expanded/selected state supplied by a screen and announce
  disabled/busy state while pending. An actual pending operation overrides a
  caller's false disabled state. Buttons with selection use `aria-pressed` on
  web; tabs use `aria-selected`. Native controls keep `accessibilityState`.
- Test instrument choices and request/activity filters expose their selection
  independently of color. The activity filter disclosure exposes expanded
  state.
- Inputs have unique, stable description IDs. Visible errors replace hints
  without breaking the association. Web inputs use `aria-describedby` and
  `aria-invalid`; native inputs retain their accessible labels and hints.
  A screen-supplied additional description is preserved.
- Screen titles render H1. Section headings render H2 even where their visual
  typography is `h3`; deeper sections can set `headingLevel`. Explicit
  `aria-level` remains supported. Native heading roles remain intact.
- Loading skeletons expose busy state and a meaningful label without animation.
- Confirmation sheets label the outer web Modal and associate its message.
  They no longer add a second nested web dialog. The installed web Modal
  already implements focus trapping, Escape handling, and restoration of its
  opening control; the application retains those behaviors. Pending mutations
  block dismissal and duplicate confirmation. Native modal accessibility and
  the existing explicit focus handoff remain in place.
- Controls keep their existing minimum touch sizes (44 for icon/filter actions,
  52 for primary controls), visible input focus border, platform keyboard focus
  treatment, and immediate pressed feedback. No new animation was introduced.
  Sheets respect reduced motion; typography remains scalable and untruncated.

The semantic light/dark color pairs and control-border contrast remain covered
by `ThemeContext.test.js`. The documented palette targets normal-text contrast
of at least 4.5:1 and interactive-boundary contrast of at least 3:1. These tests
do not replace visual checks of every screen composition.

## Required browser interaction checks

The root integration pass must verify these against the running app, with both
normal and reduced-motion preferences. Server-rendered markup tests cannot
verify keyboard traversal or a browser accessibility tree.

| Check | Expected result |
| --- | --- |
| Dialog open | Exactly one named dialog; initial focus inside it. |
| Dialog keyboard | Tab/Shift+Tab remain inside; Escape closes an idle dialog; focus returns to its trigger. |
| Pending dialog | Confirm and Cancel cannot act twice; Escape cannot dismiss a pending mutation. |
| Input validation | Error/hint IDs resolve to visible text; invalid state clears after correction; no duplicate IDs. |
| Filters/instruments | Keyboard activation changes `aria-pressed`; disclosure updates `aria-expanded`. |
| Navigation | Active tab is announced, tab keyboard behavior works, route changes move focus appropriately, inactive screens are excluded. |
| Appearance | Theme radios expose checked state and support Space/arrows with one tab stop. |
| Layout | Small viewport and 200% browser zoom retain readable amounts, labels, errors, and reachable controls. |
| Live feedback | Status/error/notification announcements are useful and do not repeat the countdown every second. |

Results must be added with the executed browser script, viewport and observed
outcome. The checklist itself is **not a claim that these checks passed**.

### Browser evidence — 29 October 2026

`node scripts/browser-reliability-smoke.cjs` passed in Chromium at390×844 and
1280×900 with reduced motion. `NAMPAY_MOTION=normal node
scripts/browser-reliability-smoke.cjs` also passed with normal motion and a200%
CSS browser zoom layout check. These runs verify explicit tab labels/selection,
arrow-key activation with focus retained, one named confirmation dialog,
repeated Tab and Shift+Tab trapping, Escape/trigger restoration, associated input errors,
offline draft preservation and notifications with alerts muted. The separate
feature smoke verifies appearance radio arrows/Space and saved checked state.
Screenshots are in `docs/design/screenshots`. Browser zoom is not native font
scaling; the hardware checklist below remains outstanding. The31October rerun
verified both keyboard directions in reduced and normal motion. Live
screen-reader speech and every screen at zoom still require manual coverage.

## Native verification still outstanding

No Android physical-device/emulator or iOS screen-reader test has been performed
by this audit. Device availability and native tooling prerequisites remain
separate blockers tracked in the implementation progress and test matrix.
TalkBack/VoiceOver focus order, modal announcements/restoration, 200% native font
scaling, switch controls, keyboard avoidance, safe areas, rotation and hardware
back behavior must still be exercised on actual supported targets. Browser DOM
and unit tests do not satisfy those requirements.
