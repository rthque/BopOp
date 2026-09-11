const { test, expect } = require('@playwright/test');
const { login, readProject, writeProject, setAdmin, settle } = require('./helpers');

// Every decision here travels as a date, and the most recent one wins. That
// only works if a new date really is newer — and phone clocks drift. A device
// running ten minutes fast writes dates ten minutes into the future, and every
// legitimate edit made afterwards, on a correct phone, looks OLDER and is thrown
// away. Not for ten minutes: for ever.
//
// `stampAfter` exists for exactly that, and was already used on the ticks. It
// was NOT used on the crew list, the permits, the punch list, the method
// statements, or the headstone that marks a deleted task.

const AHEAD = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

async function fakeDb(page, body) {
  const db = { body, puts: [] };
  await page.route('**/*.firebasedatabase.app/**', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      db.body = JSON.parse(req.postData() || '{}');
      db.puts.push(db.body);
      return route.fulfill({ status: 200, contentType: 'application/json', body: req.postData() });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(db.body) });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  return db;
}

test.describe('a teammate whose clock runs fast', () => {
  test('does not make their task impossible to delete', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    // the task was written by a phone whose clock is ten minutes ahead
    await writeProject(page, "project.categories[0].updatedAt = new Date(Date.now() + 600000).toISOString();");
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);

    const before = await readProject(page);
    const doomed = before.categories[0];

    page.on('dialog', (d) => d.accept());
    await page.locator('#category-list .category-row').first()
      .locator('button[title="Delete task"]').click();
    await page.waitForTimeout(500);

    const after = await readProject(page);
    expect(after.categories.some((c) => c.id === doomed.id), 'gone from the list').toBe(false);
    const headstone = (after.tombstones || {}).tasks[doomed.id];
    expect(headstone, 'a headstone was laid').toBeTruthy();
    // the headstone must outrank the task, or the task walks back in
    expect(new Date(headstone).getTime())
      .toBeGreaterThan(new Date(doomed.updatedAt).getTime());
  });

  test('and the deletion survives the next sync, which is the whole point', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    await writeProject(page, "project.categories[0].updatedAt = new Date(Date.now() + 600000).toISOString();");
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);

    const before = await readProject(page);
    const doomed = before.categories[0];
    // the shared copy still holds the task, stamped in the future
    const remote = JSON.parse(JSON.stringify(before));

    page.on('dialog', (d) => d.accept());
    await page.locator('#category-list .category-row').first()
      .locator('button[title="Delete task"]').click();
    await page.waitForTimeout(500);

    await fakeDb(page, remote);
    await page.waitForTimeout(4000);

    const end = await readProject(page);
    expect(end.categories.some((c) => c.id === doomed.id),
      'it stays deleted instead of coming back a minute later').toBe(false);
    expect((end.overflow || []).some((o) => o.id === doomed.id),
      'and it does not sneak back through the waiting room either').toBe(false);
  });

  test('does not make a method statement impossible to correct', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    // the sheet was last written by the fast phone: its stamp sits in the future
    await writeProject(page, `
      const id = project.categories[0].id;
      const proc = (project.procedures[id] = project.procedures[id] || {});
      proc.sectionUpdated = proc.sectionUpdated || {};
      proc.en = 'Ancienne consigne, fausse.';
      proc.sectionUpdated.en = new Date(Date.now() + 600000).toISOString();
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);

    const was = await readProject(page);
    const id = was.categories[0].id;
    const futureStamp = was.procedures[id].sectionUpdated.en;

    // an admin corrects it here, on a phone whose clock is right
    const row = page.locator('#category-list .category-row').first();
    await row.locator('.cat-proc').click();
    await page.waitForTimeout(600);
    // the Method statement box, found by its heading rather than by its
    // position — a section added above it must not silently retarget this test
    const box = page.locator('#proc-modal details[open] .proc-section')
      .filter({ has: page.locator('h4', { hasText: /Method statement|Mode opératoire/ }) })
      .locator('textarea');
    await box.fill('Consigne corrigée.');
    await box.blur();
    await page.waitForTimeout(500);

    const now = await readProject(page);
    const corrected = now.procedures[id].sectionUpdated.en;
    expect(new Date(corrected).getTime(),
      'the correction is dated after the sheet it replaces, or it loses every merge')
      .toBeGreaterThan(new Date(futureStamp).getTime());
  });
});
