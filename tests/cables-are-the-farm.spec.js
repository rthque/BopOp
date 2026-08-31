const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, readProject, writeProject, setAdmin, settle, REPO } = require('./helpers');

// The routing between the 62 foundations is how the site is BUILT, not what was
// done on it. There is no way in the app to remove a cable — the map editor was
// taken out for that very reason — so a farm holding none has lost them to
// something else: an import that never mentioned them, most likely.

const OLD = '2026-06-01T10:00:00.000Z';
const FILE = path.join(REPO, 'test-results', 'no-cables-in-here.json');

function writeFileWithoutCables() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({
    _schema: 1, name: 'Op BOP tre FOU', updatedAt: OLD,
    categories: [{ id: 'task-scotchkoat-on-earthing-cable', name: 'ScotchKoat on earthing cable', color: '#0085AD', updatedAt: OLD }],
    microVars: [], outerVars: [],
    reportTypes: [{ id: 'rep-survey-in-out', name: 'Survey In/OUT', updatedAt: OLD }],
    nodes: [{ label: 'A02', status: {}, micro: {}, outer: {}, statusAt: {}, reports: {} }],
    // no connections, no strings: the file says nothing about the cables
  }));
}

test.beforeAll(writeFileWithoutCables);

test.describe('the cable layout', () => {
  test('a file that says nothing about the cables does not erase them', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    const before = await readProject(page);
    expect(before.connections.length).toBeGreaterThan(0);
    const had = before.connections.length;

    // mark a string SRCC, so we can see whether that survives too
    await writeProject(page, 'project.strings[2].srcc = true;');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);

    let asked = 0;
    page.on('dialog', async (d) => { asked += 1; return asked === 1 ? d.dismiss() : d.accept(); });
    await page.setInputFiles('#file-import', FILE);   // REPLACE
    await page.waitForTimeout(1500);

    const after = await readProject(page);
    expect(after.connections, 'the cables are still there').toHaveLength(had);
    expect(after.strings[2].srcc, 'and so is the SRCC flag').toBe(true);
    // and the map draws them
    expect(await page.locator('#canvas [data-conn-id]').count()).toBeGreaterThan(0);
  });

  test('a farm that has lost its cables draws them back', async ({ page }) => {
    await login(page, { admin: true });
    await writeProject(page, 'project.connections = []; project.strings = [];');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    const p = await readProject(page);
    expect(p.connections.length, 'rebuilt from the eight official strings').toBeGreaterThan(0);
    expect(p.strings.length).toBe(8);
    // every segment belongs to a string, so the numbers on the map are right
    p.connections.forEach((c) => {
      expect(typeof c.string).toBe('number');
      expect(c.string).toBeGreaterThanOrEqual(0);
      expect(c.string).toBeLessThan(8);
    });
    // stamped, so the drawing reaches the other devices instead of being
    // overwritten by the empty layout they may still hold
    expect(p.cablesAt).toBeTruthy();
  });

  test('the eight strings are the ones the farm is wired as', async ({ page }) => {
    await login(page);
    const p = await readProject(page);
    const byString = {};
    p.connections.forEach((c) => { byString[c.string] = (byString[c.string] || 0) + 1; });
    expect(Object.keys(byString)).toHaveLength(8);
    // each string is a chain, so it has at least one segment
    Object.values(byString).forEach((n) => expect(n).toBeGreaterThan(0));
    // and every endpoint is a real foundation of this farm
    const ids = new Set(p.nodes.map((n) => n.id));
    p.connections.forEach((c) => {
      expect(ids.has(c.a)).toBe(true);
      expect(ids.has(c.b)).toBe(true);
    });
  });
});
