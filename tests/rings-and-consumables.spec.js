const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, readProject, writeProject, handOver, settle, setAdmin, REPO } = require('./helpers');

// Two bugs reported from the boat, both of which look like "the app ignores me".
// Neither was a missing feature: one refusal was invisible, one deletion could
// not be expressed.

test.describe('moving a task between rings', () => {
  test('a task comes back from the second ring to the first', async ({ page }) => {
    await login(page, { admin: true });
    await writeProject(page, `
      project.outerVars.push({ id: 'probe-outer', name: 'PROBE',
        color: '#ff0000', updatedAt: new Date().toISOString() });
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);

    await page.locator('#outer-list .category-row').first().locator('.cat-tier-select')
      .selectOption('microVars');
    await page.waitForTimeout(400);

    const p = await readProject(page);
    expect(p.microVars.some((i) => i.id === 'probe-outer')).toBe(true);
    expect(p.outerVars.some((i) => i.id === 'probe-outer')).toBe(false);
  });

  test('a full ring says so on the option instead of refusing after the fact', async ({ page }) => {
    await login(page, { admin: true });
    await writeProject(page, `
      while (project.microVars.length < 16) {
        project.microVars.push({ id: 'fill-' + project.microVars.length,
          name: 'Fill ' + project.microVars.length, color: '#888888',
          updatedAt: new Date().toISOString() });
      }
      project.outerVars.push({ id: 'probe-outer', name: 'PROBE',
        color: '#ff0000', updatedAt: new Date().toISOString() });
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);

    const sel = page.locator('#outer-list .category-row').first().locator('.cat-tier-select');
    const first = sel.locator('option[value="microVars"]');
    // the count is on the option, and the ring cannot be picked while it is full
    await expect(first).toHaveText(/16\/16/);
    await expect(first).toHaveText(/full/);
    await expect(first).toBeDisabled();
    // the centre has room, so it stays pickable and shows how much
    await expect(sel.locator('option[value="categories"]')).toHaveText(/\(\d+\/8\)/);
    await expect(sel.locator('option[value="categories"]')).toBeEnabled();
  });
});

test.describe('consumables in a method statement', () => {
  const tmp = path.join(REPO, 'test-results', 'consumables.json');

  // Both devices start from the same two-line picking list. One of them edits
  // it. The other one must not undo that edit by handing back what it still has.
  async function twoDevicesSharingAList(browser) {
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, { admin: true });
    await login(b, { admin: true });
    await writeProject(a, `
      const id = project.categories[0].id;
      const p = (project.procedures[id] = project.procedures[id] || {});
      p.sectionUpdated = p.sectionUpdated || {};
      p.consumables = [{ name: 'Scotch Kote', restock: true }, { name: 'Chiffon', restock: false }];
      p.sectionUpdated.consumables = new Date(Date.now() - 60000).toISOString();
      project.updatedAt = new Date(Date.now() - 60000).toISOString();
    `);
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);
    await handOver(a, b, tmp);
    const id = (await readProject(b)).categories[0].id;
    return { a, b, id };
  }

  const names = (project, id) => ((project.procedures[id] || {}).consumables || []).map((c) => c.name);

  test('a deleted consumable stays deleted', async ({ browser }) => {
    const { a, b, id } = await twoDevicesSharingAList(browser);
    await writeProject(b, `
      const id = project.categories[0].id;
      const p = project.procedures[id];
      p.consumables = [{ name: 'Chiffon', restock: false }];
      p.sectionUpdated.consumables = new Date().toISOString();
      project.updatedAt = new Date().toISOString();
    `);
    await b.reload({ waitUntil: 'domcontentloaded' });
    await settle(b);

    await handOver(a, b, tmp);          // the other device syncs its older copy back
    expect(names(await readProject(b), id)).toEqual(['Chiffon']);
  });

  test('a renamed consumable does not leave its old name behind', async ({ browser }) => {
    const { a, b, id } = await twoDevicesSharingAList(browser);
    await writeProject(b, `
      const id = project.categories[0].id;
      const p = project.procedures[id];
      p.consumables = [{ name: 'Scotch Kote 2', restock: true }, { name: 'Chiffon', restock: false }];
      p.sectionUpdated.consumables = new Date().toISOString();
      project.updatedAt = new Date().toISOString();
    `);
    await b.reload({ waitUntil: 'domcontentloaded' });
    await settle(b);

    await handOver(a, b, tmp);
    expect(names(await readProject(b), id)).toEqual(['Scotch Kote 2', 'Chiffon']);
  });

  test('the device that did not edit the list still receives the newer one', async ({ browser }) => {
    const { a, b, id } = await twoDevicesSharingAList(browser);
    await writeProject(b, `
      const id = project.categories[0].id;
      const p = project.procedures[id];
      p.consumables = [{ name: 'Colson', restock: true }];
      p.sectionUpdated.consumables = new Date().toISOString();
      project.updatedAt = new Date().toISOString();
    `);
    await b.reload({ waitUntil: 'domcontentloaded' });
    await settle(b);

    await handOver(b, a, tmp);          // now the newer list travels the other way
    expect(names(await readProject(a), id)).toEqual(['Colson']);
  });
});
