const { test, expect } = require('@playwright/test');
const { login, settle, writeProject } = require('./helpers');

// The dials are drawn larger than the grid they sit on so a slice can be read
// in the sun and hit with gloves. Nothing else about the map moved: the
// foundations keep their positions, so the farm keeps its shape.
//
// The whole point of this file is the thing that constrains that scale — the
// substation sits far closer to L04 than any two foundations are to each other.
// If someone raises the scale again, this is what says how far they can go
// before a landmark starts covering somebody's work.

test.describe('how big a foundation is drawn', () => {
  // A dial only draws the bands it has tasks for, and a fresh project has none
  // in the second ring — measuring that would measure the wrong circle. Fill
  // every ring first, so what is measured is the largest a dial can ever be.
  async function withAllThreeRings(page) {
    await login(page);
    await writeProject(page, `
      if (!project.microVars.length) project.microVars.push({ id: 'm1', name: 'M', color: '#888888' });
      if (!project.outerVars.length) project.outerVars.push({ id: 'o1', name: 'O', color: '#888888' });
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.waitForTimeout(300);
  }

  const geometry = (page) => page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('worksite-tracker:v7'));
    const p = st.projects[st.activeProjectId];
    const nodes = p.nodes;
    const svg = document.getElementById('canvas');
    const box = svg.getBoundingClientRect();

    // Read the radius off what is actually drawn rather than trusting a
    // constant. A ring cell's bounding box touches the outer radius on the
    // axis it spans, so the largest |x| or |y| over all of them IS that radius
    // — the box *corner* is further out than the arc and would overstate it.
    const cells = [...document.querySelectorAll('.node-ring-cell, .node-wedge')];
    const outerR = Math.max(...cells.map((el) => {
      const b = el.getBBox();
      return Math.max(Math.abs(b.x), Math.abs(b.x + b.width), Math.abs(b.y), Math.abs(b.y + b.height));
    }));

    const img = document.querySelector('.substation-icon-img');
    const side = img ? parseFloat(img.getAttribute('width')) : 0;
    // the drawing is letterboxed inside that square: 300x420, fitted on height
    const inkHalfWidth = (side / 420) * 300 / 2;

    const oss = nodes.find((n) => n.substation);
    const fnd = nodes.filter((n) => !n.substation);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let closestPair = Infinity;
    for (let i = 0; i < fnd.length; i += 1) {
      for (let j = i + 1; j < fnd.length; j += 1) closestPair = Math.min(closestPair, d(fnd[i], fnd[j]));
    }
    const closestToOss = Math.min(...fnd.map((n) => d(n, oss)));
    return { outerR, inkHalfWidth, closestPair, closestToOss, mapW: box.width, mapH: box.height };
  });

  test('two foundations never touch', async ({ page }) => {
    await withAllThreeRings(page);
    const g = await geometry(page);
    expect(g.outerR).toBeGreaterThan(0);
    expect(g.closestPair, 'two dials must clear each other').toBeGreaterThan(g.outerR * 2);
  });

  test('the substation never covers the foundation next to it', async ({ page }) => {
    await withAllThreeRings(page);
    const g = await geometry(page);
    // L04 is only 117 world units from the platform while no two foundations are
    // closer than 192 — this is the pair that decides how large a dial may be
    expect(g.closestToOss).toBeLessThan(g.closestPair);
    expect(g.closestToOss, 'the platform must not sit over a slice')
      .toBeGreaterThanOrEqual(g.outerR + g.inkHalfWidth);
  });

  test('the whole farm still fits on a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await withAllThreeRings(page);
    const off = await page.evaluate(() => {
      const svg = document.getElementById('canvas');
      const box = svg.getBoundingClientRect();
      return [...document.querySelectorAll('.node-label')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.left < box.left - 1 || b.right > box.right + 1
          || b.top < box.top - 1 || b.bottom > box.bottom + 1;
      }).map((el) => el.textContent);
    });
    expect(off, 'no foundation may be pushed off the map').toEqual([]);
  });
});
