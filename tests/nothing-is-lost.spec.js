const { test, expect } = require('@playwright/test');
const { login, readProject, writeProject, setAdmin, settle } = require('./helpers');

// The bug that emptied the map, and never said a word about it.
//
// A ring holds a fixed number of slices — 8, 16, 32. When a sync brought more
// tasks than fit, the extra ones were turned away. Fair enough. But every tick,
// every comment, every inspection that named one of those tasks was thrown away
// with them, silently, on every pull, once a minute. A season of work came back
// as an empty map and nothing anywhere said why.
//
// Two rules now. Work whose task this device does not know is KEPT ASIDE rather
// than dropped, and lights up by itself the day the task has a slot. And a merge
// that could not take everything in SAYS SO, in the log and on the screen.

const NOW = () => new Date().toISOString();
const FULL = 8; // the centre ring: MAX_CATEGORIES

// A stand-in for the team database, as the other sync tests use.
async function fakeDb(page, initial) {
  const db = { body: initial, puts: [] };
  await page.route('**/*.firebasedatabase.app/**', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      db.body = JSON.parse(req.postData() || '{}');
      db.puts.push(db.body);
      return route.fulfill({ status: 200, contentType: 'application/json', body: req.postData() });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(db.body) });
  });
  // The app pulls once as it starts. That first pull has already been and gone
  // by the time a test can install this, so start the app again against it.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  return db;
}

// The shared copy: the centre ring filled right up, plus one task too many,
// with a day's work ticked against it on three foundations.
function overcrowded(seed, extraId = 'task-one-too-many') {
  const at = NOW();
  const remote = JSON.parse(JSON.stringify(seed));
  let n = 0;
  while (remote.categories.length < FULL) {
    n += 1;
    remote.categories.push({ id: `task-filler-${n}`, name: `Filler ${n}`, color: '#274A72', updatedAt: at });
  }
  remote.categories.push({ id: extraId, name: 'One too many', color: '#B5651D', updatedAt: at });
  const worked = remote.nodes.filter((nd) => !nd.substation).slice(0, 3);
  worked.forEach((nd) => {
    nd.status = nd.status || {};
    nd.statusAt = nd.statusAt || {};
    nd.status[extraId] = { at, by: 'Etienne' };
    nd.statusAt[extraId] = at;
    nd.taskComments = nd.taskComments || {};
    nd.commentAt = nd.commentAt || {};
    nd.taskComments[extraId] = 'Fait au premier passage';
    nd.commentAt[extraId] = at;
  });
  return { remote, labels: worked.map((nd) => nd.label) };
}

const heldOn = (project, labels, id) => labels
  .map((label) => (project.nodes.find((n) => n.label === label) || {}))
  .filter((n) => [n.status, n.micro, n.outer].some((m) => (m || {})[id])).length;

test.describe('work whose task has no room yet', () => {
  test('is kept aside instead of being thrown away', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    const seed = await readProject(page);
    const { remote, labels } = overcrowded(seed);
    await fakeDb(page, remote);

    await page.waitForTimeout(4000); // let the sync pull come round

    const after = await readProject(page);
    // the task really was turned away — the ring is full and stays full
    expect(after.categories).toHaveLength(FULL);
    expect(after.categories.some((c) => c.id === 'task-one-too-many')).toBe(false);
    // but its work is still here, on all three foundations, waiting
    expect(heldOn(after, labels, 'task-one-too-many'),
      'three ticks kept aside, not dropped').toBe(3);
    const first = after.nodes.find((n) => n.label === labels[0]);
    expect(first.taskComments['task-one-too-many']).toBe('Fait au premier passage');
  });

  test('lights up on its own the day the task has a slot', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    const seed = await readProject(page);
    const { remote, labels } = overcrowded(seed);
    await fakeDb(page, remote);
    await page.waitForTimeout(4000);
    expect((await readProject(page)).categories.some((c) => c.id === 'task-one-too-many')).toBe(false);

    // somebody deletes a task to make room — the way the app does it, with a
    // dated headstone, or the next sync would simply put it back
    await writeProject(page, `
      project.categories = project.categories.filter((c) => c.id !== 'task-filler-1');
      project.tombstones = project.tombstones || {};
      project.tombstones.tasks = project.tombstones.tasks || {};
      project.tombstones.tasks['task-filler-1'] = new Date(Date.now() + 1000).toISOString();
      project.tasksOrderedAt = new Date(Date.now() + 60000).toISOString();
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.waitForTimeout(4000); // the next pull brings the task in

    const end = await readProject(page);
    expect(end.categories.some((c) => c.id === 'task-one-too-many'),
      'the task finally has its slot').toBe(true);
    expect(heldOn(end, labels, 'task-one-too-many'),
      'and the work that was waiting for it is on the dial').toBe(3);
    // and it is on the screen beside the map, not only in the record
    await expect
      .poll(() => page.locator('#category-list .cat-name')
        .evaluateAll((els) => els.map((e) => e.value)))
      .toContain('One too many');
  });

  test('the sync says out loud what it could not take in', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    const seed = await readProject(page);
    const { remote } = overcrowded(seed);
    await fakeDb(page, remote);
    await page.waitForTimeout(4000);

    const after = await readProject(page);
    const said = (after.activity || []).filter((e) => e.action === 'sync');
    expect(said.length, 'the merge left a line in the log').toBeGreaterThan(0);
    expect(said[said.length - 1].detail).toContain('One too many');
    // once per change, not once per pull — the poll comes round every minute
    await page.waitForTimeout(3000);
    const again = await readProject(page);
    expect((again.activity || []).filter((e) => e.action === 'sync')).toHaveLength(said.length);
  });
});

test.describe('the team database', () => {
  test('is not stripped of a task just because this device had no room', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    const seed = await readProject(page);
    const { remote } = overcrowded(seed);
    const db = await fakeDb(page, remote);
    await page.waitForTimeout(4000);

    // this device could not seat it...
    expect((await readProject(page)).categories.some((c) => c.id === 'task-one-too-many')).toBe(false);
    // ...so it must not be the one to delete it for the whole crew. Every push
    // sends the WHOLE project, and a task missing from it is a task erased.
    await page.locator('.node-group').first().click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('#modal-categories li').first()
      .locator('.seg-btn[data-state="done"]').click();
    await page.waitForTimeout(200);
    await page.locator('#modal-save').click();
    await page.waitForTimeout(4000); // the push goes out 1.5 s after an edit

    expect(db.puts.length, 'this device did push').toBeGreaterThan(0);
    const shared = [...(db.body.categories || []), ...(db.body.overflow || [])];
    expect(shared.some((c) => c && c.id === 'task-one-too-many'),
      'the task the rings refused is still in the shared copy').toBe(true);
  });
});

test.describe('the list beside the map', () => {
  test('follows what a teammate changed, without waiting for a reload', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    const seed = await readProject(page);
    const remote = JSON.parse(JSON.stringify(seed));
    remote.categories[0] = Object.assign({}, remote.categories[0], {
      name: 'Renommée sur un autre téléphone', updatedAt: NOW(),
    });
    await fakeDb(page, remote);
    await page.waitForTimeout(4000);

    await expect
      .poll(() => page.locator('#category-list .cat-name').evaluateAll((els) => els.map((e) => e.value)))
      .toContain('Renommée sur un autre téléphone');
  });
});

test.describe('a task somebody deleted on purpose', () => {
  test('stays deleted, and so does the work that named it', async ({ page }) => {
    await login(page, { admin: true });
    await setAdmin(page, true);

    // this device knows the task was deleted, and says when
    await writeProject(page, `
      project.tombstones = project.tombstones || {};
      project.tombstones.tasks = project.tombstones.tasks || {};
      project.tombstones.tasks['task-a-ghost'] = new Date().toISOString();
    `);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);

    // the shared copy still carries its ticks
    const seed = await readProject(page);
    const remote = JSON.parse(JSON.stringify(seed));
    delete (remote.tombstones || {}).tasks;
    const at = NOW();
    const label = remote.nodes.find((n) => !n.substation).label;
    const ghosted = remote.nodes.find((n) => n.label === label);
    ghosted.status['task-a-ghost'] = { at, by: 'Etienne' };
    ghosted.statusAt['task-a-ghost'] = at;
    await fakeDb(page, remote);
    await page.waitForTimeout(4000);

    const after = await readProject(page);
    expect(heldOn(after, [label], 'task-a-ghost'),
      'a tombstone is a decision — keeping work aside must not undo it').toBe(0);
  });
});
