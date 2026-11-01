# Reproducible local setup

Validated toolchain: Node 24.19.0, npm 11.9.0, Java 21 and Chromium 154. Frameworks
remain Expo 53, React/React DOM 19.0.0, React Native 0.79.6 and RN Web 0.20. Use the
committed lockfiles; do not use a forced SDK upgrade to clear an audit warning.

```sh
npm ci --no-audit --no-fund
npm --prefix backend ci --no-audit --no-fund
npm --prefix frontend ci --legacy-peer-deps --no-audit --no-fund
npm run check
```

Frontend postinstall adapts Metro 0.82.5 to image-size 2.0.3's named byte-input API
and query-string 7.1.3 to decode-uri-component 0.5.1's default export.
It checks the exact upstream and patched file hashes. An upstream change fails
installation until reviewed. A scoped PostCSS 8.5.23 override retains the SDK 53
configuration. `tooling-compat-smoke.cjs` exercises buffer/path PNG assets, JPEG,
SVG, invalid inputs, CSS transforms/maps and Unicode/malformed query decoding.
Do not skip install scripts. See the dependency audit for residual findings.

## Disposable API and browser

Use the commands in the root README. The API binds loopback by default and uses
memory only when both `DEMO_MODE=true` and `DATABASE_MODE=memory` are explicit.
Mock verification additionally requires `OTP_PROVIDER=mock`. There are no fixed
codes or default credentials. Development-only signing material is generated
when no secret is supplied; no example secret needs to be copied.

`backend/.env.example` contains safe local options; copying it is optional.
The client reads `EXPO_PUBLIC_API_URL`; `extra.apiUrl` and source-editing IP
scripts are no longer supported. Metro web uses port8081. Browser UI and API
should both use `localhost`; mixing it with127.0.0.1 breaks same-site cookies.
Configure exact `ALLOWED_ORIGINS` when changing the UI origin. No wildcard CORS.

Choose a private `OTP_OUTBOX_DIR` outside any served directory. The API creates
directory mode0700 and files0600. An authorized local operator reads the matching
`otp-<sessionId>.json` after requesting a code; recovery messages use private
reset files in `AUTH_OUTBOX_DIR` (defaults to the OTP directory). Do not expose
the directory through HTTP, commit its files, or paste its contents into logs.
Browser scripts inspect the actual random delivery internally and redact fixture
secrets from failures. Registration does not verify a real phone/email owner.

## Firebase emulators

```sh
export NAMPAY_EMULATOR_TOOLS=/workspace/qr-pay-emulator-tools
bash scripts/install-emulators.sh
npm run test:emulators
```

The installer pins Firebase CLI15.1.0. Only `demo-nampay` and loopback Auth9099,
RTDB9000, hub4400 and logging4500 are allowed. The three smoke scripts verify
real SDK CRUD/rules, concurrent payment settlement and actual server startup.
See [EMULATORS.md](testing/EMULATORS.md) for startup/proxy details. No service
account or live Firebase project is required for these tests.

## Browser regression runner

`npm run test:browser` owns its local process groups and refuses occupied ports.
It starts a fresh API for each of five runs: auth/recovery, two-account payment,
features, and reliability with reduced/normal motion. It uses installed Chromium
or `NAMPAY_CHROMIUM`; CI installs the Playwright-pinned browser. Private service
logs and outbox files stay in a temporary directory removed when the runner
exits; screenshots contain synthetic data only.

## Native development and release configuration

A physical device cannot reach the host's `localhost`. Use a deliberately
configured reachable development API host and bind the API's `HOST` only to the
interface needed for that isolated demonstration. Keep provider credentials and
real accounts out of it. Distributed bundles require an HTTPS origin.

`npm --prefix frontend run build:web` exports a web bundle; `build:bundles`
exports web and native JavaScript/assets. Neither is an installed native app.
The [native helper](../scripts/native-build.sh) and [acceptance checklist](testing/NATIVE_ACCEPTANCE.md)
document the SDK license/tooling/device prerequisites. No SDK agreement is
accepted automatically and no paid EAS build is launched by local setup.

Production configuration intentionally rejects memory storage and mock OTP.
This prototype is not a deployment recipe for real payments. Contact ownership
verification, push infrastructure, external reconciliation and production
operational controls remain unavailable or outside this implementation.
