const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { apiOrigin, webOrigin, launchBrowser, requireDisposableApi, saveScreenshot, assertNoHorizontalOverflow, protect, safeFailure } = require('./browser-helpers.cjs');
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function api(page, method, route, body, expected = 200) {
  const result = await page.evaluate(async ({ origin, method, route, body }) => {
    const response = await fetch(`${origin}/api/${route}`, { method, credentials: 'include', headers: {
      'Content-Type': 'application/json', 'X-Client-Platform': 'web' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }, { origin: apiOrigin, method, route, body });
  assert.equal(result.status, expected, `${method} ${route}: ${result.data.code || result.status}`);
  return result.data;
}

(async () => {
  await requireDisposableApi();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: process.env.NAMPAY_MOTION === 'normal' ? 'no-preference' : 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(webOrigin, { waitUntil: 'networkidle' });
    await button(page, 'Skip').click();
    await api(page, 'POST', 'auth/register', { firstName: 'Synthetic', lastName: 'Recovery',
      email: `recovery-${crypto.randomUUID()}@example.test`, password: protect(crypto.randomBytes(24).toString('base64url')) }, 201);
    await page.reload({ waitUntil: 'networkidle' });
    await button(page, 'Request a payment').click();
    await button(page, 'Create QR request').click();
    const amount = page.getByLabel('Amount (NAD)', { exact: true });
    assert.equal(await amount.getAttribute('aria-invalid'), 'true');
    const descriptionId = await amount.getAttribute('aria-describedby');
    assert.ok(descriptionId);
    assert.ok(await page.locator(`[id="${descriptionId}"]`).textContent());
    await amount.fill('10.50');
    await page.getByLabel('Reference (optional)', { exact: true }).fill('Preserved offline draft');
    let creations = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/qr/generate')) creations += 1; });
    await context.setOffline(true);
    await page.getByText('Connection unavailable. Changes are paused. Reconnect to check the latest status.', { exact: true }).waitFor();
    await button(page, 'Create QR request').click();
    await page.getByText('Reconnect before making changes. Your request has not been sent.', { exact: true }).waitFor();
    assert.equal(creations, 0);
    assert.equal(await amount.inputValue(), '10.50');
    assert.equal(await page.getByLabel('Reference (optional)', { exact: true }).inputValue(), 'Preserved offline draft');
    await saveScreenshot(page, 'offline-request-light-compact');
    await context.setOffline(false);
    await page.getByText('Connection unavailable. Changes are paused. Reconnect to check the latest status.', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(creations, 0, 'Reconnection must not replay a queued write');
    await button(page, 'Create QR request').click();
    await page.getByTestId('request-qr-image').waitFor();
    assert.equal(creations, 1, 'The explicit request action must send exactly one creation');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Home', exact: true, selected: true }).waitFor();
    await page.getByRole('tab', { name: 'Home', exact: true }).focus();
    for (const name of ['Payments', 'Activity', 'Profile']) {
      await page.keyboard.press('ArrowRight');
      await page.getByRole('tab', { name: new RegExp(`^${name}(?:,|$)`), selected: true }).waitFor();
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'tab');
    }
    await button(page, 'Sign out').focus();
    await button(page, 'Sign out').click();
    const dialog = page.getByRole('dialog', { name: 'Sign out of NamPay?', exact: true });
    await dialog.waitFor();
    assert.equal(await page.getByRole('dialog').count(), 1, 'The confirmation must expose exactly one dialog');
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let index = 0; index < 5; index += 1) {
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), true,
          `${key} must keep focus inside the confirmation dialog`);
      }
    }
    await saveScreenshot(page, 'confirmation-light-compact');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Sign out');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await page.getByRole('heading', { name: 'Your inbox', exact: true }).waitFor();
    await button(page, 'Mark request created as read').click();
    await page.getByText('0 unread updates', { exact: true }).waitFor();
    const events = (await api(page, 'GET', 'users/notifications')).notifications;
    assert.equal(events.length, 1, 'The account must retain exactly one request event'); assert.ok(events[0].readAt);
    await saveScreenshot(page, 'notifications-light-compact');
    await button(page, 'Go back').click();
    await button(page, 'Settings').click();
    await page.getByRole('switch', { name: 'Show in-app alerts', exact: true }).click();
    await button(page, 'Save preferences').click();
    await page.getByText('Your preferences have been saved.', { exact: true }).waitFor();
    await api(page, 'POST', 'qr/generate', { amountMinor: 900, reference: 'Muted alert fixture' }, 201);
    await button(page, 'Go back').click();
    await button(page, 'Notifications').click();
    await page.getByText('In-app alerts are off', { exact: true }).waitFor();
    await page.getByText('1 unread update', { exact: true }).waitFor();
    await button(page, 'Go back').click();
    // Normal-motion navigation hides the previous screen until its transition
    // finishes. Locator count does not wait for that screen to become visible.
    await button(page, 'Notifications').waitFor({ state: 'visible' });
    assert.equal(await button(page, 'Notifications').count(), 1, 'The returned Profile must expose one unbadged inbox action');
    await assertNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, 'profile-light-wide');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.body.style.zoom = '2'; });
    await assertNoHorizontalOverflow(page);
    await button(page, 'Settings').click();
    await button(page, 'Save preferences').scrollIntoViewIfNeeded();
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, 'settings-browser-zoom-200');
    assert.deepEqual(errors, []);
    console.log('PASS: offline write guard and retained draft; read-only reconnection; exactly one explicit request; keyboard tabs; named dialog focus trap/Escape/restore; associated input errors; owned inbox read reconciliation and muted alerts with preserved history; compact/wide and 200% browser zoom fit.');
  } finally { await browser.close(); }
})().catch(error => { console.error(safeFailure(error)); process.exitCode = 1; });
