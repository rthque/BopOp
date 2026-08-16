const { test, expect } = require('@playwright/test');
const { login, readProject, handOver, settle } = require('./helpers');

const today = () => new Date().toISOString().slice(0, 10);

test.describe('day by day', () => {
  test("the date is the archive: today's talk never overwrites yesterday's", async ({ page }) => {
    await login(page);
    await page.click('#btn-daylog');
    await expect(page.locator('#daylog-modal')).not.toHaveClass(/hidden/);

    await page.fill('#tbt-input', 'Levage: exclusion zone, radio canal 8.');
    await page.locator('#tbt-input').dispatchEvent('change');
    await page.waitForTimeout(400);

    let p = await readProject(page);
    expect(p.tbts).toHaveLength(1);
    expect(p.tbts[0].id).toBe(`tbt-${today()}`);
    expect(p.tbts[0].by).toBe('Quentin');

    // a talk from yesterday, filed under its own day
    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const pr = st.projects[st.activeProjectId];
      const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      pr.tbts.push({ id: `tbt-${d}`, day: d, text: 'Hier: chute de plain-pied',
        by: 'Etienne', updatedAt: new Date(Date.now() - 86400000).toISOString() });
      localStorage.setItem(k, JSON.stringify(st));
    }, 'worksite-tracker:v7');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('#btn-daylog');

    await expect(page.locator('#tbt-list .daylog-item')).toHaveCount(1);
    await expect(page.locator('#tbt-list .daylog-item-body').first()).toContainText('Hier');
    await expect(page.locator('#tbt-input')).toHaveValue(/exclusion zone/);
  });

  test('a recap copied to WhatsApp is kept word for word', async ({ page }) => {
    await login(page);
    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const pr = st.projects[st.activeProjectId];
      const n = pr.nodes.find((x) => !x.substation);
      n.status[pr.categories[0].id] = { at: new Date().toISOString(), by: 'Quentin' };
      localStorage.setItem(k, JSON.stringify(st));
    }, 'worksite-tracker:v7');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    await page.click('#btn-recap-all');
    await page.waitForTimeout(500);
    const p = await readProject(page);
    expect(p.recaps).toHaveLength(1);
    expect(p.recaps[0].text).toMatch(/■ FOU →/);
    expect(p.recaps[0].by).toBe('Quentin');
    expect(p.recaps[0].scope).toBe('whole farm');

    await page.click('#btn-daylog');
    await page.locator('#daylog-tabs .todo-tab').nth(1).click();
    await expect(page.locator('#recap-list .daylog-item')).toHaveCount(1);
    await expect(page.locator('#recap-list .daylog-copy')).toHaveCount(1);
  });

  test('two people writing the same day make one entry, and the later one wins',
    async ({ browser }, testInfo) => {
      const a = await browser.newPage();
      const b = await browser.newPage();
      await login(a, { name: 'Quentin' });
      await login(b, { name: 'Yohan' });

      await a.click('#btn-daylog');
      await a.fill('#tbt-input', 'Version Quentin');
      await a.locator('#tbt-input').dispatchEvent('change');
      await a.waitForTimeout(300);
      await a.keyboard.press('Escape');

      await handOver(a, b, testInfo.outputPath('tbt.json'));

      await b.click('#btn-daylog');
      await b.fill('#tbt-input', 'Correction Yohan');
      await b.locator('#tbt-input').dispatchEvent('change');
      await b.waitForTimeout(300);
      await b.keyboard.press('Escape');

      await handOver(b, a, testInfo.outputPath('tbt2.json'));
      const mine = (await readProject(a)).tbts.filter((t) => t.id === `tbt-${today()}`);
      expect(mine).toHaveLength(1);
      expect(mine[0].text).toBe('Correction Yohan');
      expect(mine[0].by).toBe('Yohan');
      await a.close(); await b.close();
    });
});

test.describe('the guide', () => {
  test('opens for a visitor and speaks both languages', async ({ page }) => {
    await login(page, { name: 'Visitor' });
    await page.click('#btn-guide');
    await expect(page.locator('#guide-modal')).not.toHaveClass(/hidden/);
    await expect(page.locator('#guide-body .guide-section')).toHaveCount(6);
    const en = await page.locator('#guide-body').innerText();
    expect(en).toMatch(/Visitor — read only/);
    await page.click('#guide-lang');
    const fr = await page.locator('#guide-body').innerText();
    expect(fr).toMatch(/Visiteur — lecture seule/);
    expect(fr).not.toMatch(/Who can do what/);
  });
});

test.describe('method statements', () => {
  test('Communication / report is the first section, and it saves', async ({ page }) => {
    await login(page, { admin: true });
    await page.locator('#category-list .category-row').first().locator('.cat-proc').click();
    const open = page.locator('#proc-modal details[open]').first();
    const heads = await open.locator('.proc-section h4').allTextContents();
    expect(heads[0]).toMatch(/Communication \/ report/);
    expect(heads[1]).toMatch(/Method statement/);

    const box = open.locator('.proc-section').filter({ hasText: 'Communication / report' })
      .first().locator('textarea');
    await box.fill('Punch -> chef de quart puis Aconex');
    await box.dispatchEvent('change');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const p = await readProject(page);
    expect(p.procedures[p.categories[0].id].comm_en).toBe('Punch -> chef de quart puis Aconex');
  });
});
