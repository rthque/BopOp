const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, readProject, writeProject, setAdmin, settle, REPO } = require('./helpers');

// A merge can only ADD. A ring already full silently refused the tasks a file
// was trying to bring, and the ticks that belonged to them then had nowhere to
// land — the map came out mostly empty and nothing said why.

const OLD = '2026-06-01T10:00:00.000Z';
const FILE = path.join(REPO, 'test-results', 'replace-me.json');
const NEW_MICRO = 12;      // brought by the file, on top of the four seeded ones
const NEW_OUTER = 20;

function writeFile() {
  const mk = (i, n, c) => ({ id: i, name: n, color: c, updatedAt: OLD });
  const micro = [mk('task-safety-pin-gate', 'Safety pin gate', '#F59E0B')];
  for (let i = 0; i < NEW_MICRO; i += 1) micro.push(mk(`task-m-${i}`, `Micro ${i}`, '#17A398'));
  const outer = [];
  for (let i = 0; i < NEW_OUTER; i += 1) {
    outer.push(Object.assign(mk(`task-o-${i}`, `Outer ${i}`, '#B5651D'), i < 5 ? { hidden: true } : {}));
  }
  const stamp = { at: OLD, by: 'Etienne' };
  const node = (label) => ({
    label,
    status: { 'task-scotchkoat-on-earthing-cable': { ...stamp } },
    micro: Object.fromEntries(micro.map((m) => [m.id, { ...stamp }])),
    outer: Object.fromEntries(outer.map((o) => [o.id, { ...stamp }])),
    statusAt: Object.fromEntries([...micro, ...outer,
      { id: 'task-scotchkoat-on-earthing-cable' }].map((t) => [t.id, OLD])),
    reports: {},
  });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({
    _schema: 1, name: 'Op BOP tre FOU', updatedAt: OLD,
    categories: [mk('task-scotchkoat-on-earthing-cable', 'ScotchKoat on earthing cable', '#0085AD')],
    microVars: micro, outerVars: outer,
    reportTypes: [{ id: 'rep-survey-in-out', name: 'Survey In/OUT', updatedAt: OLD }],
    nodes: ['A02', 'A03', 'A04'].map(node),
  }));
  return { micro: micro.length, outer: outer.length };
}

const counts = (p) => ({
  centre: p.categories.length, micro: p.microVars.length, outer: p.outerVars.length,
  archived: [...p.categories, ...p.microVars, ...p.outerVars].filter((t) => t.hidden).length,
  ticks: p.nodes.filter((n) => !n.substation).reduce((t, n) => t
    + [...Object.values(n.status || {}), ...Object.values(n.micro || {}),
       ...Object.values(n.outer || {})].filter(Boolean).length, 0),
});

test.beforeAll(writeFile);

test.describe('a file that is meant to BE the record', () => {
  test('replacing gives exactly what the file says, whatever was there before', async ({ page }) => {
    await login(page, { admin: true });
    // a project already crowded with other work — the state a merge cannot fix
    await writeProject(page, `
      while (project.microVars.length < 16) {
        project.microVars.push({ id: 'junk-m-' + project.microVars.length,
          name: 'Junk ' + project.microVars.length, color: '#888', updatedAt: new Date().toISOString() });
      }
      while (project.outerVars.length < 32) {
        project.outerVars.push({ id: 'junk-o-' + project.outerVars.length,
          name: 'Junk o' + project.outerVars.length, color: '#888', updatedAt: new Date().toISOString() });
      }
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);
    expect(counts(await readProject(page)).micro).toBe(16);

    // merge? no. replace? yes.
    let asked = 0;
    page.on('dialog', async (d) => { asked += 1; return asked === 1 ? d.dismiss() : d.accept(); });
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);

    const c = counts(await readProject(page));
    expect(c.centre).toBe(1);
    expect(c.micro).toBe(1 + NEW_MICRO);
    expect(c.outer).toBe(NEW_OUTER);
    expect(c.archived).toBe(5);
    // three foundations × (1 centre + 1 seeded micro + NEW_MICRO + NEW_OUTER).
    // The archived ones carry their ticks too — that is the point of archiving
    // rather than deleting.
    expect(c.ticks).toBe(3 * (1 + 1 + NEW_MICRO + NEW_OUTER));
    // the farm is not the file's to decide: a file carrying three foundations
    // leaves the other fifty-nine standing and empty, it does not delete them
    // the project keeps its name, so the team database address is unchanged
    const p = await readProject(page);
    expect(p.name).toBe('Op BOP tre FOU');
    expect(p.nodes.filter((n) => !n.substation)).toHaveLength(62);
  });

  test('a merge that cannot fit everything says so instead of going quiet', async ({ page }) => {
    await login(page, { admin: true });
    await writeProject(page, `
      while (project.microVars.length < 16) {
        project.microVars.push({ id: 'junk-m-' + project.microVars.length,
          name: 'Junk ' + project.microVars.length, color: '#888', updatedAt: new Date().toISOString() });
      }
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    const messages = [];
    page.on('dialog', async (d) => { messages.push(d.message()); await d.accept(); });
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);

    const warned = messages.find((m) => /could NOT be added/.test(m));
    expect(warned, 'the refusal has to be said out loud').toBeTruthy();
    expect(warned).toMatch(/rings are full/);
    const p = await readProject(page);
    expect((p.activity || []).some((e) => /tasks refused/.test(e.detail))).toBe(true);
  });

  test('merging still works when there is room', async ({ page }) => {
    await login(page, { admin: true });
    page.on('dialog', async (d) => d.accept());
    await page.setInputFiles('#file-import', FILE);
    await page.waitForTimeout(1500);
    const c = counts(await readProject(page));
    expect(c.micro).toBe(4 + NEW_MICRO);       // the four seeded ones kept
    expect(c.outer).toBe(NEW_OUTER);
    expect(c.ticks).toBeGreaterThan(90);
  });
});
