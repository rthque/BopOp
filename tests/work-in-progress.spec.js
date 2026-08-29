const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, readProject, writeProject, handOver, REPO } = require('./helpers');

// A fourth state, between "not done" and "some of it done": somebody is on
// this task right now. Its whole job is to stop a tech starting a job his
// colleague is already doing, so what matters is the NAME attached to it.

const inProgress = (by) => `
  const now = new Date().toISOString();
  const n = project.nodes.find((x) => !x.substation);
  n.status[project.categories[0].id] = { at: now, by: ${JSON.stringify(by)}, wip: true };
  n.statusAt = Object.assign({}, n.statusAt, { [project.categories[0].id]: now });
`;

const openFirstFoundation = async (page) => {
  await page.locator('.node-group').first().click({ force: true });
  await page.waitForTimeout(400);
};

test.describe('a task somebody is already on', () => {
  test('the foundation sheet offers it, and records who', async ({ page }) => {
    await login(page);
    await openFirstFoundation(page);
    const row = page.locator('#modal-categories li').first();
    // four choices now, not three
    await expect(row.locator('.seg-btn')).toHaveCount(4);
    await row.locator('.seg-btn[data-state="wip"]').click();
    await page.waitForTimeout(400);

    const p = await readProject(page);
    const stamp = p.nodes.find((n) => !n.substation).status[p.categories[0].id];
    expect(stamp.wip).toBe(true);
    expect(stamp.by).toBe('Quentin');
    expect(stamp.at).toBeTruthy();
  });

  test('the sheet says who is on it, which is the whole point', async ({ page }) => {
    await login(page);
    await writeProject(page, inProgress('Yohan'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirstFoundation(page);

    const row = page.locator('#modal-categories li').first();
    await expect(row.locator('.seg-btn[data-state="wip"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(row.locator('.check-meta')).toContainText('in progress');
    await expect(row.locator('.check-meta')).toContainText('Yohan');
  });

  test('it is drawn differently from half-done and from done', async ({ page }) => {
    await login(page);
    await writeProject(page, inProgress('Yohan') + `
      const now2 = new Date().toISOString();
      const n2 = project.nodes.find((x) => !x.substation);
      n2.status[project.categories[1].id] = { at: now2, by: 'Q', partial: true };
      n2.status[project.categories[2].id] = { at: now2, by: 'Q' };
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    const fills = await page.evaluate(() => {
      const g = [...document.querySelectorAll('.node-group')].find((x) => x.querySelector('.node-wedge'));
      // the fill is set as a style, not as an attribute
      return [...g.querySelectorAll('.node-wedge')].map((w) => w.style.fill);
    });
    const wip = fills.filter((f) => /wip-/.test(f));
    const hatch = fills.filter((f) => /hatch-/.test(f));
    expect(wip).toHaveLength(1);
    expect(hatch).toHaveLength(1);
    // three different fills for three different meanings
    expect(new Set(fills.filter(Boolean)).size).toBeGreaterThanOrEqual(3);
  });

  test('it counts as work still to do, not as progress', async ({ page }) => {
    await login(page);
    await writeProject(page, inProgress('Yohan') + `
      const set = (id, minutes) => {
        const p = (project.procedures[id] = project.procedures[id] || {});
        p.sectionUpdated = p.sectionUpdated || {};
        p.minutes = minutes; p.people = 1;
        p.sectionUpdated.effort = new Date().toISOString();
      };
      set(project.categories[0].id, 60);
      set(project.categories[1].id, 60);
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirstFoundation(page);
    // 60 min in progress + 60 min untouched = nothing delivered yet
    await expect(page.locator('#modal-effort .effort-text')).toContainText('0%');
    // and the foundation is still "left to do" on that task
    await page.locator('#modal-save').click();
    await page.waitForTimeout(300);
    await page.locator('#category-list .category-row').first().locator('.cat-todo').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#todo-tabs .todo-tab').first()).toContainText('Left to do (62)');
  });

  test('the chip in "which foundations are left" names who is on it', async ({ page }) => {
    await login(page);
    await writeProject(page, inProgress('Yohan'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.locator('#category-list .category-row').first().locator('.cat-todo').click();
    await page.waitForTimeout(400);
    const chip = page.locator('#todo-grid .todo-chip.todo-chip--wip');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveAttribute('title', /in progress \(Yohan\)/);
  });

  test('it reaches the other device — that is what makes it useful', async ({ browser }) => {
    const tmp = path.join(REPO, 'test-results', 'wip.json');
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, { name: 'Yohan' });
    await login(b, { name: 'Quentin' });
    await writeProject(a, inProgress('Yohan'));
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);

    await handOver(a, b, tmp);
    const p = await readProject(b);
    const stamp = p.nodes.find((n) => !n.substation).status[p.categories[0].id];
    expect(stamp.wip).toBe(true);
    expect(stamp.by).toBe('Yohan');
  });

  test('a foundation already in progress can still be finished', async ({ page }) => {
    await login(page);
    await writeProject(page, inProgress('Yohan'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirstFoundation(page);
    const row = page.locator('#modal-categories li').first();
    await row.locator('.seg-btn[data-state="done"]').click();
    await page.waitForTimeout(400);
    const p = await readProject(page);
    const stamp = p.nodes.find((n) => !n.substation).status[p.categories[0].id];
    expect(stamp.wip).toBeFalsy();
    expect(stamp.partial).toBeFalsy();
  });
});
