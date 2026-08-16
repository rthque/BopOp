const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, readProject, REPO, STORE } = require('./helpers');

// The wall board of 19/07/26, transcribed once and frozen in the repository.
// These numbers were read off the photograph; if a change to the data model ever
// makes the app read this file differently, this is what says so — before a
// season of ticks is quietly reinterpreted.
const FIXTURE = path.join(REPO, 'data', 'tableau-19-07-26.json');
const EXPECTED = [
  ['Scotch Kote', 24], ['Hand rail bolts', 6], ['Rubber cabinet', 56],
  ['Sacrificial parts', 2], ['Casse coeur', 22], ['Cable tray bracket', 28],
  ['Rust in steel', 0], ['Earthing cable', 1],
  ['Cable cleats', 48], ['PIN gate', 35], ['Grating repair', 22],
  ['Protection aeration & ladder', 14], ["Don't sit here / hang off deck", 0],
  ['Rubber external ladder', 4], ['Guano cleaning', 7],
  ['Guano cleaning external - boat landing', 1],
];
const TOTAL_TICKS = EXPECTED.reduce((n, [, c]) => n + c, 0); // 270

async function importFixture(page) {
  page.once('dialog', (d) => d.accept());   // "merge into the existing project?"
  await page.setInputFiles('#file-import', FIXTURE);
  await page.waitForTimeout(1500);
}

test.describe('the frozen record', () => {
  test('reads back exactly the same ticks, on screen', async ({ page }) => {
    await login(page);
    await importFixture(page);

    // 1. the task list, read off the panel the crew actually looks at
    const rows = page.locator('#category-list .category-row, #micro-list .category-row, #outer-list .category-row');
    await expect(rows).toHaveCount(EXPECTED.length);
    for (const [name, count] of EXPECTED) {
      const row = rows.filter({ hasText: name }).first();
      await expect(row, `${name} is on screen`).toHaveCount(1);
      await expect(row, `${name} reads ${count}/62`).toContainText(`${count}/62`);
      await expect(row).toContainText('%');
    }

    // 2. the map: every painted cell, counted
    const painted = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.node-wedge[data-kind^="wedge-"], .node-ring-cell')];
      const blank = getComputedStyle(document.body).getPropertyValue('--panel').trim();
      const asRgb = (v) => { const d = document.createElement('div'); d.style.color = v;
        document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      const empty = asRgb(blank);
      return cells.filter((c) => getComputedStyle(c).fill !== empty).length;
    });
    expect(painted, 'coloured cells on the map').toBe(TOTAL_TICKS);

    // 3. one foundation opened, read the way a tech reads it — reached through
    // "foundations left", which is how anyone would actually find L05
    await page.locator('#category-list .category-row').filter({ hasText: 'Scotch Kote' })
      .first().locator('.cat-todo').click();
    await page.locator('#todo-tabs .todo-tab').nth(1).click();      // already done
    await page.locator('#todo-grid .todo-chip', { hasText: 'L05' }).click();
    await expect(page.locator('#modal-label')).toHaveValue('L05');
    const done = await page.locator('#modal-categories .modal-category-row')
      .filter({ has: page.locator('.seg-btn.active[data-state="done"]') })
      .allInnerTexts();
    const names = done.map((t) => t.split('\n')[0].trim());
    expect(names.sort()).toEqual(
      ['Cable tray bracket', 'Casse coeur', 'Rubber cabinet', 'Scotch Kote'].sort(),
    );
  });

  test('and the punch list and map notes come with it', async ({ page }) => {
    await login(page);
    await importFixture(page);
    const p = await readProject(page);
    expect(p.punchList.filter((x) => !x.deleted)).toHaveLength(22);
    expect(p.annotations.filter((a) => !a.deleted)).toHaveLength(10);
  });
});

test.describe('the version of what is stored', () => {
  test('a record with no version is stamped with the current one', async ({ page }) => {
    await login(page);
    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      delete st.schema;                       // as written by every build before this one
      localStorage.setItem(k, JSON.stringify(st));
    }, STORE);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    const schema = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).schema, STORE);
    expect(schema).toBe(1);
  });

  test('a record from a NEWER app is left alone, not guessed at', async ({ page }) => {
    await login(page);
    const label = await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const pr = st.projects[st.activeProjectId];
      const n = pr.nodes.find((x) => !x.substation);
      const now = new Date().toISOString();
      n.status[pr.categories[0].id] = { at: now, by: 'Quentin' };
      n.statusAt = { ...(n.statusAt || {}), [pr.categories[0].id]: now };
      st.schema = 99;
      localStorage.setItem(k, JSON.stringify(st));
      return n.label;
    }, STORE);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    const after = await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const pr = st.projects[st.activeProjectId];
      const n = pr.nodes.find((x) => !x.substation);
      return { schema: st.schema, ticked: !!n.status[pr.categories[0].id] };
    }, STORE);
    expect(after.schema, 'the version is not walked backwards').toBe(99);
    expect(after.ticked, `${label} keeps its tick`).toBe(true);
  });

  test('an exported file says which shape it was written in', async ({ page }) => {
    await login(page);
    const download = page.waitForEvent('download');
    await page.click('#btn-export');
    const file = await download;
    const fs = require('fs');
    const body = JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
    expect(body._schema).toBe(1);
    expect(Array.isArray(body.nodes)).toBe(true);
  });
});
