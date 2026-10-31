#!/usr/bin/env bash
set -euo pipefail
umask 077

qr_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$qr_root"
for qr_command in node setsid timeout; do
  command -v "$qr_command" >/dev/null || { printf 'Required command is missing: %s\n' "$qr_command" >&2; exit 1; }
done
export NAMPAY_WEB_ORIGIN="${NAMPAY_WEB_ORIGIN:-http://localhost:8081}"
export NAMPAY_SMOKE_API="${NAMPAY_SMOKE_API:-http://localhost:3000}"
qr_ports="$(node <<'NODE'
const ports = ['NAMPAY_SMOKE_API', 'NAMPAY_WEB_ORIGIN'].map(name => {
  let url;
  try { url = new URL(process.env[name]); }
  catch { throw new Error('Browser CI origin is invalid'); }
  const port = Number(url.port);
  if (url.protocol !== 'http:' || url.hostname !== 'localhost' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Browser CI requires plain localhost origins with explicit unprivileged ports');
  }
  return port;
});
if (ports[0] === ports[1]) throw new Error('API and web ports must differ');
process.stdout.write(ports.join(' '));
NODE
)"
read -r qr_api_port qr_web_port <<< "$qr_ports"

if [[ -z "${NAMPAY_CHROMIUM:-}" ]]; then
  if [[ -x /usr/bin/chromium ]]; then
    export NAMPAY_CHROMIUM=/usr/bin/chromium
  else
    export NAMPAY_CHROMIUM="$(node -p "require('playwright').chromium.executablePath()")"
  fi
fi
if [[ ! -x "$NAMPAY_CHROMIUM" ]]; then
  printf '%s\n' 'Chromium is missing. Run npx --no-install playwright install --with-deps chromium, or set NAMPAY_CHROMIUM.' >&2
  exit 1
fi

# Refuse occupied ports instead of reusing an existing app or terminating it.
node - "$qr_api_port" "$qr_web_port" <<'NODE'
const net = require('node:net');
(async () => {
  for (const port of process.argv.slice(2).map(Number)) {
    for (const host of ['127.0.0.1', '::1']) {
      await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', error => {
          if (host === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) resolve();
          else reject(new Error(`Local CI port ${port} is unavailable (${error.code})`));
        });
        server.listen({ host, port, exclusive: true }, () => server.close(resolve));
      });
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
NODE

qr_work="$(mktemp -d "${TMPDIR:-/tmp}/nampay-browser-ci.XXXXXXXX")"
export OTP_OUTBOX_DIR="$qr_work/outbox"
export AUTH_OUTBOX_DIR="$OTP_OUTBOX_DIR"
qr_api_pid=''
qr_web_pid=''
qr_smoke_pid=''

stop_owned_group() {
  local qr_pid="${1:-}"
  [[ "$qr_pid" =~ ^[0-9]+$ ]] || return 0
  # Each saved PID was started below through setsid, so its group belongs to
  # this runner. Never use pkill, killall, port-based kills or a shared group.
  if kill -0 -- "-$qr_pid" 2>/dev/null; then
    kill -TERM -- "-$qr_pid" 2>/dev/null || true
    for ((qr_wait = 0; qr_wait < 30; qr_wait++)); do
      kill -0 -- "-$qr_pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- "-$qr_pid" 2>/dev/null || true
  fi
  wait "$qr_pid" 2>/dev/null || true
}

cleanup() {
  local qr_status=$?
  trap - EXIT INT TERM
  stop_owned_group "$qr_smoke_pid"
  stop_owned_group "$qr_api_pid"
  stop_owned_group "$qr_web_pid"
  # Private delivery files and service logs are never uploaded or printed.
  rm -rf -- "$qr_work"
  exit "$qr_status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

wait_ready() {
  node - "$1" "$2" "$3" <<'NODE'
const [origin, kind, pid] = process.argv.slice(2);
const deadline = Date.now() + (kind === 'web' ? 180_000 : 60_000);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
(async () => {
  while (Date.now() < deadline) {
    try { process.kill(Number(pid), 0); }
    catch { throw new Error(`${kind} process exited before readiness`); }
    try {
      const response = await fetch(`${origin}${kind === 'api' ? '/api/health' : '/'}`, { signal: AbortSignal.timeout(2_000) });
      if (response.status !== 200) throw new Error('Not ready');
      if (kind === 'api') {
        const health = await response.json();
        if (health.simulated !== true || health.environment !== 'development' || health.database !== 'memory') {
          throw new Error('Unexpected API configuration');
        }
      } else {
        // Warm Metro's entry bundle before Playwright's navigation timeout.
        // Only fetch local script URLs; do not print response bodies or URLs.
        const html = await response.text();
        const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)];
        if (!scripts.length) throw new Error('Web entry scripts are not ready');
        for (const match of scripts) {
          const url = new URL(match[1].replaceAll('&amp;', '&'), origin);
          if (url.origin !== origin) throw new Error('Unexpected external entry script');
          const budget = Math.min(120_000, deadline - Date.now());
          if (budget <= 0) throw new Error('Readiness deadline exceeded');
          const bundle = await fetch(url, { signal: AbortSignal.timeout(budget) });
          if (bundle.status !== 200) throw new Error('Web entry compilation failed');
          await bundle.arrayBuffer();
        }
      }
      console.log(`Ready: disposable local ${kind}`);
      return;
    } catch { await delay(500); }
  }
  throw new Error(`${kind} readiness deadline exceeded`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
NODE
}

# EXPO_NO_DOTENV prevents unrelated developer configuration entering the bundle.
# External proxy and TLS settings remain unchanged; the browser helper bypasses
# proxy routing only for loopback requests.
setsid env CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 BROWSER=none \
  NODE_ENV=development EXPO_PUBLIC_API_URL="$NAMPAY_SMOKE_API" \
  npm --prefix frontend run web -- --localhost --port "$qr_web_port" \
  >"$qr_work/web.log" 2>&1 &
qr_web_pid=$!
wait_ready "$NAMPAY_WEB_ORIGIN" web "$qr_web_pid"

run_smoke() {
  local qr_script="$1"
  local qr_motion="${2:-reduce}"
  # A new API gives each script empty data and independent rate-limit windows.
  mkdir -m 700 "$OTP_OUTBOX_DIR"
  setsid env NODE_ENV=development DEMO_MODE=true DATABASE_MODE=memory OTP_PROVIDER=mock \
    HOST=127.0.0.1 PORT="$qr_api_port" ALLOWED_ORIGINS="$NAMPAY_WEB_ORIGIN" \
    JWT_SECRET='' QR_SIGNING_SECRET='' FIREBASE_PROJECT_ID=demo-nampay \
    FIREBASE_DATABASE_EMULATOR_HOST='' FIREBASE_AUTH_EMULATOR_HOST='' \
    node backend/server.js >"$qr_work/api.log" 2>&1 &
  qr_api_pid=$!
  wait_ready "$NAMPAY_SMOKE_API" api "$qr_api_pid"
  printf 'Running %s (motion: %s)\n' "$qr_script" "$qr_motion"
  setsid timeout --signal=TERM --kill-after=5s 240s \
    env NAMPAY_MOTION="$qr_motion" node "$qr_script" &
  qr_smoke_pid=$!
  local qr_result=0
  wait "$qr_smoke_pid" || qr_result=$?
  stop_owned_group "$qr_smoke_pid"
  qr_smoke_pid=''
  stop_owned_group "$qr_api_pid"
  qr_api_pid=''
  rm -rf -- "$OTP_OUTBOX_DIR"
  return "$qr_result"
}

run_smoke scripts/browser-auth-smoke.cjs
run_smoke scripts/browser-payments-smoke.cjs
run_smoke scripts/browser-features-smoke.cjs
run_smoke scripts/browser-reliability-smoke.cjs reduce
run_smoke scripts/browser-reliability-smoke.cjs normal
printf '%s\n' 'PASS: all five disposable browser smoke runs completed.'
