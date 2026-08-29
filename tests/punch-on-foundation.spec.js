const { test, expect } = require('@playwright/test');
const { login, settle, readProject, writeProject } = require('./helpers');

// A punch always names the foundation it is about — that was the point of
// refusing to raise one "on the fly". So it is read where that foundation is
// read, rather than in a list of sixty on the left of the map with no way to
// tell which ones concern the FOU you are standing on.

const threePunches = `
  const n = project.nodes.find((x) => !x.substation);
  project.punchList = [
    { id: 'p1', nodeId: n.id, text: n.label + ' — garde-corps plié', done: false,
      by: 'Yohan', at: new Date().toISOString() },
    { id: 'p2', text: n.label + ' — ancienne punch sans id', done: true,
      doneBy: 'Etienne', at: new Date().toISOString() },
    { id: 'p3', text: 'Z99 — une autre fondation', done: false, at: new Date().toISOString() },
  ];
`;

const openFirst = async (page) => {
  await page.locator('.node-group').first().click({ force: true });
  await page.waitForTimeout(400);
};

test.describe('punches live on their foundation', () => {
  test('the left panel no longer carries the list', async ({ page }) => {
    await login(page);
    await expect(page.locator('#punch-list')).toHaveCount(0);
  });

  test('the sheet shows this foundation\'s punches and nobody else\'s', async ({ page }) => {
    await login(page);
    await writeProject(page, threePunches);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirst(page);

    const items = page.locator('#modal-punch .punch-item');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('garde-corps plié');
    // an older punch, from before punches carried an id, still found by its label
    await expect(items.nth(1)).toContainText('ancienne punch');
    await expect(page.locator('#modal-punch')).not.toContainText('Z99');
  });

  test('it can still be closed and deleted from there', async ({ page }) => {
    await login(page);
    await writeProject(page, threePunches);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await openFirst(page);

    await page.locator('#modal-punch .punch-item').first().locator('input[type=checkbox]').check();
    await page.waitForTimeout(300);
    expect((await readProject(page)).punchList.find((p) => p.id === 'p1').done).toBe(true);

    await page.locator('#modal-punch .punch-item').first().locator('button').click();
    await page.waitForTimeout(300);
    // tombstoned rather than removed, so the deletion reaches the other devices
    expect((await readProject(page)).punchList.find((p) => p.id === 'p1').deleted).toBe(true);
    await expect(page.locator('#modal-punch .punch-item')).toHaveCount(1);
  });

  test('a new punch is bound to the foundation it was raised on', async ({ page }) => {
    await login(page);
    await openFirst(page);
    const label = await page.locator('#modal-label').inputValue();
    page.once('dialog', (d) => d.accept(`${label} — trou dans le caillebotis`));
    await page.locator('#modal-add-punch').click();
    await page.waitForTimeout(400);

    const p = await readProject(page);
    const raised = p.punchList[0];
    expect(raised.nodeId).toBe(p.nodes.find((n) => n.label === label).id);
    await expect(page.locator('#modal-punch .punch-item')).toHaveCount(1);
    // and it is in the log, which it never used to be
    expect((p.activity || []).some((e) => e.action === 'punch')).toBe(true);
  });
});
