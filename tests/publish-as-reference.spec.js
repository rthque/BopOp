const { test, expect } = require('@playwright/test');
const { login, readProject, setAdmin, settle, isolateFonts } = require('./helpers');

// The ordinary push merges the server's copy in first, so a PUT never erases a
// teammate's work. That is right almost always — and exactly wrong when the
// shared copy is the broken one: the mistake is merged straight back in and the
// device that is right never wins.

// A stand-in for the team database: it answers what it holds, and records what
// it is given.
async function fakeDb(page, initial) {
  const state = { body: initial, puts: [] };
  await page.route('**/*.firebasedatabase.app/**', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      const sent = JSON.parse(req.postData() || '{}');
      state.puts.push(sent);
      state.body = sent;
      return route.fulfill({ status: 200, contentType: 'application/json', body: req.postData() });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(state.body) });
  });
  return state;
}

const ticks = (p) => (p.nodes || []).filter((n) => !n.substation).reduce((t, n) => t
  + [...Object.values(n.status || {}), ...Object.values(n.micro || {}),
     ...Object.values(n.outer || {})].filter(Boolean).length, 0);

test.describe('making this device the reference', () => {
  test('sends what is here as it is, without taking the server copy back in', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    // this device has work on it
    const mine = await readProject(page);
    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const p = st.projects[st.activeProjectId];
      const now = new Date().toISOString();
      p.nodes.filter((n) => !n.substation).slice(0, 10).forEach((n) => {
        p.categories.forEach((c) => { n.status[c.id] = { at: now, by: 'Quentin' }; });
        n.statusAt = Object.fromEntries(p.categories.map((c) => [c.id, now]));
      });
      localStorage.setItem(k, JSON.stringify(st));
    }, 'worksite-tracker:v7');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await setAdmin(page, true);
    const before = await readProject(page);
    expect(ticks(before)).toBe(40);

    // the shared copy is the broken one: same project, nothing done
    const empty = JSON.parse(JSON.stringify(before));
    empty.nodes.forEach((n) => { n.status = {}; n.micro = {}; n.outer = {}; n.statusAt = {}; });
    const db = await fakeDb(page, empty);

    page.on('dialog', async (d) => d.accept());
    await page.locator('#btn-publish-all').click();
    await page.waitForTimeout(1200);

    expect(db.puts.length, 'it has to have been sent').toBeGreaterThan(0);
    const sent = db.puts[db.puts.length - 1];
    expect(ticks(sent), 'and sent whole, not merged with the empty copy').toBe(40);
    // and it is on record who did it
    const after = await readProject(page);
    expect((after.activity || []).some((e) => /published as the reference/.test(e.detail))).toBe(true);
  });

  test('asks first, and does nothing if the answer is no', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    const db = await fakeDb(page, { nodes: [] });
    page.on('dialog', async (d) => {
      expect(d.message()).toMatch(/reference/i);
      await d.dismiss();
    });
    await page.locator('#btn-publish-all').click();
    await page.waitForTimeout(800);
    expect(db.puts).toHaveLength(0);
  });

  test('a technician is not offered it', async ({ page }) => {
    await login(page);                       // no admin mode
    await expect(page.locator('#btn-publish-all')).toBeHidden();
  });
});
