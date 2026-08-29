const { test, expect } = require('@playwright/test');
const { login, readProject, watchForErrors, settle } = require('./helpers');

test.describe('the task list and the dial', () => {
  test('holds three rings, 8 + 16 + 32', async ({ page }) => {
    await login(page, { admin: true });
    await expect(page.locator('#cat-count-badge')).toContainText('/56');
    const heads = await page.locator('.tier-head:not(.hidden)').allTextContents();
    expect(heads).toHaveLength(3);
    expect(heads[0]).toMatch(/Centre/);
    expect(heads[1]).toMatch(/First ring/);
    expect(heads[2]).toMatch(/Second ring/);
  });

  test('reordering a task moves its slice, and the ends stop', async ({ page }) => {
    await login(page, { admin: true });
    const before = (await readProject(page)).categories.map((c) => c.name);
    await page.locator('#category-list .category-row').nth(2).locator('.cat-move').first().click();
    await page.waitForTimeout(400);
    const after = (await readProject(page)).categories.map((c) => c.name);
    expect(after[1]).toBe(before[2]);
    expect(after[2]).toBe(before[1]);
    await expect(page.locator('#category-list .category-row').first().locator('.cat-move').first())
      .toBeDisabled();
  });

  test('a task sent to another ring takes its ticks with it', async ({ page }) => {
    await login(page, { admin: true });
    const target = await page.evaluate((k) => {
      const state = JSON.parse(localStorage.getItem(k));
      const p = state.projects[state.activeProjectId];
      const id = p.categories[0].id;
      const node = p.nodes.find((n) => !n.substation);
      node.status[id] = { at: new Date().toISOString(), by: 'Quentin' };
      node.statusAt = { ...(node.statusAt || {}), [id]: new Date().toISOString() };
      localStorage.setItem(k, JSON.stringify(state));
      return { id, label: node.label };
    }, 'worksite-tracker:v7');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    await page.locator('#category-list .category-row').first().locator('.cat-tier-select')
      .selectOption('outerVars');
    await page.waitForTimeout(500);

    const p = await readProject(page);
    expect(p.outerVars.some((i) => i.id === target.id)).toBe(true);
    expect(p.categories.some((i) => i.id === target.id)).toBe(false);
    const node = p.nodes.find((n) => n.label === target.label);
    expect(node.outer[target.id], 'the tick must follow the task').toBeTruthy();
    expect(target.id in node.status).toBe(false);
    // and the ring is now on the map
    expect(await page.locator(`[data-kind="outer-${target.id}"]`).count()).toBeGreaterThan(0);
  });

  test('a full ring refuses the move instead of losing the task', async ({ page }) => {
    await login(page, { admin: true });
    await page.evaluate((k) => {
      const state = JSON.parse(localStorage.getItem(k));
      const p = state.projects[state.activeProjectId];
      while (p.microVars.length < 16) {
        p.microVars.push({ id: `filler-${p.microVars.length}`, name: `Filler ${p.microVars.length}`,
          color: '#888888', updatedAt: new Date().toISOString() });
      }
      localStorage.setItem(k, JSON.stringify(state));
    }, 'worksite-tracker:v7');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    const centreBefore = (await readProject(page)).categories.length;
    const sel = page.locator('#category-list .category-row').first().locator('.cat-tier-select');
    // the menu refuses it up front now, so the refusal is seen before the tap
    await expect(sel.locator('option[value="microVars"]')).toBeDisabled();
    // and it still refuses if the ring filled up on another device while this
    // menu was open — the guard behind the menu is what must not lose the task
    await sel.evaluate((el) => {
      el.value = 'microVars';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    const p = await readProject(page);
    expect(p.microVars).toHaveLength(16);
    expect(p.categories).toHaveLength(centreBefore);
  });

  test('every slice keeps its outline, done or not, and the bands share one line', async ({ page }) => {
    const errs = []; watchForErrors(page, errs);
    await login(page);
    const seen = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.node-wedge[data-kind^="wedge-"], .node-ring-cell')];
      return {
        total: cells.length,
        strokes: [...new Set(cells.map((c) => getComputedStyle(c).stroke))],
        fills: [...new Set(cells.map((c) => getComputedStyle(c).fill))],
      };
    });
    expect(seen.total).toBeGreaterThan(0);
    expect(seen.strokes, 'one outline, on every slice').toHaveLength(1);
    expect(seen.strokes[0]).toMatch(/^rgb/);
    // painted, not transparent: an unpainted slice cannot be tapped with a glove on
    expect(seen.fills).not.toContain('none');
    expect(errs).toEqual([]);
  });

  test('"which foundations are left" counts and follows the work', async ({ page }) => {
    await login(page);
    await page.locator('#category-list .category-row').first().locator('.cat-todo').click();
    await expect(page.locator('#todo-modal')).not.toHaveClass(/hidden/);
    let tabs = await page.locator('#todo-tabs .todo-tab').allTextContents();
    expect(tabs[0]).toMatch(/Left to do \(62\)/);
    expect(tabs[1]).toMatch(/Already done \(0\)/);
    await expect(page.locator('#todo-grid .todo-chip')).toHaveCount(62);

    const first = await page.locator('#todo-grid .todo-chip').first().textContent();
    await page.locator('#todo-grid .todo-chip').first().click();
    await expect(page.locator('#modal-label')).toHaveValue(first);
    // by meaning, not by position: a fourth state was added between them
    await page.locator('.modal-category-row .segmented').first()
      .locator('.seg-btn[data-state="done"]').click();
    await page.locator('#modal-close').click();

    await page.locator('#category-list .category-row').first().locator('.cat-todo').click();
    tabs = await page.locator('#todo-tabs .todo-tab').allTextContents();
    expect(tabs[0]).toMatch(/Left to do \(61\)/);
    expect(tabs[1]).toMatch(/Already done \(1\)/);
  });
});
