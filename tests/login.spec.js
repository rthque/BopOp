const { test, expect } = require('@playwright/test');
const { login, stubFirebase, watchForErrors, settle, isolateFonts, CREW_WORD } = require('./helpers');

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

  test('the crew word lets a technician in, and the account word goes on the wire', async ({ page }) => {
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
    await page.fill('#login-password-input', CREW_WORD);
    await page.click('#login-password-form button[type=submit]');
    await page.locator('#login-overlay').waitFor({ state: 'hidden' });

    await expect(page.locator('#user-chip')).toContainText('Quentin');
    // what the database is asked for is the ACCOUNT's word, not the one typed
    expect(sent.map((b) => b.password)).toContain('BOPBOP');
    expect(sent.map((b) => b.password)).not.toContain(CREW_WORD);
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

// Changing the word on the door only means something if the old one stops
// working AND the phones already inside are asked again. Either half missing
// and the change is decorative.
test.describe('the word on the door has changed', () => {
  const tryWord = async (page, word) => {
    await stubFirebase(page, { accepts: 'BOPBOP' });
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('button.login-name:has-text("Quentin")');
    await page.fill('#login-password-input', word);
    await page.click('#login-password-form button[type=submit]');
    await page.waitForTimeout(800);
    return page.locator('#login-overlay').isVisible();
  };

  for (const old of ['bop', 'BOP', 'bopbop', 'BOPBOP']) {
    test(`"${old}" no longer opens it`, async ({ page }) => {
      expect(await tryWord(page, old), 'the old word is refused').toBe(true);
      await expect(page.locator('#login-error')).toBeVisible();
    });
  }

  test('the new word is taken exactly, case and all', async ({ page }) => {
    expect(await tryWord(page, CREW_WORD.toLowerCase()),
      'lower-cased is a different word').toBe(true);
    expect(await tryWord(page, CREW_WORD), 'typed exactly, it opens').toBe(false);
  });

  test('a phone signed in under the old word is asked again', async ({ page }) => {
    await login(page);
    await expect(page.locator('#login-overlay')).toHaveClass(/hidden/);

    // put the device back the way it was before the change: a session with no
    // door marking on it, exactly what the old app wrote
    await page.evaluate(() => {
      const k = 'worksite-tracker:user';
      const u = JSON.parse(localStorage.getItem(k));
      delete u.door;
      localStorage.setItem(k, JSON.stringify(u));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.locator('#login-overlay'), 'the door is closed again').toBeVisible();
  });

  test('and a visitor is asked for it too — no way round the door', async ({ page }) => {
    await stubFirebase(page);
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('#login-visitor');
    await expect(page.locator('#login-password-input')).toBeVisible();
    await expect(page.locator('#login-overlay')).toBeVisible();
  });
});
