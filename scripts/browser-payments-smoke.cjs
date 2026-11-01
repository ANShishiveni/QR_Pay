const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { apiOrigin, webOrigin, launchBrowser, requireDisposableApi, saveScreenshot, assertNoHorizontalOverflow, protect, safeFailure } = require('./browser-helpers.cjs');

async function api(page, method, route, body, expected = 200) {
  const result = await page.evaluate(async ({ origin, method, route, body }) => {
    const response = await fetch(`${origin}/api/${route}`, {
      method, credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'web' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  }, { origin: apiOrigin, method, route, body });
  assert.equal(result.status, expected, `${method} ${route}: ${result.data.code || result.status}`);
  return result.data;
}

async function fixture(browser, role) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(webOrigin, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await api(page, 'POST', 'auth/register', {
    firstName: 'Synthetic', lastName: role, email: `flow-${role.toLowerCase()}-${crypto.randomUUID()}@example.test`,
    password: protect(crypto.randomBytes(24).toString('base64url')),
  }, 201);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Payments', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Request a payment', exact: true }).waitFor();
  return { context, page, errors };
}

(async () => {
  await requireDisposableApi();
  const browser = await launchBrowser();
  const files = [];
  try {
    const recipient = await fixture(browser, 'Recipient');
    const payer = await fixture(browser, 'Payer');
    // Phase 3 verifies the payment journey. Card management gets its own UI
    // checks in Phase 4; this fixture uses only the allowlisted test instrument.
    await api(payer.page, 'POST', 'payments/link-card', { testCardId: 'demo-visa' }, 201);
    await recipient.page.getByRole('button', { name: 'Request a payment', exact: true }).click();
    await recipient.page.getByLabel('Amount (NAD)', { exact: true }).fill('23.45');
    await recipient.page.getByLabel('Reference (optional)', { exact: true }).fill('Synthetic browser request');
    const generatedResponse = recipient.page.waitForResponse(response => response.url().endsWith('/api/qr/generate') && response.request().method() === 'POST');
    await recipient.page.getByRole('button', { name: 'Create QR request', exact: true }).click();
    const generated = await (await generatedResponse).json();
    assert.equal(generated.paymentRequest.amountMinor, 2345);
    const requestId = generated.paymentRequest.id;
    await recipient.page.getByTestId('request-qr-image').waitFor();
    await assertNoHorizontalOverflow(recipient.page);
    await saveScreenshot(recipient.page, 'request-active-light-compact');
    const file = path.resolve(__dirname, `../.local/qr-browser-${crypto.randomUUID()}.png`);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await fs.writeFile(file, Buffer.from(generated.qrCode.split(',')[1], 'base64'), { mode: 0o600 });
    files.push(file);

    await payer.page.getByRole('button', { name: 'Scan a QR code', exact: true }).click();
    await payer.page.getByRole('heading', { name: 'Scan a request', exact: true }).waitFor();
    await saveScreenshot(payer.page, 'scanner-light-compact');
    await payer.page.getByTestId('qr-gallery-input').setInputFiles(file);
    await payer.page.getByRole('heading', { name: 'Review payment', exact: true }).waitFor();
    await payer.page.getByText('Synthetic Recipient', { exact: true }).first().waitFor();
    await assertNoHorizontalOverflow(payer.page);
    await saveScreenshot(payer.page, 'payment-review-light-compact');
    await payer.page.getByRole('button', { name: 'Continue to verification', exact: true }).click();
    const sent = payer.page.waitForResponse(response => response.url().endsWith('/api/otp/send') && response.request().method() === 'POST');
    await payer.page.getByRole('button', { name: 'Send verification code', exact: true }).click();
    const challenge = await (await sent).json();
    assert.ok(challenge.sessionId);
    const outbox = process.env.OTP_OUTBOX_DIR || path.resolve(__dirname, '../.local/outbox');
    const delivery = JSON.parse(await fs.readFile(path.join(outbox, `otp-${challenge.sessionId}.json`), 'utf8'));
    assert.equal(delivery.simulated, true);
    await payer.page.getByLabel('Payment verification code', { exact: true }).waitFor();
    await saveScreenshot(payer.page, 'payment-verification-light-compact');

    // The server commits, but its HTTP response is deliberately lost. Block
    // reconciliation briefly to assert the UI stays uncertain, then recover.
    let holdStatus = false;
    let committed;
    let confirmCalls = 0;
    await payer.page.route(`**/api/qr/requests/${requestId}`, async route => {
      if (holdStatus) await route.abort('failed'); else await route.continue();
    });
    await payer.page.route('**/api/qr/confirm-payment', async route => {
      confirmCalls += 1;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      committed = (await response.json()).transaction;
      holdStatus = true;
      await route.abort('failed');
    });
    await payer.page.getByLabel('Payment verification code', { exact: true }).fill(protect(delivery.code));
    await payer.page.getByRole('button', { name: 'Verify and confirm payment', exact: true }).click();
    await payer.page.getByText('We couldn’t confirm the result. Reconnect and check payment status before doing anything else.', { exact: true }).waitFor();
    assert.equal(await payer.page.getByRole('heading', { name: 'Simulated payment completed', exact: true }).count(), 0);
    assert.equal(confirmCalls, 1);
    assert.ok(committed?.id);
    await saveScreenshot(payer.page, 'payment-uncertain-light-compact');
    holdStatus = false;
    await payer.page.getByRole('button', { name: 'Check payment status', exact: true }).click();
    await payer.page.getByRole('heading', { name: 'Simulated payment completed', exact: true }).waitFor();
    await saveScreenshot(payer.page, 'payment-result-light-compact');
    assert.equal(confirmCalls, 1, 'Status reconciliation must not create another confirmation');

    for (const [actor, role] of [[payer, 'sent'], [recipient, 'received']]) {
      const history = await api(actor.page, 'GET', 'users/transactions');
      assert.equal(history.transactions.length, 1);
      assert.equal(history.transactions[0].id, committed.id);
      assert.equal(history.transactions[0].role, role);
      assert.equal(history.transactions[0].amountMinor, 2345);
      const receipt = await api(actor.page, 'GET', `payments/transactions/${committed.id}`);
      assert.equal(receipt.transaction.simulated, true);
    }
    await recipient.page.getByText('Simulated payment received', { exact: true }).waitFor();
    await recipient.page.getByRole('button', { name: 'View simulated receipt', exact: true }).click();
    await recipient.page.getByRole('heading', { name: 'Simulated payment completed', exact: true }).waitFor();
    await api(payer.page, 'POST', 'qr/scan', { qrData: generated.qrData }, 409);
    assert.deepEqual([...payer.errors, ...recipient.errors], []);
    console.log('PASS: two browser accounts, request image/gallery import, authoritative review, private OTP, lost confirmation response, uncertain-state reconciliation, one transaction, both histories/receipts and used-QR rejection.');
  } finally {
    await browser.close();
    await Promise.all(files.map(file => fs.rm(file, { force: true })));
  }
})().catch(error => { console.error(safeFailure(error)); process.exitCode = 1; });
