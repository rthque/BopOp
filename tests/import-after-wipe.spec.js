const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, readProject, setAdmin, REPO } = require('./helpers');

// Clearing the site records a date, and anything older stops being data — that
// is what stops a wiped farm coming back from the other phones. But a file of
// last season's work, imported after a wipe, used to land on a map that stayed
// completely empty, and the import reported success.

// The file is written here rather than kept in the repo: what matters is that
// its stamps are OLDER than the wipe, and a fixture with a frozen date would
// stop testing that the day it drifts.
const OLD = '2026-04-15T15:47:00.000Z';
const FILE = path.join(REPO, 'test-results', 'older-than-the-wipe.json');
const TICKS = 4;   // two foundations, two ticks each

function writeFile() {
  const stamp = { at: OLD, by: 'Etienne' };
  const node = (label) => ({
    label,
    status: { 'task-scotchkoat-on-earthing-cable': { ...stamp } },
    micro: { 'task-pick-up-keys': { ...stamp } },
    outer: {},
    statusAt: { 'task-scotchkoat-on-earthing-cable': OLD, 'task-pick-up-keys': OLD },
    reports: { 'rep-survey-in-out': [{ at: OLD, by: 'Etienne' }] },
  });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({
    _schema: 1,
    name: 'Op BOP tre FOU',
    updatedAt: OLD,
    categories: [
      { id: 'task-scotchkoat-on-earthing-cable', name: 'ScotchKoat on earthing cable', color: '#0085AD', updatedAt: OLD },
    ],
    microVars: [
      { id: 'task-pick-up-keys', name: 'Pick up keys', color: '#51B2D1', updatedAt: OLD },
      { id: 'task-brought-by-the-file', name: 'Brought by the file', color: '#B5651D', updatedAt: OLD },
    ],
    outerVars: [],
    reportTypes: [{ id: 'rep-survey-in-out', name: 'Survey In/OUT', updatedAt: OLD }],
    nodes: [node('A02'), node('A03')],
  }));
}

async function wipe(page) {
  await setAdmin(page, true);
  await page.locator('#btn-reset-site').click();
  await page.waitForTimeout(800);
  const at = (await readProject(page)).clearedAt;
  expect(at, 'the wipe has to have happened for this test to mean anything').toBeTruthy();
  return at;
}

const ticks = (p) => p.nodes.filter((n) => !n.substation).reduce((t, n) => t
  + [...Object.values(n.status || {}), ...Object.values(n.micro || {}),
     ...Object.values(n.outer || {})].filter(Boolean).length, 0);

test.beforeAll(writeFile);

test.describe('importing work older than the wipe', () => {
  test('says so, and keeps it when you say yes', async ({ page }) => {
    await login(page, { admin: true });
    page.on('dialog', async (d) => {
      if (d.type() === 'prompt') return d.accept('bop');   // the wipe asks for it
      return d.accept();                                   // merge? keep them? yes
    });
    await wipe(page);

    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);

    const p = await readProject(page);
    expect(ticks(p), 'the file must land whole').toBe(TICKS);
    // the wipe date moved back to just before the oldest imported entry, and no
    // further: work wiped that is older than the file stays wiped
    const cut = new Date(p.clearedAt).getTime();
    expect(cut).toBeLessThan(new Date(OLD).getTime());
    expect(new Date(OLD).getTime() - cut).toBeLessThanOrEqual(1000);
    expect((p.activity || []).some((e) => /wipe date moved back/.test(e.detail))).toBe(true);
  });

  test('leaves it out when you say no, and still brings the task list', async ({ page }) => {
    await login(page, { admin: true });
    let asked = 0;
    page.on('dialog', async (d) => {
      if (d.type() === 'prompt') return d.accept('bop');
      asked += 1;
      // 1 = clear the site, 2 = merge into the existing project, 3 = keep them?
      return asked >= 3 ? d.dismiss() : d.accept();
    });
    const cleared = await wipe(page);

    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);

    const p = await readProject(page);
    expect(ticks(p)).toBe(0);
    expect(p.clearedAt).toBe(cleared);            // the wipe stands
    // the task list is not work, so it arrives either way
    expect(p.microVars.some((t) => t.id === 'task-brought-by-the-file')).toBe(true);
  });

  test('a farm that was never cleared is not asked anything', async ({ page }) => {
    await login(page, { admin: true });
    let asked = 0;
    page.on('dialog', async (d) => { asked += 1; await d.accept(); });
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);
    expect(asked, 'only the merge question').toBe(1);
    expect(ticks(await readProject(page))).toBe(TICKS);
  });
});
