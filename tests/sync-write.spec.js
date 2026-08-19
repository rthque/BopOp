const { test, expect } = require('@playwright/test');
const { login, settle, makeFakeDb, setTick, getTick, dbTick } = require('./helpers');

// Every test here drives the app's own read / merge / write path against a
// stand-in database. No network, nothing to flake in CI.
async function device(browser, db, { name = 'Quentin' } = {}) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, { name });          // installs its own routes…
  await db.attach(page);                // …so ours goes on top
  return page;
}

const settleSync = async (page, ms = 3200) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.waitForTimeout(ms);
};

test.describe('the write path', () => {
  test('a tick made offline reaches the shared copy by itself', async ({ browser }) => {
    const db = makeFakeDb();
    const a = await device(browser, db);
    db.online = false;
    await setTick(a, { index: 0 });
    expect(await getTick(a, { index: 0 })).toBe(true);
    db.online = true;
    await settleSync(a);
    expect(dbTick(db, { index: 0 }), 'the tick left the tablet on its own').toBe(true);
  });

  test('when the read fails, NOTHING is written', async ({ browser }) => {
    const db = makeFakeDb();
    const a = await device(browser, db);
    // someone else's work is already there
    await setTick(a, { index: 0 });
    await settleSync(a);
    const putsBefore = db.puts;
    expect(putsBefore).toBeGreaterThan(0);

    // now the connection flaps: reads fail, writes would still go through
    db.readsFail = true;
    await setTick(a, { index: 1 });
    await settleSync(a);
    expect(db.puts, 'a blind whole-document write must never happen').toBe(putsBefore);

    // and the work is not lost — it goes out once reading works again
    db.readsFail = false;
    await settleSync(a);
    expect(db.puts).toBeGreaterThan(putsBefore);
    expect(dbTick(db, { index: 1 })).toBe(true);
  });

  test('a write that would flatten a concurrent change is refused, then retried',
    async ({ browser }) => {
      const db = makeFakeDb();
      const a = await device(browser, db);
      await setTick(a, { index: 0 });
      await settleSync(a);

      // an older build — or another tablet — writes a whole document of its own
      // in the window between our read and our write
      db.raceOnce((doc) => {
        const otherId = doc.categories[2].id;
        const node = doc.nodes.find((n) => n.label === 'M07');
        const now = new Date().toISOString();
        node.status[otherId] = { at: now, by: 'autre tablette' };
        node.statusAt = { ...(node.statusAt || {}), [otherId]: now };
      });

      await setTick(a, { index: 1 });
      await settleSync(a, 6000);

      expect(db.rejected, 'the clobbering write was refused').toBeGreaterThan(0);
      expect(dbTick(db, { index: 2 }), "the other tablet's work is still there").toBe(true);
      expect(dbTick(db, { index: 1 }), 'and ours went on top of it, not instead').toBe(true);
    });

  test('without a version tag the write still waits for a good read', async ({ browser }) => {
    const db = makeFakeDb();
    db.supportsEtag = false;              // a deployment that hides the header
    const a = await device(browser, db);
    await setTick(a, { index: 0 });
    await settleSync(a);
    expect(dbTick(db, { index: 0 })).toBe(true);

    const putsBefore = db.puts;
    db.readsFail = true;
    await setTick(a, { index: 1 });
    await settleSync(a);
    expect(db.puts, 'still no blind write').toBe(putsBefore);
  });

  test('two devices on different parts of the same foundation keep both',
    async ({ browser }) => {
      const db = makeFakeDb();
      const a = await device(browser, db, { name: 'Quentin' });
      const b = await device(browser, db, { name: 'Yohan' });

      await setTick(a, { index: 0 });
      await settleSync(a);
      await setTick(b, { index: 1 });
      await settleSync(b);
      await settleSync(a);

      expect(await getTick(a, { index: 0 })).toBe(true);
      expect(await getTick(a, { index: 1 })).toBe(true);
      expect(await getTick(b, { index: 0 })).toBe(true);
      expect(await getTick(b, { index: 1 })).toBe(true);
    });

  test('a device three days behind does not undo newer work', async ({ browser }) => {
    const db = makeFakeDb();
    const a = await device(browser, db, { name: 'Quentin' });
    const b = await device(browser, db, { name: 'Yohan' });

    await setTick(a, { index: 0 });
    await settleSync(a);
    const stale = await a.evaluate((k) => localStorage.getItem(k), 'worksite-tracker:v7');

    // B works while A is away
    await settleSync(b);
    await setTick(b, { index: 1 });
    await settleSync(b);

    // A comes back holding its three-day-old copy and pushes
    await a.evaluate(([k, v]) => localStorage.setItem(k, v), ['worksite-tracker:v7', stale]);
    await settleSync(a, 5000);

    expect(dbTick(db, { index: 1 }), "B's newer work survives A's return").toBe(true);
    expect(dbTick(db, { index: 0 })).toBe(true);
  });
});
