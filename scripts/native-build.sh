#!/usr/bin/env bash
set -euo pipefail

# Local Android demonstration build. Never installs SDK packages, accepts
# licenses, signs in to EAS, uploads source, or invokes a paid build service.
nampay_repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
nampay_frontend="$nampay_repo/frontend"
nampay_mode="${1:---check}"
nampay_sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/workspace/.android-sdk}}"

case "$nampay_mode" in
  --help|-h)
    cat <<'HELP'
Usage: bash scripts/native-build.sh [--check|--validate-config|--build]

--validate-config  Check the HTTPS API origin and local app version only.
--check            Also check installed Java and licensed Android SDK tools.
--build            Run the checks, prebuild in .local/, then assemble a demo APK.

Required: EXPO_PUBLIC_API_URL=https://your-reachable-demo-api-host
SDK: ANDROID_HOME (or ANDROID_SDK_ROOT); default /workspace/.android-sdk.
See docs/testing/NATIVE_ACCEPTANCE.md before building or distributing.
HELP
    exit 0 ;;
  --check|--validate-config|--build) ;;
  *) printf '%s\n' 'Unknown mode. Use --help.' >&2; exit 2 ;;
esac
if [[ $# -gt 1 ]]; then printf '%s\n' 'Only one mode is accepted.' >&2; exit 2; fi
if ! command -v node >/dev/null 2>&1; then printf '%s\n' 'Node.js is required.' >&2; exit 2; fi

node - "$nampay_frontend" <<'NODE'
const path = require('node:path');
try {
  const root = process.argv[2];
  const { resolveApiHost } = require(path.join(root, 'src/config/apiPolicy.js'));
  resolveApiHost(process.env.EXPO_PUBLIC_API_URL, { development: false });
  const unexpected = Object.keys(process.env).some(key => key.startsWith('EXPO_PUBLIC_') && key !== 'EXPO_PUBLIC_API_URL');
  if (unexpected) throw new Error('Only EXPO_PUBLIC_API_URL is permitted as a public environment variable for this demo build.');
  const app = require(path.join(root, 'app.json')).expo;
  if (!/^\d+\.\d+\.\d+$/.test(app.version)) throw new Error('Set a three-part Expo app version before building.');
  if (!Number.isSafeInteger(app.android?.versionCode ?? 1) || (app.android?.versionCode ?? 1) < 1) throw new Error('Android versionCode must be a positive integer.');
  console.log(`PASS: HTTPS API origin configuration; app version ${app.version}.`);
} catch (error) { console.error(`BLOCKED: ${error.message}`); process.exitCode = 2; }
NODE
if [[ "$nampay_mode" == '--validate-config' ]]; then exit 0; fi
if ! node "$nampay_repo/scripts/patch-dependencies.cjs" --check; then
  printf '%s\n' 'BLOCKED: Verify the pinned Metro patch using the documented frontend install.' >&2
  exit 2
fi

node - "$nampay_frontend" "$nampay_sdk_root" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const [root, sdk] = process.argv.slice(2);
const problems = [];
if (process.env.ANDROID_HOME && process.env.ANDROID_SDK_ROOT && path.resolve(process.env.ANDROID_HOME) !== path.resolve(process.env.ANDROID_SDK_ROOT)) {
  problems.push('ANDROID_HOME and ANDROID_SDK_ROOT must identify the same SDK.');
}
if (!fs.existsSync(path.join(root, 'node_modules/expo/bin/cli'))) problems.push('Install frontend dependencies with the committed lockfile first.');
const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
const major = Number(`${java.stderr || ''}${java.stdout || ''}`.match(/version "(\d+)/)?.[1]);
if (java.error || java.status !== 0 || ![17, 21].includes(major)) problems.push('Java 17 or 21 is required; Java 21 is the checked environment version.');
const required = [
  ['platforms/android-35/android.jar', 'Android SDK Platform 35'],
  ['build-tools/35.0.0/aapt2', 'Android Build-Tools 35.0.0'],
  ['build-tools/35.0.0/apksigner', 'Android APK signature verifier'],
  ['platform-tools/adb', 'Android Platform-Tools'],
  ['ndk/27.1.12297006/source.properties', 'NDK 27.1.12297006'],
  ['cmake/3.22.1/bin/cmake', 'CMake 3.22.1'],
];
for (const [file, label] of required) if (!fs.existsSync(path.join(sdk, file))) problems.push(`${label} is not installed.`);
const license = path.join(sdk, 'licenses/android-sdk-license');
if (!fs.existsSync(license) || !fs.readFileSync(license, 'utf8').trim()) {
  problems.push('Android SDK license acceptance is absent. An authorized person must review and accept it; this script never does so.');
}
if (problems.length) {
  problems.forEach(problem => console.error(`BLOCKED: ${problem}`));
  process.exitCode = 2;
} else console.log('PASS: installed native build prerequisites. Device/runtime validation is still separate.');
NODE
if [[ "$nampay_mode" == '--check' ]]; then exit 0; fi

export ANDROID_HOME="$nampay_sdk_root"
export ANDROID_SDK_ROOT="$nampay_sdk_root"
export EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 CI=1
mkdir -p "$nampay_repo/.local/artifacts"
nampay_stage="$(mktemp -d "$nampay_repo/.local/native-build.XXXXXX")"
printf 'Staging the native project in %s\n' "$nampay_stage"
node - "$nampay_frontend" "$nampay_stage" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const [source, target] = process.argv.slice(2);
const repo = path.dirname(source);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim());
const project = path.join(target, 'frontend');
const excluded = new Set(['node_modules', 'android', 'ios', 'dist', 'dist-native', 'web-build', '.git', '.expo', '.local', '.cache', 'coverage', 'credentials.json', 'google-services.json', 'GoogleService-Info.plist']);
fs.cpSync(source, project, { recursive: true, filter: candidate => {
  const name = path.basename(candidate);
  return !excluded.has(name) && !name.startsWith('.env') && !/\.(keystore|jks|p12|mobileprovision)$/.test(name);
} });
fs.symlinkSync(path.join(source, 'node_modules'), path.join(project, 'node_modules'), 'dir');
// Keep the monorepo layout expected by frontend's postinstall hook. Prebuild
// uses --no-install; the checked, already-patched dependencies are shared.
fs.mkdirSync(path.join(target, 'scripts'));
fs.copyFileSync(path.join(repo, 'scripts/patch-dependencies.cjs'), path.join(target, 'scripts/patch-dependencies.cjs'));
fs.writeFileSync(path.join(target, 'source-metadata.json'), JSON.stringify({ commit, dirty, stagedAt: new Date().toISOString() }));
NODE
cd -- "$nampay_stage/frontend"
node "$nampay_frontend/node_modules/expo/bin/cli" prebuild --platform android --no-install --template expo-template-bare-minimum@53.0.42
node - "$nampay_stage/frontend/android" "$nampay_sdk_root" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [android, sdk] = process.argv.slice(2);
fs.writeFileSync(path.join(android, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`);
const gradle = fs.readFileSync(path.join(android, 'app/build.gradle'), 'utf8');
if (!/release\s*\{[\s\S]*?signingConfig signingConfigs\.debug/.test(gradle)) {
  throw new Error('The pinned demo template no longer uses its demonstration signing configuration. Review before building.');
}
NODE
cd -- "$nampay_stage/frontend/android"
./gradlew --no-daemon :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
nampay_apk="$nampay_stage/frontend/android/app/build/outputs/apk/release/app-release.apk"
"$nampay_sdk_root/build-tools/35.0.0/apksigner" verify "$nampay_apk"
node - "$nampay_repo" "$nampay_stage" "$nampay_apk" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [repo, stage, apk] = process.argv.slice(2);
const app = JSON.parse(fs.readFileSync(path.join(stage, 'frontend/app.json'), 'utf8')).expo;
const packageVersion = JSON.parse(fs.readFileSync(path.join(stage, 'frontend/package.json'), 'utf8')).version;
const { commit, dirty, stagedAt } = JSON.parse(fs.readFileSync(path.join(stage, 'source-metadata.json'), 'utf8'));
const createdAt = new Date().toISOString();
const stamp = createdAt.replace(/[-:.]/g, '');
const filename = `nampay-${app.version}-demo-${commit.slice(0, 8)}-${stamp}.apk`;
const output = path.join(repo, '.local/artifacts', filename);
fs.copyFileSync(apk, output, fs.constants.COPYFILE_EXCL);
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
const metadata = { version: app.version, packageVersion, versionCode: app.android?.versionCode ?? 1, commit, dirty, stagedAt, createdAt, sha256,
  apiOrigin: new URL(process.env.EXPO_PUBLIC_API_URL).origin, architectures: ['arm64-v8a', 'x86_64'],
  signing: 'Expo template demonstration certificate; not for production distribution', runtimeAcceptance: 'not verified' };
fs.writeFileSync(`${output}.json`, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
console.log(`Built demonstration APK: ${output}`);
console.log(`SHA256: ${sha256}`);
console.log('Native device, screen-reader, secure-storage and payment acceptance checks still required.');
NODE
