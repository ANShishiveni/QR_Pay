#!/usr/bin/env bash
set -euo pipefail

qr_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
qr_tools="${NAMPAY_EMULATOR_TOOLS:-$qr_root/.cache/firebase-tools}"
qr_cli="$qr_tools/node_modules/.bin/firebase"
if [[ ! -x "$qr_cli" ]]; then
  printf '%s\n' 'Firebase Emulator tooling is missing. Run bash scripts/install-emulators.sh first.' >&2
  exit 1
fi
cd "$qr_root"
export FIREBASE_EMULATORS_PATH="${FIREBASE_EMULATORS_PATH:-$qr_tools/artifacts}"
export FIREBASE_CLI_DISABLE_TELEMETRY=1
export GCLOUD_PROJECT=demo-nampay
export FIREBASE_PROJECT_ID=demo-nampay
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
# Only local emulator traffic bypasses the proxy. External downloads continue
# through the existing HTTPS proxy with TLS and artifact checks intact.
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}127.0.0.1,localhost"
export no_proxy="${no_proxy:+$no_proxy,}127.0.0.1,localhost"

# Do not accept a real project or expose the emulators on a public interface.
qr_mode="${1:-start}"
case "$qr_mode" in
  start)
    exec "$qr_cli" emulators:start --only auth,database --project demo-nampay --config firebase.json --non-interactive
    ;;
  exec)
    if [[ $# -ne 2 || -z "$2" ]]; then
      printf '%s\n' 'Usage: bash scripts/emulators.sh exec "command to run against disposable emulators"' >&2
      exit 1
    fi
    exec "$qr_cli" emulators:exec --only auth,database --project demo-nampay --config firebase.json --non-interactive "$2"
    ;;
  *)
    printf '%s\n' 'Only start and exec are supported; this wrapper cannot deploy Firebase resources.' >&2
    exit 1
    ;;
esac
