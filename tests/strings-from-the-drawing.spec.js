const { test, expect } = require('@playwright/test');
const { login, readProject, writeProject, setAdmin, settle, stubFirebase, CREW_WORD } = require('./helpers');

// The inter-array cables, as on the reference drawing pinned in the briefing
// room (transcribed 2026-10-08), and fixed there for good. Until then the app
// drew strings 2 and 5 as single chains, and joined G01 to G02 instead of H01.

// the cables as "A-B" (the end nearer the substation first), per string
const wiring = (p) => {
  const label = Object.fromEntries(p.nodes.map((n) => [n.id, n.label]));
  const out = {};
  p.connections.forEach((c) => {
    const s = `S${c.string + 1}`;
    (out[s] = out[s] || []).push(`${label[c.a]}-${label[c.b]}`);
  });
  return out;
};

test.describe('the strings, as on the drawing', () => {
  test('every foundation is on exactly one string, all 62 of them', async ({ page }) => {
    await login(page);
    const p = await readProject(page);
    const label = Object.fromEntries(p.nodes.map((n) => [n.id, n.label]));
    const onString = {};
    p.connections.forEach((c) => [c.a, c.b].forEach((id) => {
      if (label[id] === 'OSS') return;
      (onString[label[id]] = onString[label[id]] || new Set()).add(c.string);
    }));
    expect(Object.keys(onString)).toHaveLength(62);
    expect(Object.values(onString).every((s) => s.size === 1)).toBe(true);
    expect(p.connections).toHaveLength(62);
  });

  test('string 2 and string 5 are combs: each L feeds its own M', async ({ page }) => {
    await login(page);
    const w = wiring(await readProject(page));
    for (const seg of ['OSS-L04', 'L04-M04', 'L04-L05', 'L05-M05', 'L05-L06', 'L06-M06', 'L06-L07', 'L07-M07']) {
      expect(w.S2, `S2 has ${seg}`).toContain(seg);
    }
    for (const seg of ['OSS-L03', 'L03-M03', 'L03-L02', 'L02-M02', 'L02-L01', 'L01-M01', 'L01-K01']) {
      expect(w.S5, `S5 has ${seg}`).toContain(seg);
    }
    // what the old chain drew, and the drawing does not
    expect(w.S2).not.toContain('M06-M05');
    expect(w.S5).not.toContain('M01-M02');
  });

  test('string 8 branches at H01: G01 hangs off H01, not off G02', async ({ page }) => {
    await login(page);
    const w = wiring(await readProject(page));
    expect(w.S8).toContain('H01-G01');
    expect(w.S8).not.toContain('G02-G01');
  });

  test('the detours of the drawing are drawn, and nothing runs under a foundation it does not serve', async ({ page }) => {
    await login(page);
    const p = await readProject(page);
    const byId = Object.fromEntries(p.nodes.map((n) => [n.id, n]));
    const R = 68 * 1.25;        // the largest a dial ever gets
    const segDist = (q, a, b) => {
      const dx = b.x - a.x; const dy = b.y - a.y; const L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / L)) : 0;
      return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
    };
    const routes = p.connections.map((c) => ({
      c, pts: [byId[c.a], ...(c.bends || []), byId[c.b]],
    }));
    // the four detours are there
    const bent = routes.filter((r) => (r.c.bends || []).length).map((r) => `${byId[r.c.a].label}-${byId[r.c.b].label}`);
    expect(bent.sort()).toEqual(['H04-E03', 'OSS-G04', 'OSS-H04', 'OSS-K07']);

    const problems = [];
    routes.forEach(({ c, pts }) => {
      p.nodes.forEach((n) => {
        if (n.id === c.a || n.id === c.b) return;
        const r = n.substation ? 60 : R;
        let d = Infinity;
        for (let i = 1; i < pts.length; i += 1) d = Math.min(d, segDist(n, pts[i - 1], pts[i]));
        if (d < r) problems.push(`${byId[c.a].label}-${byId[c.b].label} under ${n.label}`);
      });
    });
    expect(problems, 'a cable must not look as if it served a foundation it passes').toEqual([]);
  });
});

test.describe('the layout cannot be changed any more', () => {
  test('there is no tool for it, even for an admin', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    await expect(page.locator('#btn-adjust-cables')).toHaveCount(0);
    await expect(page.locator('#btn-publish-cables')).toHaveCount(0);
  });

  test('dragging a cable moves the map, not the cable', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    const before = (await readProject(page)).connections;
    const from = await page.evaluate(() => {
      for (const el of document.querySelectorAll('#canvas .connection-hit')) {
        const m = el.getScreenCTM(); const len = el.getTotalLength();
        for (let f = 0.5; f > 0.1; f -= 0.05) {
          const pt = el.getPointAtLength(len * f);
          const q = { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
          const top = document.elementFromPoint(q.x, q.y);
          if (top && top.getAttribute('data-conn-id') === el.getAttribute('data-conn-id')) return q;
        }
      }
      return null;
    });
    expect(from).not.toBeNull();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 80, from.y + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect((await readProject(page)).connections).toEqual(before);
  });

  test('a cable sheet says which string, and offers nothing to change', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    // a point of the L04-M04 cable that a finger can actually reach
    const at = await page.evaluate(() => {
      const el = document.querySelector('#canvas .connection-hit[data-conn-id="cable-L04-M04"]');
      const m = el.getScreenCTM(); const len = el.getTotalLength();
      for (let f = 0.5; f > 0.05; f -= 0.05) {
        const pt = el.getPointAtLength(len * f);
        const q = { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
        const top = document.elementFromPoint(q.x, q.y);
        if (top && top.getAttribute('data-conn-id') === 'cable-L04-M04') return q;
      }
      return null;
    });
    expect(at).not.toBeNull();
    await page.mouse.click(at.x, at.y);
    await expect(page.locator('#cable-modal')).toBeVisible();
    await expect(page.locator('#cable-string')).toHaveText(/String 2/);
    await expect(page.locator('#cable-modal select')).toHaveCount(0);
  });

  test('a farm stored with the old wiring is redrawn from the drawing on load', async ({ page }) => {
    await login(page);
    // put the old S2 chain back, with a cable dragged aside, the way an older
    // version of the app would have stored it
    await writeProject(page, `
      const id = Object.fromEntries(project.nodes.map((n) => [n.label, n.id]));
      project.connections = [['OSS','L04'],['L04','L05'],['L05','L06'],['L06','L07'],['L07','M07'],['M07','M06'],['M06','M05'],['M05','M04']]
        .map(([a, b], i) => ({ id: 'old-' + i, a: id[a], b: id[b], string: 1, bends: [{ x: 9, y: 9 }] }));
      project.cablesAt = new Date(Date.now() + 86400000).toISOString();
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    const p = await readProject(page);
    expect(p.connections).toHaveLength(62);
    expect(wiring(p).S2).toContain('L04-M04');
    expect(p.connections.some((c) => (c.bends || []).some((b) => b.x === 9))).toBe(false);
  });
});

test.describe('what stands on each foundation', () => {
  test('the symbols of the drawing sit beside the foundations that carry them', async ({ page }) => {
    await login(page);
    const kit = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('#canvas .node-group').forEach((g) => {
        const name = g.querySelector('.node-label');
        const types = [...g.querySelectorAll('.node-equipment .equip')].map((e) => e.getAttribute('class').split('equip-')[1]);
        if (name && types.length) out[name.textContent] = types;
      });
      return out;
    });
    expect(Object.keys(kit)).toHaveLength(34);
    // the four corners of the farm, read off the drawing
    expect(kit.M07.sort()).toEqual(['ais', 'birdcam', 'cctv', 'horn']);
    expect(kit.A02.sort()).toEqual(['ais', 'birdcam', 'cctv', 'horn']);
    expect(kit.M01.sort()).toEqual(['5g', 'birdradar', 'cctv', 'horn']);
    expect(kit.D07.sort()).toEqual(['cctv', 'horn', 'searadar']);
    expect(kit.E01.sort()).toEqual(['24sea', '5g', 'horn']);
    // a foundation with nothing on it carries nothing
    expect(kit.J07).toBeUndefined();
  });

  test('they are reference, not news: they never catch a tap', async ({ page }) => {
    await login(page);
    const blocks = await page.evaluate(() => getComputedStyle(document.querySelector('.node-equipment')).pointerEvents);
    expect(blocks).toBe('none');
  });

  test('the legend explains them, in the language on screen', async ({ page }) => {
    await login(page);
    await expect(page.locator('#equipment-legend .legend-item')).toHaveCount(8);
    await expect(page.locator('#equipment-legend')).toContainText('Bird radar');
    await page.locator('#btn-lang').click();
    await expect(page.locator('#equipment-legend')).toContainText('Radar oiseaux');
  });
});

// A candidate version published beside the real site, for Quentin to look at
// first. Same origin as the real site, so it must neither open the real record
// on the device nor write anything to the crew's shared copy.
test.describe('the test version', () => {
  const asPreview = async (page) => {
    await page.route(/\/index\.html$/, async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace('<head>', '<head><meta name="bopop-preview" content="1">');
      return route.fulfill({ response: res, body: html });
    });
  };

  test('says TEST on the screen and in the tab', async ({ page }) => {
    await asPreview(page);
    await login(page);
    await expect(page.locator('#preview-badge')).toBeVisible();
    expect(await page.title()).toMatch(/^TEST/);
  });

  test('keeps its own copy, and leaves the real record on the device alone', async ({ page }) => {
    await asPreview(page);
    await login(page);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain('worksite-tracker-preview:v7');
    expect(keys).not.toContain('worksite-tracker:v7');
  });

  test('never writes to the team database', async ({ page }) => {
    const puts = [];
    await asPreview(page);
    await stubFirebase(page);
    await page.route('**/*.firebasedatabase.app/**', (route) => {
      if (route.request().method() === 'PUT') puts.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('button.login-name:has-text("Quentin")');
    await page.fill('#login-password-input', CREW_WORD);
    await page.click('#login-password-form button[type=submit]');
    await page.locator('#login-overlay').waitFor({ state: 'hidden' });

    // a tick, which on the real site goes out 1.5 s later
    await page.locator('.node-group').first().click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('#modal-categories li').first().locator('.seg-btn[data-state="done"]').click();
    await page.locator('#modal-save').click();
    await page.waitForTimeout(3500);
    expect(puts, 'nothing reached the crew').toEqual([]);
  });

  test('the real site, without the tag, is untouched by any of this', async ({ page }) => {
    await login(page);
    await expect(page.locator('#preview-badge')).toBeHidden();
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain('worksite-tracker:v7');
  });
});
