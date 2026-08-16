const { test, expect } = require('@playwright/test');
const { login, readProject, handOver, load, settle } = require('./helpers');

// Two devices, exchanging their whole project through the app's own import —
// which is the very merge the live Firebase sync runs.
test.describe('two devices', () => {
  test('a rename, a recolour, a delete and an order all cross over', async ({ browser }, testInfo) => {
    const a = await browser.newPage();
    const b = await browser.newPage();
    await login(a, { admin: true });
    await login(b, { admin: true });

    // both set themselves up alone: the ids must still agree
    const idsA = (await readProject(a)).categories.map((c) => c.id).sort();
    const idsB = (await readProject(b)).categories.map((c) => c.id).sort();
    expect(idsA).toEqual(idsB);
    expect(idsA[0]).toMatch(/^task-/);

    await a.locator('#category-list .category-row').first().locator('input[type=color]')
      .evaluate((el) => { el.value = '#ff00aa'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const nameInput = a.locator('#category-list .category-row').first().locator('input[type=text]');
    await nameInput.fill('Tower cabinet — REV B');
    await nameInput.dispatchEvent('change');
    await a.locator('#category-list .category-row').nth(2).locator('.cat-move').first().click();
    await a.waitForTimeout(400);

    const doomed = (await readProject(a)).categories.slice(-1)[0];
    a.once('dialog', (d) => d.accept());
    await a.locator('#category-list .category-row').last().locator('button[title="Delete task"]').click();
    await a.waitForTimeout(400);

    const orderA = (await readProject(a)).categories.map((c) => c.name);
    await handOver(a, b, testInfo.outputPath('a.json'));
    const after = await readProject(b);

    expect(after.categories[0].color.toLowerCase()).toBe('#ff00aa');
    expect(after.categories.map((c) => c.name)).toEqual(orderA);
    expect(after.categories.some((c) => c.id === doomed.id), 'a deleted task must not come back').toBe(false);

    // …and the device that held it does not push it back
    await handOver(b, a, testInfo.outputPath('b.json'));
    expect((await readProject(a)).categories.some((c) => c.id === doomed.id)).toBe(false);
    await a.close(); await b.close();
  });

  test('a hand-corrected cable route is not overwritten by a device that never touched it',
    async ({ browser }, testInfo) => {
      const a = await browser.newPage();
      const b = await browser.newPage();
      await login(a, { admin: true });
      await login(b, { admin: true });
      await b.evaluate((k) => {
        const state = JSON.parse(localStorage.getItem(k));
        const p = state.projects[state.activeProjectId];
        p.connections[0].bends = [{ x: 123, y: 456 }];
        p.cablesAt = new Date().toISOString();
        localStorage.setItem(k, JSON.stringify(state));
      }, 'worksite-tracker:v7');
      await b.reload({ waitUntil: 'domcontentloaded' });
    await settle(b);

      await handOver(a, b, testInfo.outputPath('cables.json'));
      const p = await readProject(b);
      expect(p.connections[0].bends[0]).toEqual({ x: 123, y: 456 });
      await a.close(); await b.close();
    });
});

test.describe('taking something back', () => {
  test('an untick sticks, and is not posted back by the other phone',
    async ({ browser }, testInfo) => {
      const a = await browser.newPage();
      const b = await browser.newPage();
      await login(a); await login(b);

      const state = () => a.evaluate((k) => {
        const st = JSON.parse(localStorage.getItem(k));
        const p = st.projects[st.activeProjectId];
        const n = p.nodes.find((x) => !x.substation);
        return !!n.status[p.categories[0].id];
      }, 'worksite-tracker:v7');

      await a.evaluate((k) => {
        const st = JSON.parse(localStorage.getItem(k));
        const p = st.projects[st.activeProjectId];
        const n = p.nodes.find((x) => !x.substation);
        const now = new Date().toISOString();
        n.status[p.categories[0].id] = { at: now, by: 'Quentin' };
        n.statusAt = { ...(n.statusAt || {}), [p.categories[0].id]: now };
        localStorage.setItem(k, JSON.stringify(st));
      }, 'worksite-tracker:v7');
      await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);
      expect(await state()).toBe(true);

      await handOver(a, b, testInfo.outputPath('tick.json'));

      // A unticks it, then B — still holding the tick — syncs in
      await a.evaluate((k) => {
        const st = JSON.parse(localStorage.getItem(k));
        const p = st.projects[st.activeProjectId];
        const n = p.nodes.find((x) => !x.substation);
        n.status[p.categories[0].id] = null;
        n.statusAt[p.categories[0].id] = new Date(Date.now() + 1000).toISOString();
        localStorage.setItem(k, JSON.stringify(st));
      }, 'worksite-tracker:v7');
      await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);
      expect(await state()).toBe(false);

      await handOver(b, a, testInfo.outputPath('back.json'));
      expect(await state(), 'the tick must not come back').toBe(false);
      await a.close(); await b.close();
    });
});

test.describe('clearing the farm', () => {
  test('holds against a phone that still has the old campaign', async ({ browser }, testInfo) => {
    const a = await browser.newPage();
    const b = await browser.newPage();
    await login(a, { admin: true });
    await login(b, { admin: true });

    await a.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const p = st.projects[st.activeProjectId];
      const now = new Date().toISOString();
      p.nodes.slice(0, 10).forEach((n) => {
        if (n.substation) return;
        p.categories.forEach((c) => { n.status[c.id] = { at: now, by: 'Quentin' }; });
        n.note = 'quelque chose';
        n.noteAt = now;
      });
      localStorage.setItem(k, JSON.stringify(st));
    }, 'worksite-tracker:v7');
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);
    expect(load(await readProject(a)).ticks).toBeGreaterThan(0);

    await handOver(a, b, testInfo.outputPath('work.json'));
    expect(load(await readProject(b)).ticks).toBeGreaterThan(0);

    // the spelled-out warning, then the password — and let go of the dialogs
    // afterwards, or the import's own confirm finds two handlers racing for it
    const answer = (d) => d.accept('bop');
    a.on('dialog', answer);
    await a.locator('#btn-reset-site').click();
    await a.waitForTimeout(800);
    a.off('dialog', answer);
    const wiped = load(await readProject(a));
    expect(wiped).toEqual({ ticks: 0, comments: 0, reports: 0, notes: 0, issues: 0 });
    expect((await readProject(a)).clearedAt).toBeTruthy();

    await handOver(b, a, testInfo.outputPath('stale.json'));
    expect(load(await readProject(a)), 'the old campaign must not come back')
      .toEqual({ ticks: 0, comments: 0, reports: 0, notes: 0, issues: 0 });

    await handOver(a, b, testInfo.outputPath('wipe.json'));
    expect(load(await readProject(b)), 'and the wipe must reach the other phone')
      .toEqual({ ticks: 0, comments: 0, reports: 0, notes: 0, issues: 0 });
    await a.close(); await b.close();
  });
});
