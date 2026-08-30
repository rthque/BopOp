const { test, expect } = require('@playwright/test');
const { login, settle, readProject, setAdmin } = require('./helpers');

// Clearing the site records a date, and anything older stops being data — that
// is what stops a wiped farm coming back from the other phones. But a file of
// last season's work, imported after a wipe, used to land on a map that stayed
// completely empty, and the import reported success.

const FILE = '/tmp/claude-0/-home-user-ratiouuur/887f86ca-2cd2-59c7-b448-cd392519f153/scratchpad/BopOp-import-complet-2026-08-30.json';

async function wipe(page) {
  await setAdmin(page, true);
  page.on('dialog', async (d) => {
    if (d.type() === 'prompt') await d.accept('bop'); else await d.accept();
  });
  await page.locator('#btn-reset-site').click();
  await page.waitForTimeout(800);
  expect((await readProject(page)).clearedAt).toBeTruthy();
}

const ticks = (p) => p.nodes.filter((n) => !n.substation).reduce((t, n) => t
  + [...Object.values(n.status || {}), ...Object.values(n.micro || {}),
     ...Object.values(n.outer || {})].filter(Boolean).length, 0);

test.describe('importing work older than the wipe', () => {
  test('says so, and keeps it when you say yes', async ({ page }) => {
    await login(page, { admin: true });
    await wipe(page);                       // the dialog handler accepts everything

    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(3000);

    const p = await readProject(page);
    expect(ticks(p), 'the file must land whole').toBe(1170);
    // the wipe date moved back to just before the oldest imported entry, so
    // the file lands whole — and no further, so anything older stays wiped
    const oldest = Math.min(...p.nodes.flatMap((n) => Object.values(n.statusAt || {}))
      .map((at) => new Date(at).getTime()).filter(Boolean));
    expect(new Date(p.clearedAt).getTime()).toBeLessThan(oldest);
    expect(oldest - new Date(p.clearedAt).getTime()).toBeLessThanOrEqual(1000);
    expect((p.activity || []).some((e) => /wipe date moved back/.test(e.detail))).toBe(true);
  });

  test('leaves it out when you say no, and still brings the task list', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    // accept the wipe and its password, then REFUSE the "keep them?" question
    let asked = 0;
    page.on('dialog', async (d) => {
      asked += 1;
      if (d.type() === 'prompt') return d.accept('bop');
      // 1 = clear the site, 2 = merge into the existing project, 3 = keep them?
      if (asked >= 4) return d.dismiss();
      return d.accept();
    });
    await page.locator('#btn-reset-site').click();
    await page.waitForTimeout(800);
    const cleared = (await readProject(page)).clearedAt;

    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(3000);

    const p = await readProject(page);
    expect(ticks(p)).toBe(0);
    expect(p.clearedAt).toBe(cleared);          // the wipe stands
    // the task list is not work, so it arrives either way
    expect(p.categories).toHaveLength(4);
    expect(p.microVars).toHaveLength(16);
    expect(p.outerVars).toHaveLength(28);
  });

  test('a farm that was never cleared is not asked anything', async ({ page }) => {
    await login(page, { admin: true });
    let asked = 0;
    page.on('dialog', async (d) => { asked += 1; await d.accept(); });
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(3000);
    expect(asked, 'only the merge question').toBe(1);
    expect(ticks(await readProject(page))).toBe(1170);
  });
});
