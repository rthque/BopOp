const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, readProject, setAdmin, REPO } = require('./helpers');

// The one that matters: a season of work, imported onto a device whose team
// database is in the state that broke everything — cleared, and holding the old
// task list. Every earlier fix passed its own test and still failed here,
// because nothing walked the whole path with the sync running.

const OLD = '2026-06-01T10:00:00.000Z';
const FILE = path.join(REPO, 'test-results', 'a-whole-season.json');
const FOUS = ['A02','A03','A04','B02','B03','B04','C02','C03','C04','D03','D04','D05'];
const N_MICRO = 12;
const N_OUTER = 20;
const PER_FOU = 4 + N_MICRO + N_OUTER;

function writeFile() {
  const mk = (id, name, colour, hidden) => Object.assign(
    { id, name, color: colour, updatedAt: OLD }, hidden ? { hidden: true } : {},
  );
  const cats = ['task-tower-cabinet-rust-treatment-rubber-placement', 'task-scotchkoat-on-earthing-cable',
    'task-grating-repair-with-g8-resin', 'task-installed-cable-tray-brackets']
    .map((id, i) => mk(id, `Centre ${i}`, '#274A72'));
  const micro = Array.from({ length: N_MICRO }, (_, i) => mk(`task-m-${i}`, `Micro ${i}`, '#17A398'));
  // half the second ring is archived work, as the real file has
  const outer = Array.from({ length: N_OUTER }, (_, i) => mk(`task-o-${i}`, `Outer ${i}`, '#B5651D', i >= 10));
  const stamp = { at: OLD, by: 'Etienne' };
  const fill = (list) => Object.fromEntries(list.map((t) => [t.id, { ...stamp }]));
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({
    _schema: 1, name: 'Op BOP tre FOU', updatedAt: OLD,
    categories: cats, microVars: micro, outerVars: outer,
    reportTypes: [{ id: 'rep-survey-in-out', name: 'Survey In/OUT', updatedAt: OLD }],
    nodes: FOUS.map((label) => ({
      label,
      status: fill(cats), micro: fill(micro), outer: fill(outer),
      statusAt: Object.fromEntries([...cats, ...micro, ...outer].map((t) => [t.id, OLD])),
      reports: { 'rep-survey-in-out': [{ at: OLD, by: 'Etienne' }] },
    })),
  }));
}

const stats = (p) => {
  const fous = (p.nodes || []).filter((n) => !n.substation);
  const of = (n) => [...Object.values(n.status || {}), ...Object.values(n.micro || {}),
    ...Object.values(n.outer || {})].filter(Boolean);
  return {
    tasks: (p.categories || []).length + (p.microVars || []).length + (p.outerVars || []).length,
    fous: fous.length,
    ticks: fous.reduce((a, n) => a + of(n).length, 0),
    touched: fous.filter((n) => of(n).length).length,
    reports: (p.nodes || []).reduce((a, n) => a
      + Object.values(n.reports || {}).reduce((s, e) => s + e.length, 0), 0),
  };
};

test.beforeAll(writeFile);

test('a season imported onto a cleared device survives the team database', async ({ page }) => {
  await login(page, { admin: true });
  await setAdmin(page, true);

  // the shared copy is the broken one: cleared, and none of the work
  const seed = await readProject(page);
  const broken = JSON.parse(JSON.stringify(seed));
  broken.clearedAt = new Date().toISOString();
  broken.nodes.forEach((n) => {
    n.status = {}; n.micro = {}; n.outer = {}; n.statusAt = {}; n.reports = {};
  });
  const db = { body: broken, puts: [] };
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

  // 1. import, choosing REPLACE
  let asked = 0;
  page.on('dialog', async (d) => { asked += 1; return asked === 1 ? d.dismiss() : d.accept(); });
  await page.setInputFiles('#file-import', FILE);
  await page.waitForTimeout(1800);
  expect(stats(await readProject(page)).ticks).toBe(FOUS.length * PER_FOU);

  // 2. tell the team database that this device is the one to follow
  page.removeAllListeners('dialog');
  page.on('dialog', async (d) => d.accept());
  await page.locator('#btn-publish-all').click();
  await page.waitForTimeout(1200);
  expect(db.puts.length).toBeGreaterThan(0);

  // 3. and now let the sync run — this is where every earlier attempt was undone
  await page.waitForTimeout(9000);

  const end = stats(await readProject(page));
  expect(end.ticks, 'the work is still on the map').toBe(FOUS.length * PER_FOU);
  expect(end.touched).toBe(FOUS.length);
  expect(end.reports).toBe(FOUS.length);
  // every task the file brought is there. The count can be higher: the shared
  // copy legitimately held tasks of its own, and a sync adds them — that is a
  // merge doing its job, not something going wrong.
  const p2 = await readProject(page);
  const have = new Set([...p2.categories, ...p2.microVars, ...p2.outerVars].map((t) => t.id));
  for (let i = 0; i < N_MICRO; i += 1) expect(have.has(`task-m-${i}`)).toBe(true);
  for (let i = 0; i < N_OUTER; i += 1) expect(have.has(`task-o-${i}`)).toBe(true);
  expect(end.tasks).toBeGreaterThanOrEqual(4 + N_MICRO + N_OUTER);
  // and the shared copy now says the same thing
  expect(stats(db.body).ticks, 'the team database agrees').toBe(FOUS.length * PER_FOU);
});
