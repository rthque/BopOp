const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, readProject, setAdmin, REPO } = require('./helpers');

// A wipe used to be merged by keeping the LATER of the two dates, which made it
// impossible to undo: the date sat in the team database for ever and came back
// at every sync. Import a season of work after a wipe and the map filled up,
// then emptied itself a minute later.

const OLD = '2026-06-01T10:00:00.000Z';
const FILE = path.join(REPO, 'test-results', 'a-season-of-work.json');
const BACK = path.join(REPO, 'test-results', 'what-the-crew-still-holds.json');
const FOUS = ['A02', 'A03', 'A04'];

function writeFile() {
  const stamp = { at: OLD, by: 'Etienne' };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({
    _schema: 1, name: 'Op BOP tre FOU', updatedAt: OLD,
    categories: [{ id: 'task-scotchkoat-on-earthing-cable', name: 'ScotchKoat on earthing cable', color: '#0085AD', updatedAt: OLD }],
    microVars: [{ id: 'task-pick-up-keys', name: 'Pick up keys', color: '#51B2D1', updatedAt: OLD }],
    outerVars: [],
    reportTypes: [{ id: 'rep-survey-in-out', name: 'Survey In/OUT', updatedAt: OLD }],
    nodes: FOUS.map((label) => ({
      label,
      status: { 'task-scotchkoat-on-earthing-cable': { ...stamp } },
      micro: { 'task-pick-up-keys': { ...stamp } },
      outer: {},
      statusAt: { 'task-scotchkoat-on-earthing-cable': OLD, 'task-pick-up-keys': OLD },
      reports: { 'rep-survey-in-out': [{ at: OLD, by: 'Etienne' }] },
    })),
  }));
}

const ticks = (p) => p.nodes.filter((n) => !n.substation).reduce((t, n) => t
  + [...Object.values(n.status || {}), ...Object.values(n.micro || {}),
     ...Object.values(n.outer || {})].filter(Boolean).length, 0);

// the same project as the one on screen, but still carrying the wipe date and
// none of the work — which is exactly what the other phones send back
function writeWhatTheCrewHolds(project, wipedAt) {
  const remote = JSON.parse(JSON.stringify(project));
  remote.clearedAt = wipedAt;
  delete remote.clearedAtSet;          // their build predates the field
  remote.nodes.forEach((n) => {
    n.status = {}; n.micro = {}; n.outer = {}; n.statusAt = {}; n.reports = {};
  });
  fs.writeFileSync(BACK, JSON.stringify(remote));
}

test.beforeAll(writeFile);

test.describe('work imported after a wipe', () => {
  test('survives the wipe date the rest of the crew still holds', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    page.on('dialog', async (d) => (d.type() === 'prompt' ? d.accept('bop') : d.accept()));
    await page.locator('#btn-reset-site').click();
    await page.waitForTimeout(700);
    const wipedAt = (await readProject(page)).clearedAt;
    expect(wipedAt).toBeTruthy();

    // replace: the file becomes the record
    page.removeAllListeners('dialog');
    let asked = 0;
    page.on('dialog', async (d) => { asked += 1; return asked === 1 ? d.dismiss() : d.accept(); });
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);
    const afterImport = await readProject(page);
    expect(ticks(afterImport)).toBe(FOUS.length * 2);

    // now the rest of the crew syncs back
    writeWhatTheCrewHolds(afterImport, wipedAt);
    page.removeAllListeners('dialog');
    page.on('dialog', async (d) => d.accept());
    await page.setInputFiles('#file-import', BACK);
    await page.waitForTimeout(1500);

    const end = await readProject(page);
    expect(ticks(end), 'the work must still be there').toBe(FOUS.length * 2);
    expect(end.clearedAt, 'and the wipe is off').toBeFalsy();
    expect(end.clearedAtSet, 'taking in the file was a dated decision').toBeTruthy();
  });

  test('a wipe decided AFTER the import still clears the site', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    page.on('dialog', async (d) => d.accept());
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);
    expect(ticks(await readProject(page))).toBe(FOUS.length * 2);

    page.removeAllListeners('dialog');
    page.on('dialog', async (d) => (d.type() === 'prompt' ? d.accept('bop') : d.accept()));
    await page.locator('#btn-reset-site').click();
    await page.waitForTimeout(700);
    const p = await readProject(page);
    expect(ticks(p), 'clearing still clears').toBe(0);
    expect(p.clearedAt).toBeTruthy();
  });

  test('two devices that never heard of the new field behave as before', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    page.on('dialog', async (d) => d.accept());
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);

    // an old device sends a wipe dated after the work, with no decision stamp
    const mine = await readProject(page);
    const remote = JSON.parse(JSON.stringify(mine));
    remote.clearedAt = '2026-07-01T00:00:00.000Z';
    delete remote.clearedAtSet;
    remote.nodes.forEach((n) => { n.status = {}; n.micro = {}; n.outer = {}; n.statusAt = {}; n.reports = {}; });
    fs.writeFileSync(BACK, JSON.stringify(remote));

    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      delete st.projects[st.activeProjectId].clearedAtSet;   // neither side has it
      localStorage.setItem(k, JSON.stringify(st));
    }, 'worksite-tracker:v7');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    page.removeAllListeners('dialog');
    let n = 0;
    // 1 = merge into the existing project: yes. 2 = keep the pre-wipe work: no.
    page.on('dialog', async (d) => { n += 1; return n === 1 ? d.accept() : d.dismiss(); });
    await page.setInputFiles('#file-import', BACK);
    await page.waitForTimeout(1500);
    expect(ticks(await readProject(page)), 'the old rule still applies').toBe(0);
  });
});
