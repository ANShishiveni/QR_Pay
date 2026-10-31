# Android demo build and native acceptance

## Current result

**No Android APK has been built or installed in this cloud workspace.** The
checked environment contains Java 21 and Android command-line tools 19.0 at
`/workspace/.android-sdk/cmdline-tools/19.0/bin/sdkmanager`. `sdkmanager --version`
returns `19.0`; `--list_installed` lists no installed SDK packages. SDK Platform
35, Build-Tools 35.0.0, platform-tools/adb, NDK, CMake and SDK license acceptance
are absent. `/dev/kvm`, a connected physical device and Xcode are unavailable.

An earlier SDK installation reached the Android SDK License Agreement and was
declined. No license hashes were fabricated and no automatic `yes` was supplied.
The SDK manager exited zero after skipping unlicensed packages: that exit code
was not successful provisioning. An authorized person must review and accept
the agreement before native SDK provisioning can continue. No EAS login, paid
cloud build, credentials upload, provider key or public demo account was used.

The repository supplies a local build helper and an optional EAS demo profile.
Their configuration and preflight checks are useful evidence; they do **not**
establish that native compilation, signing, installation or runtime tests pass.
Native JavaScript export is also not an installable APK or a device test.

After a successful export of web, Android and iOS into `frontend/dist-native`,
`scripts/package-demo.cjs` can create a separate versioned `.tar.gz` export
archive and JSON manifest in `.local/artifacts`. Use the same
`EXPO_PUBLIC_API_URL` as the export build; `--check` validates without packaging.
The helper checks actual metadata, Hermes headers, asset paths/content, the web
entry and source freshness, and records file/archive SHA256 hashes. A placeholder
API remains an explicit limitation in the manifest. This export archive is
**not an APK or IPA** and does not change the native acceptance status below.

Checks executed for the build preparation: Bash syntax and repository diff
checks passed; the EAS schema validated; configuration guards rejected missing,
HTTP, credential-bearing and path-bearing API values and unexpected public
environment variables, while accepting an HTTPS origin. A temporary staging
check preserved app 2.0.0/package 2.0.0-demo.0, source metadata and the verified
Metro patch without copying environment files or generated bundles. With a
synthetic HTTPS origin, `--check` returned **2** and reported the missing SDK
packages and license acceptance above. No prebuild, Gradle assembly or EAS build
was run for this evidence.

## Prerequisites and local build

The React Native 0.79 version catalog and the pinned Expo SDK 53 template
(53.0.42, declaring React Native 0.79.6) require the following:

| Prerequisite | Version / requirement |
| --- | --- |
| Node/npm | Match the repository setup instructions and committed lockfiles |
| Java | 17 or 21; environment checked with 21 |
| Android SDK | Platform 35; Build-Tools 35.0.0; platform-tools |
| Native compiler | NDK 27.1.12297006; CMake 3.22.1 |
| Generated wrapper | Gradle 8.13, from Expo template 53.0.42 |
| Backend | A device-reachable HTTPS origin running the isolated NamPay demo API |
| Accounts/data | Synthetic details, private one-time verification delivery, predefined test instruments only |

After an authorized person accepts the Android SDK license, install the SDK
packages using the official SDK manager. The build helper itself never installs
SDK packages or accepts licenses:

```bash
export ANDROID_HOME=/workspace/.android-sdk
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/19.0/bin:$ANDROID_HOME/platform-tools:$PATH"
sdkmanager --sdk_root="$ANDROID_HOME" \
  'platform-tools' 'platforms;android-35' 'build-tools;35.0.0' \
  'ndk;27.1.12297006' 'cmake;3.22.1'
```

Do not paste a provider key, auth token or password into an `EXPO_PUBLIC_`
variable: those values are embedded in client bundles. Configure only the API
origin and use a backend specifically prepared for this demonstration. API
paths, credentials, query strings and fragments are rejected. No real backend
deployment is implied by these instructions.

```bash
# Replace this documentation placeholder with the authorized demo API origin.
export EXPO_PUBLIC_API_URL=https://your-demo-api.example.invalid
bash scripts/native-build.sh --validate-config
bash scripts/native-build.sh --check
# Run only when the preceding check passes and the API is reachable by devices.
bash scripts/native-build.sh --build
```

`--check` makes no network requests. Exit 2 means missing/invalid configuration
or prerequisites; it must not be recorded as a build success. The placeholder
above is suitable for validating the guard, but cannot serve a running app.
`localhost` refers to the phone itself on a physical device. Keep TLS certificate
verification enabled and provision a trusted, reachable demo API origin.

The build copies frontend source into an ignored `.local/native-build.*/frontend`
staging directory, excludes `.env` files, native credential files and previous
generated projects, and uses the installed dependencies. It retains the sibling
`scripts/patch-dependencies.cjs` helper expected by frontend's postinstall
hook and verifies the pinned Metro patch before proceeding. It pins
`expo-template-bare-minimum@53.0.42`, generates Android there, and invokes
`:app:assembleRelease` for ARM64 and x86_64. The checked source checkout is not
prebuilt in place. Network access may be needed for the official template,
Gradle distribution and Maven dependencies; downloads retain their normal TLS
and integrity checks. Staging directories remain available for diagnosis.

The official pinned template signs its release variant with the template's
**demonstration/debug certificate** and embeds the JS bundle. This is a
standalone demo APK rather than a Metro-dependent debug build. The helper
checks the generated signing configuration and verifies the APK signature.
That certificate does not establish a production publisher identity; never use
this profile for an app-store or production release.

Output is versioned and includes a SHA256 and metadata sidecar:

```text
.local/artifacts/nampay-<app-version>-demo-<commit>-<UTC-build-time>.apk
.local/artifacts/nampay-<app-version>-demo-<commit>-<UTC-build-time>.apk.json
```

For app version 2.0.0, the filename begins `nampay-2.0.0-demo-`. The helper
reads the actual `app.json` version and Android versionCode. Metadata records
the source commit, whether the checkout was dirty, API origin, architectures,
signing limitation and outstanding runtime acceptance. The source commit and
dirty state are captured when staging begins. Record the final tested
artifact's hash in the release evidence before sharing it; no artifact exists
at this path until compilation succeeds.

## Optional EAS profile

`frontend/eas.json` pins EAS CLI 27.1.0 and defines only an internal `demo`
profile: standalone release APK, no development client, no auto-increment,
no store submission, no push setup and `withoutCredentials: true`. It relies
on Expo's generated demonstration signing configuration. No account, project
ID, public test credentials or API host is committed.

Run EAS from `frontend/` inside the full Git checkout, keeping the repository's
parent `scripts/` directory in the upload. Do not flatten or upload only the
frontend directory: its postinstall hook requires the sibling Metro patch helper.

The config was checked against the official `@expo/eas-json@27.1.0` schema.
The CLI version's declared Node engine accepts Node 24. The native template's
release signing and bundled JS configuration were inspected from the official
`expo-template-bare-minimum@53.0.42` npm archive. Neither inspection ran EAS Build.

If the owner later chooses EAS, first run `--validate-config`, then configure
the same HTTPS `EXPO_PUBLIC_API_URL` in the project's `preview` environment and
review the upload, signing and billing implications. An authorized owner must
perform any project linking/login. A subsequent explicit build command is:

```bash
cd frontend
npm exec --yes --package=eas-cli@27.1.0 -- eas build --platform android --profile demo
```

This is an optional future command, **not executed** by the setup or local build
helper. Do not run it to bypass SDK-license or unavailable-device acceptance.
EAS success would still leave the runtime checks below outstanding.

## Required native acceptance evidence

Record device model, Android version/API, viewport/font scale, app versionCode,
APK SHA256, backend demo mode, steps, expected/actual results and a redacted
screenshot or recording. Never include passwords, OTPs, session tokens or
private outbox files in evidence. Use two independently registered synthetic
accounts, rather than committing reusable public credentials.

| Target | Required checks | Current result |
| --- | --- | --- |
| Android physical device | Install/launch; recipient request → payer camera scan → review → private OTP → exactly one simulated payment; both histories and receipt; background/resume and logout | Not run; device and APK unavailable |
| Android emulator | Install standalone APK without Metro; compact/large display; hardware back; keyboard/safe area/rotation; offline/reconnect and interrupted confirmation reconciliation | Not run; SDK/emulator unavailable |
| Secure storage | Restart verifies server session; no token in ordinary preferences; expiry/revocation clears protected screens; logout clears secure session; storage failure fails closed | Unit adapter tests only; native runtime not run |
| Camera/gallery | Deny/grant camera, malformed QR image, gallery decode, repeated scan suppression, permission recovery; no microphone prompt | Browser/component evidence only; native runtime not run |
| Share/export | QR image and simulated receipt share/save; cancellation; no real card/contact secrets in exported receipt | Browser/component evidence only; native runtime not run |
| Biometrics | Supported/enrolled hardware, success/cancel/unavailable; server verification remains mandatory | Component tests only; native runtime not run |
| Accessibility | TalkBack focus/announcements; modal trap/close/return; 200% native font; contrast; switch controls; reduced motion; touch targets | Native runtime not run; see ACCESSIBILITY.md |
| iOS | Simulator/device build and equivalent lifecycle/permissions/storage checks when a macOS/Xcode target is available | Not available in this Linux environment |

At least one physical Android device and one Android emulator are still needed
to satisfy the blueprint. A successful build, web export, browser smoke test or
mocked native component test does not replace those checks.
