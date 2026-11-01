#!/usr/bin/env bash
set -euo pipefail

qr_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
qr_tools="${NAMPAY_EMULATOR_TOOLS:-$qr_root/.cache/firebase-tools}"
# 15.1 supports Node 24 and honors NO_PROXY for local emulator requests.
# 15.34's unconditional Undici ProxyAgent routes loopback through egress.
qr_cli_version="15.1.0"
mkdir -p "$qr_tools"

# Isolated tooling retains npm's TLS and package-integrity checks.
if [[ -f "$qr_tools/package-lock.json" ]] && node -e \
  'const p = require(process.argv[1]); process.exit(p.dependencies?.["firebase-tools"] === process.argv[2] ? 0 : 1)' \
  "$qr_tools/package.json" "$qr_cli_version"; then
  npm ci --prefix "$qr_tools" --no-audit --no-fund
else
  npm install --prefix "$qr_tools" --save-exact --no-audit --no-fund "firebase-tools@$qr_cli_version"
fi
"$qr_tools/node_modules/.bin/firebase" --version
