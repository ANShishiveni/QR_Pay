const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { apiOrigin, webOrigin, launchBrowser, requireDisposableApi, saveScreenshot, assertNoHorizontalOverflow, protect, safeFailure } = require('./browser-helpers.cjs');

(async () => {
  await requireDisposableApi();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(webOrigin, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Skip', exact: true }).waitFor();
    await saveScreenshot(page, 'onboarding-light-compact');
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('heading', { name: 'Good to see you.' }).waitFor();
    assert.equal(await page.getByText('Your session has ended. Please sign in again.', { exact: true }).count(), 0,
      'First-time guests must not receive a false session-expired message');
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, 'auth-login-light-compact');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Enter your password.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    await page.getByRole('heading', { name: 'Your demo starts here.' }).waitFor();
    await saveScreenshot(page, 'auth-register-light-compact');

    const password = protect(crypto.randomBytes(24).toString('base64url'));
    const email = `browser-${crypto.randomUUID()}@example.test`;
    await page.getByLabel('First name', { exact: true }).filter({ visible: true }).fill('Synthetic');
    await page.getByLabel('Last name', { exact: true }).filter({ visible: true }).fill('Browser');
    await page.getByLabel('Email address', { exact: true }).filter({ visible: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).filter({ visible: true }).fill(password);
    await page.getByLabel('Confirm password', { exact: true }).filter({ visible: true }).fill(password);
    const registration = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
    const response = await registration;
    assert.equal(response.status(), 201);
    const registered = await response.json();
    assert.equal(Object.hasOwn(registered, 'token'), false, 'Web JSON must not expose the session token');
    await page.getByText('Payments', { exact: true }).last().waitFor();
    for (const name of ['Home', 'Payments', 'Activity', 'Profile']) assert.ok(await page.getByText(name, { exact: true }).count());
    const cookies = await context.cookies(`${apiOrigin}/api/auth/verify`);
    const session = cookies.find(cookie => cookie.name === 'nampay_session');
    assert.ok(session);
    protect(session.value);
    assert.equal(session.httpOnly, true);
    assert.equal(session.sameSite, 'Strict');
    assert.equal(session.path, '/api');
    assert.equal(await page.evaluate(() => document.cookie.includes('nampay_session')), false);
    const persisted = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    assert.equal(persisted.includes(session.value), false, 'Session token must not be persisted in browser storage');
    assert.equal(persisted.includes(password), false);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Payments', { exact: true }).last().waitFor();

    const logoutStatus = await page.evaluate(async origin => (await fetch(`${origin}/api/auth/logout`, { method: 'POST', credentials: 'include' })).status, apiOrigin);
    assert.equal(logoutStatus, 200);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Good to see you.' }).waitFor();
    const verifiedStatus = await page.evaluate(async origin => (await fetch(`${origin}/api/auth/verify`, { credentials: 'include' })).status, apiOrigin);
    assert.equal(verifiedStatus, 401);
    assert.equal(await page.getByRole('button', { name: 'Skip', exact: true }).count(), 0, 'Onboarding should not repeat after a reload');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, 'auth-login-dark-wide');

    // Exercise recovery with the actual private local provider. Neither the
    // recovery proof nor passwords are logged or included in screenshots.
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.getByRole('button', { name: 'Request recovery instructions', exact: true }).waitFor();
    await page.getByLabel('Email address', { exact: true }).filter({ visible: true }).fill(email);
    await page.getByRole('button', { name: 'Request recovery instructions', exact: true }).click();
    await page.getByRole('heading', { name: 'Check your instructions.' }).waitFor();
    const outbox = process.env.AUTH_OUTBOX_DIR || process.env.OTP_OUTBOX_DIR || path.resolve(__dirname, '../.local/outbox');
    let recovery;
    for (const name of await fs.readdir(outbox)) {
      if (!/^reset-[a-f0-9-]+\.json$/.test(name)) continue;
      const entry = JSON.parse(await fs.readFile(path.join(outbox, name), 'utf8'));
      if (entry.userUid === registered.user.uid) { recovery = { ...entry, file: path.join(outbox, name) }; break; }
    }
    assert.ok(recovery?.simulated, 'A private mock recovery delivery must exist for this synthetic account');
    await page.getByRole('button', { name: 'I have recovery instructions', exact: true }).click();
    await page.getByLabel('Recovery code', { exact: true }).filter({ visible: true }).fill(protect(recovery.token));
    const replacement = protect(crypto.randomBytes(24).toString('base64url'));
    await page.getByLabel('New password', { exact: true }).fill(replacement);
    await page.getByLabel('Confirm new password', { exact: true }).fill(replacement);
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    await page.getByRole('heading', { name: 'Password updated.' }).waitFor();
    await fs.unlink(recovery.file);
    await page.getByRole('button', { name: 'Return to sign in', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).filter({ visible: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).filter({ visible: true }).fill(replacement);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Payments', { exact: true }).last().waitFor();
    assert.deepEqual(errors, [], 'Browser must have no uncaught runtime errors');
    console.log('PASS: onboarding, compact/wide auth, validation, registration, four tabs, HttpOnly isolation, reload, logout, private recovery and sign-in with the changed password.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(safeFailure(error)); process.exitCode = 1; });
