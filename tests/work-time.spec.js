const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, setAdmin, readProject, writeProject, handOver, REPO } = require('./helpers');

// How long a task takes is recorded once, on its method statement, and read
// back as a percentage of work done — per foundation, and for the whole farm.
// Everything is counted in PERSON-minutes: an hour with two people on it is
// two hours of work.

// 30 min alone, 60 min for two (= 120), 45 min alone. The fourth task is left
// untimed on purpose: that is the case the figures have to be honest about.
const priceTasks = `
  const set = (id, minutes, people) => {
    const p = (project.procedures[id] = project.procedures[id] || {});
    p.sectionUpdated = p.sectionUpdated || {};
    p.minutes = minutes; p.people = people;
    p.sectionUpdated.effort = new Date().toISOString();
  };
  set(project.categories[0].id, 30, 1);
  set(project.categories[1].id, 60, 2);
  set(project.categories[2].id, 45, 1);
`;

async function pricedProject(page, extra = '') {
  await login(page, { admin: true });
  await writeProject(page, priceTasks + extra);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  await setAdmin(page, true);
  await page.waitForTimeout(300);
}

test.describe('how much work a foundation is worth', () => {
  test('an admin records the minutes and the crew, and reads back the work hours', async ({ page }) => {
    await login(page, { admin: true });
    await page.locator('#category-list .category-row').first().locator('.cat-proc').click();
    await page.waitForTimeout(400);

    const section = page.locator('.proc-effort').first();
    await expect(section.locator('.proc-effort-total'))
      .toContainText(/not timed yet/i);

    await section.locator('.effort-minutes').fill('90');
    await section.locator('.effort-minutes').blur();
    await page.waitForTimeout(300);
    await section.locator('.effort-person').nth(1).click();   // 2 people
    await page.waitForTimeout(300);

    // 1 h 30 with two people is three hours of work
    await expect(section.locator('.proc-effort-total')).toContainText('1 h 30');
    await expect(section.locator('.proc-effort-total')).toContainText('3 h');

    const p = await readProject(page);
    const proc = p.procedures[p.categories[0].id];
    expect(proc.minutes).toBe(90);
    expect(proc.people).toBe(2);
  });

  test('two people on a task count double, and a part-done task counts half', async ({ page }) => {
    await pricedProject(page, `
      const now = new Date().toISOString();
      const n = project.nodes.find((x) => !x.substation);
      n.status[project.categories[0].id] = { at: now, by: 'Quentin' };              // 30 done
      n.status[project.categories[1].id] = { at: now, by: 'Quentin', partial: true }; // half of 120 = 60
    `);
    // total = 30 + 120 + 45 = 195 person-minutes; done = 30 + 60 = 90 → 46%
    await page.locator('.node-group').first().click({ force: true });
    await page.waitForTimeout(400);
    const line = page.locator('#modal-effort .effort-text');
    await expect(line).toContainText('46%');
    await expect(line).toContainText('1 h 30');   // 90 min done
    await expect(line).toContainText('3 h 15');   // 195 min in total
  });

  test('a task nobody has timed is left out of both sides, and said so', async ({ page }) => {
    await pricedProject(page);
    await page.locator('.node-group').first().click({ force: true });
    await page.waitForTimeout(400);
    // the seeded project has 8 tasks; 3 are timed, so 5 are not
    await expect(page.locator('#modal-effort .effort-note')).toContainText('5 tasks not timed');
    // and the total is only what was timed: 30 + 120 + 45
    await expect(page.locator('#modal-effort .effort-text')).toContainText('3 h 15');
  });

  test('the whole farm gets one line, in hours rather than in ticks', async ({ page }) => {
    await pricedProject(page, `
      const now = new Date().toISOString();
      project.nodes.filter((x) => !x.substation).forEach((n, i) => {
        if (i < 31) n.status[project.categories[0].id] = { at: now, by: 'Quentin' };
      });
    `);
    // 62 foundations × 195 = 12 090 person-minutes; 31 × 30 = 930 done → 8%
    const line = page.locator('#farm-effort');
    await expect(line).toBeVisible();
    await expect(line).toContainText('8%');
    await expect(line).toContainText('15 h 30');   // 930 min
    await expect(line).toContainText('201 h 30');  // 12 090 min
  });

  test('the "foundations left" list says how far each one has got', async ({ page }) => {
    await pricedProject(page, `
      const now = new Date().toISOString();
      const n = project.nodes.filter((x) => !x.substation)[0];
      n.status[project.categories[0].id] = { at: now, by: 'Quentin' };
    `);
    await page.locator('#category-list .category-row').nth(1).locator('.cat-todo').click();
    await page.waitForTimeout(400);
    // that foundation has 30 of 195 done — 15% — and it is still "left to do"
    // on this second task, so it appears in this list carrying that figure
    const chips = page.locator('#todo-grid .todo-chip');
    await expect(chips.first().locator('.todo-chip-pct')).toHaveText('15%');
    await expect(chips.nth(1).locator('.todo-chip-pct')).toHaveText('0%');
  });

  test('the substation is not given a percentage', async ({ page }) => {
    await pricedProject(page);
    const id = await page.evaluate(() => {
      const st = JSON.parse(localStorage.getItem('worksite-tracker:v7'));
      const p = st.projects[st.activeProjectId];
      return p.nodes.find((n) => n.substation).id;
    });
    await page.evaluate((nodeId) => {
      const g = [...document.querySelectorAll('.node-group')]
        .find((el) => el.dataset && el.dataset.nodeId === nodeId);
      (g || document.querySelector('.substation-hit')).dispatchEvent(
        new MouseEvent('click', { bubbles: true }));
    }, id);
    await page.waitForTimeout(400);
    await expect(page.locator('#modal-effort')).toBeHidden();
  });

  test('a technician reads the time but cannot change it', async ({ page }) => {
    await pricedProject(page);
    await setAdmin(page, false);
    // with no rename field in the way, the whole row is the target for a tech
    await page.locator('#category-list .category-row').first().click();
    await page.waitForTimeout(400);
    const section = page.locator('.proc-effort').first();
    await expect(section.locator('.proc-effort-total')).toContainText('30 min');
    await expect(section.locator('.effort-minutes')).toHaveCount(0);
    await expect(section.locator('.effort-person')).toHaveCount(0);
  });

  test('the time and the crew travel to the other device', async ({ browser }) => {
    const tmp = path.join(REPO, 'test-results', 'work-time.json');
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await pricedProject(a);
    await login(b, { admin: true });

    await handOver(a, b, tmp);
    const p = await readProject(b);
    const proc = p.procedures[p.categories[1].id];
    expect(proc.minutes).toBe(60);
    expect(proc.people).toBe(2);
    await expect(b.locator('#farm-effort')).toContainText('%');
  });
});
