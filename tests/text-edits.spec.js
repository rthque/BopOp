const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, setAdmin, readProject, writeProject, handOver, REPO } = require('./helpers');

// A free-text field edited by an admin has to survive the trip to the other
// devices — including when the edit makes the text SHORTER. The merge used to
// keep whichever side was longer, which cannot express "I deleted that line":
// the other phone posted the old paragraph straight back.

const tmp = path.join(REPO, 'test-results', 'text-edits.json');

async function twoDevices(browser) {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await login(a, { admin: true });
  await login(b, { admin: true });
  return { a, b };
}

test.describe('an edit that shortens the text', () => {
  test('the SRCC access rules keep what the admin last wrote', async ({ browser }) => {
    const { a, b } = await twoDevices(browser);
    // both start from the same long text
    await writeProject(a, `
      project.accessRules = 'Ligne 1. Ligne 2. Ligne 3. Une longue consigne d origine.';
      project.updatedAt = new Date(Date.now() - 60000).toISOString();
    `);
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);
    await handOver(a, b, tmp);

    // B trims it — the whole point of an edit nobody could make stick
    await writeProject(b, `
      project.accessRules = 'Ligne 1 seulement.';
      project.accessRulesAt = new Date().toISOString();
      project.updatedAt = new Date().toISOString();
    `);
    await b.reload({ waitUntil: 'domcontentloaded' });
    await settle(b);

    await handOver(a, b, tmp);   // A hands its older, longer copy back
    expect((await readProject(b)).accessRules).toBe('Ligne 1 seulement.');
  });

  test('typing in the box is enough — it stamps itself', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    const box = page.locator('#string-rules-body textarea');
    await box.fill('Consigne raccourcie.');
    await box.blur();
    await page.waitForTimeout(300);
    const p = await readProject(page);
    expect(p.accessRules).toBe('Consigne raccourcie.');
    expect(p.accessRulesAt, 'the edit carries a date, or it cannot win a merge').toBeTruthy();
  });

  test('a paragraph deleted from a method statement stays deleted', async ({ browser }) => {
    const { a, b } = await twoDevices(browser);
    await writeProject(a, `
      const id = project.categories[0].id;
      const p = (project.procedures[id] = project.procedures[id] || {});
      p.sectionUpdated = p.sectionUpdated || {};
      p.en = 'Étape 1. Étape 2. Étape 3 qui va être retirée.';
      p.sectionUpdated.en = new Date(Date.now() - 60000).toISOString();
    `);
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);
    await handOver(a, b, tmp);

    await writeProject(b, `
      const id = project.categories[0].id;
      const p = project.procedures[id];
      p.en = 'Étape 1. Étape 2.';
      p.sectionUpdated.en = new Date().toISOString();
      project.updatedAt = new Date().toISOString();
    `);
    await b.reload({ waitUntil: 'domcontentloaded' });
    await settle(b);

    await handOver(a, b, tmp);
    const p = await readProject(b);
    expect(p.procedures[p.categories[0].id].en).toBe('Étape 1. Étape 2.');
  });
});
