const { test, expect } = require('@playwright/test');
const { login, settle, readProject } = require('./helpers');

// The substation carries none of the work the 62 foundations carry: no ticks,
// no inspections, no punch, no hours. Offering all of that and then writing
// "Not applicable" under it is a sheet that is mostly apologies. What is
// useful there is somewhere to write things down, so that is all it is.

const openOss = async (page) => {
  await settle(page);
  await page.locator('.substation-hit').click({ force: true });
  await page.waitForTimeout(400);
};

test.describe('the substation sheet', () => {
  test('is one box and nothing else', async ({ page }) => {
    await login(page, { admin: true });
    await openOss(page);
    await expect(page.locator('#modal-title')).toHaveText(/Substation/i);

    for (const id of ['modal-label-field', 'modal-geo', 'modal-effort', 'modal-srcc',
      'modal-issue-field', 'modal-tasks-field', 'modal-reports-field',
      'modal-punch-field', 'modal-actions']) {
      await expect(page.locator(`#${id}`), `${id} must be out of the way`).toBeHidden();
    }
    await expect(page.locator('#modal-note')).toBeVisible();
    await expect(page.locator('#modal-note-label')).toHaveText('Notes');
  });

  test('the box holds a real page of text, and it is kept', async ({ page }) => {
    await login(page, { admin: true });
    await openOss(page);
    const long = 'Poste électrique. '.repeat(120);   // ~2 100 characters
    expect(long.length).toBeGreaterThan(2000);
    await page.locator('#modal-note').fill(long);
    await page.locator('#modal-note').blur();
    await page.waitForTimeout(300);
    await page.locator('#modal-save').click();
    await page.waitForTimeout(300);

    const p = await readProject(page);
    const oss = p.nodes.find((n) => n.substation);
    expect(oss.note).toBe(long);
    // and it comes back when the sheet is reopened
    await openOss(page);
    await expect(page.locator('#modal-note')).toHaveValue(long);
  });

  test('a foundation still gets the whole sheet', async ({ page }) => {
    await login(page, { admin: true });
    await settle(page);
    await page.locator('.node-group').first().click({ force: true });
    await page.waitForTimeout(400);
    await expect(page.locator('#modal-tasks-field')).toBeVisible();
    await expect(page.locator('#modal-label-field')).toBeVisible();
    await expect(page.locator('#modal-actions')).toBeVisible();
    await expect(page.locator('#modal-note-label')).toHaveText('Free note');
  });
});
