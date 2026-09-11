const path = require('path');
const { test, expect } = require('@playwright/test');
const { login, settle, setAdmin, readProject, writeProject, handOver, REPO } = require('./helpers');

// Le Tréport is built. The map is read, not edited — that was decided on
// 2026-08-02 — and the last piece of the old editor still on the screen was the
// "Note" button, offered to every technician on a rolling boat.
//
// Taking the editor away must NOT take the notes away. A phone that already
// holds some has to keep drawing them and keep handing them on, or removing a
// button would quietly delete data for everybody.

const tmp = path.join(REPO, 'test-results', 'map-notes.json');

const NOTE = `
  project.annotations = project.annotations || [];
  project.annotations.push({ id: 'note-crane', x: 0, y: 0, text: 'Grue ici', size: 52 });
`;

test.describe('the map is read, not drawn on', () => {
  test('a note already on the map is still drawn', async ({ page }) => {
    await login(page, { admin: true });
    await writeProject(page, NOTE);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    const note = page.locator('#canvas text.map-annotation[data-annot-id="note-crane"]');
    await expect(note).toHaveCount(1);
    await expect(note).toHaveText('Grue ici');
  });

  test('and still travels to the other phones', async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, { admin: true });
    await login(b, { admin: true });
    await writeProject(a, NOTE);
    await a.reload({ waitUntil: 'domcontentloaded' });
    await settle(a);

    await handOver(a, b, tmp);
    const got = await readProject(b);
    expect((got.annotations || []).some((n) => n.id === 'note-crane'),
      'removing the button must not delete the notes').toBe(true);
    await expect(b.locator('#canvas text.map-annotation[data-annot-id="note-crane"]')).toHaveCount(1);
  });

  test('but nobody can write a new one by accident any more', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);
    await expect(page.locator('#btn-add-text')).toHaveCount(0);
    await expect(page.locator('#text-modal')).toHaveCount(0);

    // and tapping one that is already there opens nothing
    await writeProject(page, NOTE);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.locator('#canvas text.map-annotation').first().click({ force: true });
    await page.waitForTimeout(400);
    await expect(page.locator('.modal-overlay:not(.hidden)')).toHaveCount(0);
  });
});
