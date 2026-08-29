const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, setAdmin, readProject, writeProject, handOver, REPO } = require('./helpers');

// An additional inspection now carries a method statement, read and flagged
// exactly like a task's — same editor, same unread dot, same trail from the
// top bar down to the section that changed.

const writeOnFirstInspection = (text) => `
  const rt = project.reportTypes[0];
  const p = (project.procedures[rt.id] = project.procedures[rt.id] || {});
  p.sectionUpdated = p.sectionUpdated || {};
  p.en = ${JSON.stringify(text)};
  p.sectionUpdated.en = new Date().toISOString();
  p.updatedBy = 'Antonin';
`;

test.describe('method statements on the additional inspections', () => {
  test('every inspection row opens one, and it is the same editor', async ({ page }) => {
    await login(page, { admin: true });
    const rows = page.locator('#reports-list .category-row');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    await expect(page.locator('#reports-list .cat-proc')).toHaveCount(n);

    await rows.first().locator('.cat-proc').click();
    await page.waitForTimeout(400);
    const open = page.locator('#proc-modal details[open]');
    await expect(open).toHaveCount(1);
    // one box, not the four a task has plus a picking list: an inspection is
    // one paragraph, and four headings saying "À compléter…" read as an
    // unfinished app rather than as a short instruction
    await expect(open.locator('.proc-section h4')).toHaveCount(1);
    await expect(open.locator('.proc-section h4')).toContainText(/Method statement|Mode opératoire/i);
    await expect(open.locator('textarea')).toHaveCount(1);
  });

  test('an inspection is not asked how many minutes it takes', async ({ page }) => {
    await login(page, { admin: true });
    // a task is
    await page.locator('#category-list .category-row').first().locator('.cat-proc').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#proc-modal details[open] .proc-effort')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // an inspection is not: the % of work done is built from the ticks on the
    // 62 foundations, and an inspection has none — it is counted in occurrences
    await page.locator('#reports-list .category-row').first().locator('.cat-proc').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#proc-modal details[open] .proc-effort')).toHaveCount(0);
  });

  test('what is written on an inspection is kept, and the dot lights up', async ({ page }) => {
    await login(page, { admin: true });
    await writeProject(page, writeOnFirstInspection('Compter les rambardes.'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    // the row carries the unread mark, and so does the top bar
    const row = page.locator('#reports-list .category-row').first();
    await expect(row.locator('.cat-proc--unread')).toHaveCount(1);
    await expect(page.locator('#btn-drawer-left .proc-badge')).toHaveCount(1);

    // reading the part that changed clears this person's mark — opening the
    // sheet is not enough on its own (see per-section-badge.spec.js)
    await row.locator('.cat-proc').click();
    await page.waitForTimeout(600);
    await expect(page.locator('#proc-modal details[open] textarea').first())
      .toHaveValue('Compter les rambardes.');
    await page.waitForTimeout(1400);
    await page.locator('#proc-close').click();
    await page.waitForTimeout(400);
    await expect(row.locator('.cat-proc--unread')).toHaveCount(0);
  });

  test('an inspection is not offered in the day plan, having nothing to add', async ({ page }) => {
    await login(page, { admin: true });
    await page.locator('#btn-dayplan').click();
    await page.waitForTimeout(400);
    const name = (await readProject(page)).reportTypes[0].name;
    // its instruction is one paragraph — no tools field, no picking list — so
    // there is nothing of it to gather, and a checkbox that adds nothing to
    // the kit list is worse than no checkbox
    await expect(page.locator('#dayplan-select .dayplan-item').filter({ hasText: name }))
      .toHaveCount(0);
    await expect(page.locator('#dayplan-select .dayplan-item').first()).toBeVisible();
  });

  test('an inspection deleted takes its method statement with it', async ({ page }) => {
    await login(page, { admin: true });
    await writeProject(page, writeOnFirstInspection('À supprimer.'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);
    const gone = (await readProject(page)).reportTypes[0].id;

    page.once('dialog', (d) => d.accept());
    await page.locator('#reports-list .category-row').first()
      .locator('button[title="Delete inspection type"]').click();
    await page.waitForTimeout(500);
    const p = await readProject(page);
    expect(p.reportTypes.some((r) => r.id === gone)).toBe(false);
    expect(gone in (p.procedures || {})).toBe(false);
  });

  test('it reaches the other device instead of being dropped on arrival', async ({ browser }) => {
    const tmp = path.join(REPO, 'test-results', 'inspection-proc.json');
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, { admin: true });
    await login(b, { admin: true });
    await writeProject(a, writeOnFirstInspection('Vérifier le SRL avant embarquement.'));
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);

    await handOver(a, b, tmp);
    const p = await readProject(b);
    const id = p.reportTypes[0].id;
    expect((p.procedures[id] || {}).en).toBe('Vérifier le SRL avant embarquement.');
    // and it lights up for the person who has not read it
    await expect(b.locator('#reports-list .category-row').first().locator('.cat-proc--unread'))
      .toHaveCount(1);
  });
});
