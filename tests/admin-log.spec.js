const { test, expect } = require('@playwright/test');
const { login, settle, setAdmin, readProject } = require('./helpers');

// Two different questions get asked of this log, and mixing them makes both
// hard to answer: "what did the crew do today?" and "who changed the app's
// settings, and to what?".

const openLog = async (page) => {
  await page.locator('#btn-log').click();
  await page.waitForTimeout(400);
};

test.describe('the activity log', () => {
  test('separates work on site from changes to the app itself', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    // one of each: a tick (work) and a rename (settings)
    await page.locator('.node-group').first().click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('#modal-categories li').first()
      .locator('.seg-btn[data-state="done"]').click();
    await page.waitForTimeout(300);
    await page.locator('#modal-save').click();
    await page.waitForTimeout(300);

    const nameBox = page.locator('#category-list .category-row').first().locator('.cat-name');
    await nameBox.fill('Renommée par un admin');
    await nameBox.blur();
    await page.waitForTimeout(300);

    await openLog(page);
    const tabs = page.locator('#log-tabs .todo-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(1)).toContainText('Work on site (1)');
    await expect(tabs.nth(2)).toContainText('App settings (1)');

    await tabs.nth(2).click();
    await page.waitForTimeout(300);
    await expect(page.locator('#log-body')).toContainText('Renommée par un admin');
    await expect(page.locator('#log-body')).not.toContainText('→ done');

    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    await expect(page.locator('#log-body')).toContainText('→ done');
    await expect(page.locator('#log-body')).not.toContainText('Renommée par un admin');
  });

  test('records what the admins do that nothing used to record', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    // an inspection added
    page.once('dialog', (d) => d.accept('Contrôle échelle'));
    await page.locator('#btn-add-report').click();
    await page.waitForTimeout(400);

    // the SRCC access rules rewritten
    const rules = page.locator('#string-rules-body textarea');
    await rules.fill('Nouvelle consigne SRCC.');
    await rules.blur();
    await page.waitForTimeout(300);

    const actions = (await readProject(page)).activity.map((e) => e.action);
    expect(actions).toContain('inspection-added');
    expect(actions).toContain('access-rules');

    await openLog(page);
    await page.locator('#log-tabs .todo-tab').nth(2).click();
    await page.waitForTimeout(300);
    await expect(page.locator('#log-body')).toContainText('Contrôle échelle');
    await expect(page.locator('#log-body')).toContainText('Nouvelle consigne SRCC.');
  });

  test('an inspection renamed or deleted is filed as an inspection, not a task', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    const row = page.locator('#reports-list .category-row').first();
    const box = row.locator('input[type=text]');
    await box.fill('Inspection renommée');
    await box.blur();
    await page.waitForTimeout(300);

    page.once('dialog', (d) => d.accept());
    await page.locator('#reports-list .category-row').first()
      .locator('button[title="Delete inspection type"]').click();
    await page.waitForTimeout(400);

    const actions = (await readProject(page)).activity.map((e) => e.action);
    expect(actions).toContain('inspection-renamed');
    expect(actions).toContain('inspection-deleted');
    expect(actions).not.toContain('task-renamed');
  });

  test('what is copied follows the tab you are on', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    const nameBox = page.locator('#category-list .category-row').first().locator('.cat-name');
    await nameBox.fill('Réglage admin');
    await nameBox.blur();
    await page.waitForTimeout(300);

    await openLog(page);
    await page.locator('#log-tabs .todo-tab').nth(1).click();   // work on site: empty
    await page.waitForTimeout(300);
    await expect(page.locator('#log-body')).toContainText('Nothing of this kind recorded yet');
  });
});
