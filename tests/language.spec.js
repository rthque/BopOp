const { test, expect } = require('@playwright/test');
const { login, settle } = require('./helpers');

// One switch for the whole app. It used to be a toggle buried in the method
// statements window, which meant the instructions could be in French while
// every button around them stayed in English.

test.describe('the language switch', () => {
  test('the flag sits in the top bar and is always reachable', async ({ page }) => {
    await login(page);
    const btn = page.locator('#btn-lang');
    await expect(btn).toBeVisible();
    // it shows the flag of the language you would switch TO
    await expect(btn).toHaveText('🇫🇷');
    await btn.click();
    await page.waitForTimeout(300);
    await expect(btn).toHaveText('🇬🇧');
  });

  test('the whole page follows, and comes back exactly', async ({ page }) => {
    await login(page);
    const heading = page.locator('#panel-left h2').first();
    const before = await heading.textContent();
    expect(before).toMatch(/Tasks/);

    await page.locator('#btn-lang').click();
    await page.waitForTimeout(300);
    await expect(heading).toContainText('Tâches');
    // the heading is upper-cased by CSS; the text itself is not
    await expect(page.locator('#panel-right h2').first()).toContainText('Permis de travail');
    // the counter beside the heading survives the swap
    await expect(page.locator('#cat-count-badge')).toContainText('/56');

    await page.locator('#btn-lang').click();
    await page.waitForTimeout(300);
    expect(await heading.textContent()).toBe(before);
  });

  test('the choice is remembered on this device, and not shared', async ({ page }) => {
    await login(page);
    await page.locator('#btn-lang').click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => localStorage.getItem('worksite-tracker:lang'))).toBe('fr');
    // reading language is a preference of the device, not of the site: it must
    // not travel to the rest of the crew with the record
    const project = await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      return JSON.stringify(st.projects[st.activeProjectId]);
    }, 'worksite-tracker:v7');
    expect(project).not.toContain('"lang"');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.locator('#panel-left h2').first()).toContainText('Tâches');
  });

  test('the method statements follow the same switch, with no second toggle', async ({ page }) => {
    await login(page, { admin: true });
    await expect(page.locator('#proc-lang')).toHaveCount(0);
    await page.locator('#btn-lang').click();          // → French
    await page.waitForTimeout(300);
    await page.locator('#category-list .category-row').first().locator('.cat-proc').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#proc-modal details[open] .proc-section h4').first())
      .toContainText(/Mode opératoire|Communication/);
  });
});
