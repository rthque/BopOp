const { test, expect } = require('@playwright/test');
const { login, stubFirebase, watchForErrors, settle, isolateFonts } = require('./helpers');

test.describe('the front door', () => {
  test('says nothing about the site, the client or the trade', async ({ page }) => {
    await stubFirebase(page);
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    const text = (await page.locator('#login-overlay').innerText()).toLowerCase();
    for (const word of ['bop', 'tréport', 'treport', 'fou', 'éolien', 'wind', 'offshore',
      'punch', 'foundation', 'chantier', 'tracker']) {
      expect(text, `login page leaks "${word}"`).not.toContain(word);
    }
    // an image could give it away just as fast as a word
    await expect(page.locator('#login-overlay img')).toHaveCount(0);
    expect(await page.locator('button.login-name').count()).toBeGreaterThanOrEqual(17);
    await expect(page.locator('#login-visitor')).toHaveCount(1);
  });

  test('a stranger is refused, and the site stays shut', async ({ page }) => {
    await stubFirebase(page);
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('#login-visitor');
    await page.fill('#login-password-input', 'nope');
    await page.click('#login-password-form button[type=submit]');
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-overlay')).not.toHaveClass(/hidden/);
  });

  test('"bop" lets a technician in, and the long word is what goes on the wire', async ({ page }) => {
    const sent = [];
    await isolateFonts(page);
    await page.route('**/identitytoolkit.googleapis.com/**', (route) => {
      try { sent.push(JSON.parse(route.request().postData() || '{}')); } catch { /* ignore */ }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ idToken: 'tok', refreshToken: 'ref', expiresIn: '3600' }),
      });
    });
    await page.route('**/*.firebasedatabase.app/**', (route) => route.abort('failed'));
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('button.login-name:has-text("Quentin")');
    await page.fill('#login-password-input', 'bop');
    await page.click('#login-password-form button[type=submit]');
    await page.locator('#login-overlay').waitFor({ state: 'hidden' });

    await expect(page.locator('#user-chip')).toContainText('Quentin');
    expect(sent.map((b) => b.password)).toContain('BOPBOP');
    expect(sent.map((b) => b.password)).not.toContain('bop');
  });

  test('Visitor goes through the same door and stays read-only', async ({ page }) => {
    const errs = []; watchForErrors(page, errs);
    await login(page, { name: 'Visitor' });
    await expect(page.locator('#login-overlay')).toHaveClass(/hidden/);
    // no rename field anywhere: configuration is closed to a visitor
    await expect(page.locator('#category-list input[type=text]')).toHaveCount(0);
    expect(errs).toEqual([]);
  });
});
