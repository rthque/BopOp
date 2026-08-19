const { test, expect } = require('@playwright/test');
const { login, settle, readProject, handOver, STORE } = require('./helpers');

const setLook = (page, { index = 0, color2 = null, badge = null } = {}) => page.evaluate(
  ([k, i, c2, b]) => {
    const st = JSON.parse(localStorage.getItem(k));
    const p = st.projects[st.activeProjectId];
    const item = p.categories[i];
    if (c2) item.color2 = c2; else delete item.color2;
    if (b) item.badge = b; else delete item.badge;
    item.updatedAt = new Date().toISOString();
    // and one foundation with that task done, so the slice is filled
    const n = p.nodes.find((x) => !x.substation);
    const now = new Date().toISOString();
    n.status[item.id] = { at: now, by: 'Quentin' };
    n.statusAt = { ...(n.statusAt || {}), [item.id]: now };
    localStorage.setItem(k, JSON.stringify(st));
    return { id: item.id, label: n.label };
  }, [STORE, index, color2, badge],
);

test.describe('two colours and a badge', () => {
  test('a task with neither is drawn exactly as before', async ({ page }) => {
    await login(page);
    const seen = await page.evaluate(() => ({
      dots: document.querySelectorAll('pattern[id^="dots-"]').length,
      clips: document.querySelectorAll('clipPath[id^="slice-"]').length,
      badges: document.querySelectorAll('.node-badge').length,
    }));
    expect(seen).toEqual({ dots: 0, clips: 0, badges: 0 });
  });

  test('a second colour turns the filled slice into polka dots', async ({ page }) => {
    await login(page);
    const { id } = await setLook(page, { color2: '#ff00aa' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    const pattern = page.locator(`pattern#dots-${id}`);
    await expect(pattern).toHaveCount(1);
    expect(await pattern.locator('circle').count(), 'the dots themselves').toBe(2);
    await expect(pattern.locator('circle').first()).toHaveAttribute('fill', '#ff00aa');

    const fill = await page.evaluate((i) => {
      const el = document.querySelector(`[data-kind="wedge-${i}"]`);
      return el.style.fill;
    }, id);
    expect(fill.replace(/["']/g, '')).toBe(`url(#dots-${id})`);
  });

  test('the badge sits in the slice, clipped, and only where the task is done',
    async ({ page }) => {
      await login(page);
      const { id, label } = await setLook(page, { badge: '🔧' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await settle(page);

      await expect(page.locator(`clipPath#slice-${id}`)).toHaveCount(1);
      const badges = page.locator('.node-badge');
      await expect(badges, 'one badge, on the one finished slice').toHaveCount(1);
      await expect(badges.first()).toHaveText('🔧');
      await expect(badges.first()).toHaveAttribute('clip-path', `url(#slice-${id})`);

      // it belongs to the right foundation, and it cannot swallow the tap
      const owner = await page.evaluate(() => document.querySelector('.node-badge')
        .closest('.node-group').querySelector('.node-label').textContent);
      expect(owner).toBe(label);
      const events = await page.evaluate(() => getComputedStyle(document.querySelector('.node-badge')).pointerEvents);
      expect(events).toBe('none');
    });

  test('the badge never spills outside its own slice', async ({ page }) => {
    await login(page);
    const { id } = await setLook(page, { badge: 'AB' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    const fits = await page.evaluate((i) => {
      const t = document.querySelector('.node-badge');
      const slice = t.closest('.node-group').querySelector(`[data-kind="wedge-${i}"]`);
      const a = t.getBBox(); const b = slice.getBBox();
      return { inside: a.x >= b.x - 0.6 && a.y >= b.y - 0.6
        && a.x + a.width <= b.x + b.width + 0.6
        && a.y + a.height <= b.y + b.height + 0.6, a, b };
    }, id);
    expect(fits.inside, `badge ${JSON.stringify(fits.a)} vs slice ${JSON.stringify(fits.b)}`).toBe(true);
  });

  test('a 32-cell ring still keeps every badge inside its own cell', async ({ page }) => {
    await login(page, { admin: true });
    await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const p = st.projects[st.activeProjectId];
      const now = new Date().toISOString();
      const n = p.nodes.find((x) => !x.substation);
      for (let i = 0; i < 32; i += 1) {
        const item = { id: `out-${i}`, name: `Outer ${i}`, color: '#1F6FB2',
          badge: '🔧', updatedAt: now };
        p.outerVars.push(item);
        n.outer = n.outer || {};
        n.outer[item.id] = { at: now, by: 'Quentin' };
      }
      localStorage.setItem(k, JSON.stringify(st));
    }, STORE);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    const check = await page.evaluate(() => {
      const g = [...document.querySelectorAll('.node-group')]
        .find((x) => x.querySelector('.node-badge'));
      const out = { drawn: 0, spills: 0, oversize: 0 };
      g.querySelectorAll('.node-badge').forEach((t) => {
        out.drawn += 1;
        const kind = t.getAttribute('clip-path').replace(/url\(["']?#slice-|["']?\)/g, '');
        const cell = g.querySelector(`[data-kind="outer-${kind}"]`);
        if (!cell) return;
        const a = t.getBBox(); const b = cell.getBBox();
        if (a.x < b.x - 0.6 || a.y < b.y - 0.6
          || a.x + a.width > b.x + b.width + 0.6
          || a.y + a.height > b.y + b.height + 0.6) out.spills += 1;
        // 16 map units is the ring's thickness; a glyph must stay under it
        if (Number(t.getAttribute('font-size')) > 16) out.oversize += 1;
      });
      return out;
    });
    expect(check.drawn, 'one badge per filled cell').toBe(32);
    expect(check.spills, 'none of them crosses into a neighbour').toBe(0);
    expect(check.oversize, 'none of them is taller than the ring is thick').toBe(0);

    // the clips are shared by all 62 foundations, not made per badge
    const clips = await page.locator('clipPath[id^="slice-"]').count();
    expect(clips).toBeLessThanOrEqual(56);
  });

  test('the legend swatch shows the same thing as the map', async ({ page }) => {
    await login(page);
    await setLook(page, { color2: '#ff00aa', badge: 'AB' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    const dot = page.locator('#category-list .category-row .dot').first();
    await expect(dot).toHaveText('AB');
    const bg = await dot.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('radial-gradient');
  });

  test('both travel to the other phone', async ({ browser }, testInfo) => {
    const a = await browser.newPage();
    const b = await browser.newPage();
    await login(a, { admin: true });
    await login(b, { admin: true });
    await setLook(a, { color2: '#ff00aa', badge: '🔧' });
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);

    await handOver(a, b, testInfo.outputPath('look.json'));
    const item = (await readProject(b)).categories[0];
    expect(item.color2).toBe('#ff00aa');
    expect(item.badge).toBe('🔧');
    await expect(b.locator('.node-badge').first()).toHaveText('🔧');
    await a.close(); await b.close();
  });

  test('an admin can set and clear both from the task row', async ({ page }) => {
    await login(page, { admin: true });
    const row = page.locator('#category-list .category-row').first();
    await row.locator('.cat-dots').click();
    await page.waitForTimeout(300);
    expect((await readProject(page)).categories[0].color2).toBeTruthy();

    const badge = row.locator('.cat-badge');
    await badge.fill('⚡');
    await badge.dispatchEvent('change');
    await page.waitForTimeout(300);
    expect((await readProject(page)).categories[0].badge).toBe('⚡');

    // more than two glyphs is trimmed to what fits
    await badge.fill('ABCD');
    await badge.dispatchEvent('change');
    await page.waitForTimeout(300);
    expect((await readProject(page)).categories[0].badge).toBe('AB');

    await page.locator('#category-list .category-row').first().locator('.cat-dots').click();
    await page.waitForTimeout(300);
    expect((await readProject(page)).categories[0].color2).toBeUndefined();
  });
});
