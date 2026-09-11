const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, setAdmin, readProject, handOver, REPO } = require('./helpers');

// The cables are drawn in straight lines from the string list. Where two of them
// cross, or one runs under a foundation, the map stops being readable — so an
// admin can pull a cable aside before the layout is settled for good.
//
// It is deliberately behind a switch. A cable nudged by a gloved thumb on a
// moving boat is exactly the accident the old map editor was taken away to
// prevent; this one only exists while an admin has asked for it.

const tmp = path.join(REPO, 'test-results', 'nudged-cables.json');

// A point that is really ON the cable. The bounding box of a diagonal line has
// its centre off in empty water, which is why this asks the drawing itself.
// …and one the finger would actually reach: half of a cable's length runs
// under a foundation dial, which sits on top of it.
async function midOfACable(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('#canvas .connection-hit')) {
      const m = el.getScreenCTM();
      const len = el.getTotalLength();
      for (let f = 0.5; f > 0.1; f -= 0.05) {
        const pt = el.getPointAtLength(len * f);
        const p = { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
        const top = document.elementFromPoint(p.x, p.y);
        if (top && top.getAttribute('data-conn-id') === el.getAttribute('data-conn-id')) {
          return Object.assign(p, { connId: el.getAttribute('data-conn-id') });
        }
      }
    }
    throw new Error('no cable reachable');
  });
}

// drag from the middle of a cable to somewhere else on the map
async function dragACable(page, dx, dy) {
  const from = await midOfACable(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  return from;
}

const bends = (p) => (p.connections || []).reduce((n, c) => n + ((c.bends || []).length), 0);

test.describe('moving a cable out of the way', () => {
  test('is off until an admin asks for it', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    await expect(page.locator('#adjust-hint')).toBeHidden();

    const before = await readProject(page);
    await dragACable(page, 60, 40);
    const after = await readProject(page);
    expect(bends(after), 'dragging the map must not bend a cable').toBe(bends(before));
  });

  test('bends the cable once it is on, and says so on the map', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    await page.locator('#btn-adjust-cables').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#adjust-hint')).toBeVisible();
    await expect(page.locator('#btn-adjust-cables')).toHaveAttribute('aria-pressed', 'true');

    const before = await readProject(page);
    await dragACable(page, 70, 50);
    const after = await readProject(page);
    expect(bends(after), 'the cable now has an elbow').toBe(bends(before) + 1);
    // the drawing is dated, or the other phones never hear about it
    expect(new Date(after.cablesAt).getTime())
      .toBeGreaterThan(new Date(before.cablesAt || 0).getTime());
  });

  test('pulling the elbow back onto the straight line takes it away again', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    await page.locator('#btn-adjust-cables').click();
    await page.waitForTimeout(300);

    const start = await dragACable(page, 70, 50);
    expect(bends(await readProject(page))).toBe(1);

    // grab the elbow where we left it and bring it home
    await page.mouse.move(start.x + 70, start.y + 50);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(bends(await readProject(page)), 'the cable is straight again').toBe(0);
  });

  test('the new route reaches the other phones', async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, { admin: true });
    await login(b, { admin: true });
    await setAdmin(a, true);
    await a.locator('#btn-adjust-cables').click();
    await a.waitForTimeout(300);
    await dragACable(a, 70, 50);
    expect(bends(await readProject(a))).toBe(1);

    await handOver(a, b, tmp);
    expect(bends(await readProject(b)), 'a drawing is no use on one phone only').toBe(1);
  });

  test('a technician is never offered it', async ({ page }) => {
    await login(page);            // no admin mode
    await expect(page.locator('#btn-adjust-cables')).toBeHidden();
  });
});
