const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { apiOrigin, webOrigin, launchBrowser, requireDisposableApi, saveScreenshot, assertNoHorizontalOverflow, protect, safeFailure } = require('./browser-helpers.cjs');

async function api(page, method, route, body, expected = 200) {
  const result = await page.evaluate(async ({ origin, method, route, body }) => {
    const response = await fetch(`${origin}/api/${route}`, { method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'web' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }, { origin: apiOrigin, method, route, body });
  assert.equal(result.status, expected, `${method} ${route}: ${result.data.code || result.status}`);
  return result.data;
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function fixture(browser, role) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(webOrigin, { waitUntil: 'networkidle' });
  await button(page, 'Skip').click();
  const credentials = { email: `features-${crypto.randomUUID()}@example.test`, password: protect(crypto.randomBytes(24).toString('base64url')) };
  await api(page, 'POST', 'auth/register', { firstName: 'Synthetic', lastName: role, ...credentials }, 201);
  await page.reload({ waitUntil: 'networkidle' });
  await button(page, 'Manage test cards').waitFor();
  return { page, context, credentials, errors };
}
async function addCard(page, label) {
  await button(page, 'Add a test card').click();
  await button(page, label).click();
  await button(page, 'Add selected test card').click();
  await button(page, 'Add test card').click();
  await page.getByText('Test card added.', { exact: true }).waitFor();
}
async function seedPayment(payer, recipient, card) {
  // Payment UI (including response loss) is exercised separately by
  // browser-payments-smoke. This fixture uses the same real local contracts.
  const request = await api(recipient, 'POST', 'qr/generate', { amountMinor: 2345, reference: 'Feature receipt fixture' }, 201);
  const requestId = request.paymentRequest.id;
  await api(payer, 'POST', 'qr/scan', { qrData: request.qrData });
  const challenge = await api(payer, 'POST', 'otp/send', { requestId });
  const outbox = process.env.OTP_OUTBOX_DIR || path.resolve(__dirname, '../.local/outbox');
  const delivery = JSON.parse(await fs.readFile(path.join(outbox, `otp-${challenge.sessionId}.json`), 'utf8'));
  assert.equal(delivery.simulated, true);
  await api(payer, 'POST', 'otp/verify', { sessionId: challenge.sessionId, otp: protect(delivery.code) });
  return (await api(payer, 'POST', 'qr/confirm-payment', { requestId, cardId: card.id, sessionId: challenge.sessionId,
    idempotencyKey: crypto.randomUUID() })).transaction;
}

(async () => {
  await requireDisposableApi();
  const browser = await launchBrowser();
  try {
    const actor = await fixture(browser, 'Feature');
    const recipient = await fixture(browser, 'Recipient');
    const { page } = actor;
    await button(page, 'Manage test cards').click();
    await addCard(page, 'Visa test instrument ending 4242');
    await addCard(page, 'Mastercard test instrument ending 4444');
    await button(page, 'Make Mastercard ending 4444 default').click();
    await page.getByText('Default test card updated.', { exact: true }).waitFor();
    let cards = (await api(page, 'GET', 'payments/cards')).cards;
    assert.equal(cards.filter(card => card.isDefault).length, 1);
    assert.equal(cards.find(card => card.isDefault).testCardId, 'demo-mastercard');
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, 'test-cards-light-compact');
    await button(page, 'Remove Mastercard ending 4444').click();
    await button(page, 'Remove test card').click();
    await page.getByText('Test card removed.', { exact: true }).waitFor();
    cards = (await api(page, 'GET', 'payments/cards')).cards;
    assert.equal(cards.length, 1); assert.equal(cards[0].isDefault, true);
    const transaction = await seedPayment(page, recipient.page, cards[0]);
    await api(page, 'POST', 'qr/generate', { amountMinor: 1200, reference: 'Pending feature fixture' }, 201);
    await button(page, 'Go back').click();
    await page.getByText('1 completed simulation · all time', { exact: true }).waitFor();
    await page.getByText('Pending feature fixture', { exact: true }).waitFor();
    assert.equal((await api(page, 'GET', 'users/stats')).stats.totalSentMinor, 2345);
    assert.equal(await page.getByText(/available balance/i).count(), 0);
    await page.evaluate(() => { for (const element of document.querySelectorAll('*')) if (element.scrollTop) element.scrollTop = 0; });
    await saveScreenshot(page, 'home-light-compact');
    await button(page, 'View all activity').click();
    await page.getByText('Showing 1 of 1 matching transactions', { exact: true }).waitFor();
    await button(page, 'Received').click();
    await page.getByText('No matching activity', { exact: true }).waitFor();
    await button(page, 'Sent').click();
    await page.getByLabel('Search activity', { exact: true }).fill('no matching fixture');
    await button(page, 'Apply search and dates').click();
    await page.getByText('No matching activity', { exact: true }).waitFor();
    await page.getByLabel('Search activity', { exact: true }).fill('Feature receipt fixture');
    await button(page, 'Date and status filters').click();
    const date = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel('From date', { exact: true }).fill(date);
    await page.getByLabel('To date', { exact: true }).fill(date);
    await button(page, 'Status: completed').click();
    await button(page, 'Apply search and dates').click();
    await page.getByText('Showing 1 of 1 matching transactions', { exact: true }).waitFor();
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, 'activity-filters-light-compact');
    await page.getByRole('button', { name: /^Sent N\$23\.45,/ }).click();
    await page.getByRole('heading', { name: 'Transaction details', exact: true }).waitFor();
    await page.getByText(transaction.id, { exact: true }).waitFor();
    await button(page, 'View simulated receipt').click();
    const downloadPromise = page.waitForEvent('download');
    await button(page, 'Share simulated receipt').click();
    const download = await downloadPromise;
    const html = await fs.readFile(await download.path(), 'utf8');
    assert.ok(html.includes(transaction.id)); assert.match(html, /No real funds|no real funds/);
    assert.ok(!html.includes(actor.credentials.email));
    await download.delete();
    await saveScreenshot(page, 'transaction-receipt-light-compact');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Profile', { exact: true }).last().click();
    await button(page, 'My profile').click();
    await page.getByLabel('First name', { exact: true }).fill('Updated');
    await page.getByLabel('Last name', { exact: true }).fill('Synthetic');
    await button(page, 'Save name').click();
    await page.getByText('Your name has been saved.', { exact: true }).waitFor();
    assert.equal((await api(page, 'GET', 'users/profile')).user.firstName, 'Updated');
    // A tiny synthetic PNG remains local until the explicit Save photo action.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await page.getByTestId('profile-photo-input').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
    await button(page, 'Save photo').waitFor();
    assert.ok(!(await api(page, 'GET', 'users/profile')).user.photoUrl);
    await button(page, 'Save photo').click();
    await page.getByText('Your profile photo has been saved.', { exact: true }).waitFor();
    assert.match((await api(page, 'GET', 'users/profile')).user.photoUrl, /^data:image\/png;base64,/);
    await button(page, 'Go back').click();
    await button(page, 'Settings').click();
    await page.getByRole('radio', { name: 'Dark', exact: true }).click();
    await page.getByRole('switch', { name: 'Show in-app alerts', exact: true }).click();
    await button(page, 'Save preferences').click();
    await page.getByText('Your preferences have been saved.', { exact: true }).waitFor();
    const profile = (await api(page, 'GET', 'users/profile')).user;
    assert.equal(profile.preferences.theme, 'dark'); assert.equal(profile.preferences.notifications, false);
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, 'settings-dark-compact');
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Profile', { exact: true }).last().click();
    await button(page, 'Settings').click();
    await page.getByRole('radio', { name: 'Dark', exact: true, checked: true }).waitFor();
    await page.getByRole('radio', { name: 'Dark', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('radio', { name: 'System', exact: true, checked: true }).waitFor();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('radio', { name: 'Dark', exact: true, checked: true }).waitFor();
    await button(page, 'Change password').click();
    const newPassword = protect(crypto.randomBytes(24).toString('base64url'));
    await page.getByLabel('Current password', { exact: true }).fill(protect('Incorrect synthetic proof'));
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword);
    const wrong = page.waitForResponse(response => response.url().endsWith('/api/users/password') && response.request().method() === 'PUT');
    await button(page, 'Update password').click();
    assert.equal((await wrong).status(), 401);
    await api(page, 'GET', 'auth/verify'); // Wrong proof must not end a valid session.
    await page.getByLabel('Current password', { exact: true }).fill(actor.credentials.password);
    await button(page, 'Update password').click();
    await button(page, 'Sign in').waitFor();
    await api(page, 'POST', 'auth/login', actor.credentials, 401);
    await api(page, 'POST', 'auth/login', { email: actor.credentials.email, password: newPassword });
    assert.deepEqual([...actor.errors, ...recipient.errors], []);
    console.log('PASS: test-card add/default/remove; server totals and pending requests; activity filters; owned detail/downloaded receipt; profile name/photo consent; persisted theme/alerts; wrong password proof preserves session and successful change revokes it.');
  } finally { await browser.close(); }
})().catch(error => { console.error(safeFailure(error)); process.exitCode = 1; });
