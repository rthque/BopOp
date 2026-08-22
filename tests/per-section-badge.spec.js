const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, readProject, writeProject, handOver, REPO } = require('./helpers');

// The mark goes where the change is, and it goes out for one person at a time.
// Opening an instruction is not reading it: someone who opens a sheet, reads
// the top and closes it has not read the PPE, and telling them they have is
// how a changed instruction gets missed on a boat.

// Antonin edits one part of the first task's method statement, an hour ago.
const editOnePart = (key, text, agoMs = 3600000) => `
  const id = project.categories[0].id;
  const p = (project.procedures[id] = project.procedures[id] || {});
  p.sectionUpdated = p.sectionUpdated || {};
  p.${key} = ${JSON.stringify(text)};
  p.sectionUpdated.${key} = new Date(Date.now() - ${agoMs}).toISOString();
  p.updatedBy = 'Antonin';
`;

// An admin's row carries a rename field, so the instruction is opened by its
// icon. A tech's row has no field in the way, so the whole strip is the target
// and the icon is only the sign — which is why it is aria-hidden there.
const openFirstProcedure = async (page) => {
  const row = page.locator('#category-list .category-row').first();
  const isAdminRow = await row.locator('input[type=text]').count() > 0;
  if (isAdminRow) await row.locator('.cat-proc').click();
  else await row.click();
  await page.waitForTimeout(500);
};

test.describe('the mark lands on the part that changed', () => {
  test('only the edited part is marked, not the whole sheet', async ({ page }) => {
    await login(page);
    await writeProject(page, editOnePart('ppe_en', 'Harnais obligatoire.'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirstProcedure(page);

    const open = page.locator('#proc-modal details[open]');
    const marked = open.locator('.proc-section--unread');
    await expect(marked).toHaveCount(1);
    await expect(marked.locator('h4')).toContainText(/PPE/i);
  });

  test('opening the sheet is not reading it', async ({ page }) => {
    await login(page);
    // a long method statement, so the PPE below it is off screen on open
    await writeProject(page, editOnePart('ppe_en', 'Harnais obligatoire.') + `
      p.en = new Array(60).fill('Une étape du mode opératoire.').join('\\n');
      p.sectionUpdated.en = new Date(Date.now() - 7200000).toISOString();
    `);
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirstProcedure(page);
    await page.waitForTimeout(1400);

    // the reader never scrolled down to the PPE, so its mark is still lit —
    // and so is the row behind, and the counter in the top bar
    const p = await readProject(page);
    const seen = ((p.procSeenParts || {}).Quentin || {})[p.categories[0].id] || {};
    expect('ppe_en' in seen).toBe(false);
    const stillMarked = page.locator('#proc-modal details[open] .proc-section--unread');
    await expect(stillMarked.locator('h4').filter({ hasText: /PPE/i })).toHaveCount(1);
  });

  test('the mark goes out once that part has been in front of you', async ({ page }) => {
    await login(page);
    await writeProject(page, editOnePart('ppe_en', 'Harnais obligatoire.'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirstProcedure(page);
    await page.waitForTimeout(1400);          // dwell

    const p = await readProject(page);
    const seen = ((p.procSeenParts || {}).Quentin || {})[p.categories[0].id] || {};
    expect('ppe_en' in seen).toBe(true);
    // the whole trail goes quiet: the part, the row, the top bar
    await expect(page.locator('#proc-modal details[open] .proc-section--unread')).toHaveCount(0);
    await expect(page.locator('#category-list .category-row').first().locator('.cat-proc--unread'))
      .toHaveCount(0);
    await expect(page.locator('#btn-drawer-left .proc-badge')).toHaveCount(0);
  });

  test('a second edit lights the same part again', async ({ page }) => {
    await login(page);
    await writeProject(page, editOnePart('ppe_en', 'Harnais obligatoire.'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirstProcedure(page);
    await page.waitForTimeout(1400);
    await page.locator('#proc-close').click();

    // stamped now: an edit dated before the reading is, correctly, already read
    await writeProject(page, editOnePart('ppe_en', 'Harnais + longe double.', 0));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.locator('#category-list .category-row').first().locator('.cat-proc--unread'))
      .toHaveCount(1);
  });

  test('what one tech has read does not put out the mark for another', async ({ browser }) => {
    const tmp = path.join(REPO, 'test-results', 'per-section.json');
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, { name: 'Quentin' });
    await login(b, { name: 'Yohan' });

    await writeProject(a, editOnePart('ppe_en', 'Harnais obligatoire.'));
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);
    await openFirstProcedure(a);
    await a.waitForTimeout(1400);
    await a.locator('#proc-close').click();
    await a.waitForTimeout(300);

    // Quentin's reading travels to Yohan's device — as a record of what
    // QUENTIN read. Yohan still has it to read.
    await handOver(a, b, tmp);
    const p = await readProject(b);
    expect('ppe_en' in (((p.procSeenParts || {}).Quentin || {})[p.categories[0].id] || {})).toBe(true);
    expect((p.procSeenParts || {}).Yohan).toBeFalsy();
    await expect(b.locator('#category-list .category-row').first().locator('.cat-proc--unread'))
      .toHaveCount(1);
  });

  test('the admin who writes a part is not told about their own edit', async ({ page }) => {
    await login(page, { admin: true });
    await openFirstProcedure(page);
    const open = page.locator('#proc-modal details[open]');
    await open.locator('textarea').nth(3).fill('EPI: harnais.');   // PPE
    await open.locator('textarea').nth(3).blur();
    await page.waitForTimeout(500);

    // their own edit is theirs; but it is unread for everybody else
    await expect(page.locator('#category-list .category-row').first().locator('.cat-proc--unread'))
      .toHaveCount(0);
    const p = await readProject(page);
    expect('ppe_en' in (((p.procSeenParts || {}).Quentin || {})[p.categories[0].id] || {})).toBe(true);
  });
});
