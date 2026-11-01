const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// Keep loopback traffic local while preserving the environment proxy and TLS
// checks for external resources. Never bypass certificate validation.
process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK = '1';
const { chromium } = require('playwright');

const webOrigin = process.env.NAMPAY_WEB_ORIGIN || 'http://localhost:8081';
const apiOrigin = process.env.NAMPAY_SMOKE_API || 'http://localhost:3000';
const privateValues = new Set();
const protect = value => { if (typeof value === 'string' && value) privateValues.add(value); return value; };
const safeFailure = error => {
  let message = String(error?.message || 'Browser verification failed');
  for (const value of privateValues) message = message.split(value).join('[private test value]');
  return message;
};
for (const origin of [webOrigin, apiOrigin]) {
  assert.equal(new URL(origin).hostname, 'localhost', 'Browser tests require a disposable localhost environment');
}

async function launchBrowser() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  return chromium.launch({
    executablePath: process.env.NAMPAY_CHROMIUM || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
    ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}),
  });
}

async function requireDisposableApi() {
  const response = await fetch(`${apiOrigin}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.simulated, true);
  assert.equal(health.environment, 'development');
  assert.equal(health.database, 'memory', 'Browser fixtures may only modify disposable memory state');
}

async function saveScreenshot(page, name) {
  const directory = path.resolve(__dirname, '../docs/design/screenshots');
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, 'The screen must fit its viewport');
}

module.exports = { apiOrigin, webOrigin, launchBrowser, requireDisposableApi, saveScreenshot, assertNoHorizontalOverflow, protect, safeFailure };
