// Shared scaffolding. Everything here is relative to the repo — no path that
// only exists on one machine, no port, no server anyone has to remember to
// start. `npx playwright test` on a bare clone is the whole story.
const path = require('path');
const fs = require('fs');

const STORE = 'worksite-tracker:v7';
const REPO = path.resolve(__dirname, '..');

// The login asks Firebase whether the password is right. Tests must never
// depend on that being reachable, so stand in for it: the account's own
// password is the long one, and that is what the app is expected to send.
// The page pulls its fonts from Google. Left alone, every navigation in the
// suite waits on a third-party host — thirteen seconds a page here — and the
// result depends on whether the runner can reach the internet. Serve an empty
// stylesheet instead: the app falls back to system faces, which changes nothing
// any of these tests are about.
async function isolateFonts(page) {
  await page.route('**/fonts.googleapis.com/**', (route) => route.fulfill({
    status: 200, contentType: 'text/css', body: '/* fonts stubbed for tests */',
  }));
  await page.route('**/fonts.gstatic.com/**', (route) => route.abort());
}

async function stubFirebase(page, { accepts = 'BOPBOP' } = {}) {
  await isolateFonts(page);
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* not JSON */ }
    if (body.password === accepts) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ idToken: 'tok', refreshToken: 'ref', expiresIn: '3600' }),
      });
    }
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
    });
  });
  // the shared database itself is never contacted from a test
  await page.route('**/*.firebasedatabase.app/**', (route) => route.abort('failed'));
}

// Fails the test on any uncaught page error. A silent exception that leaves the
// screen half-drawn is exactly the kind of thing a green suite should not hide.
function watchForErrors(page, sink) {
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/net::ERR|status of 400|Failed to load resource/.test(m.text())) return; // our own stubs
    sink.push(`console: ${m.text()}`);
  });
}

// Never wait for the network to fall idle: once signed in the app keeps a live
// stream open to the shared database and retries it forever, so "idle" never
// arrives. Wait for the app to have drawn itself instead.
async function settle(page) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById('login-overlay');
    if (!overlay) return false;
    if (!overlay.classList.contains('hidden')) return !!document.querySelector('button.login-name');
    return !!document.querySelector('#category-list .category-row');
  }, null, { timeout: 20_000 });
}

async function login(page, { name = 'Quentin', password = 'bop', admin = false } = {}) {
  await stubFirebase(page);
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  if (name === 'Visitor') await page.click('#login-visitor');
  else await page.click(`button.login-name:has-text("${name}")`);
  await page.fill('#login-password-input', password);
  await page.click('#login-password-form button[type=submit]');
  // the overlay is hidden by a class, so wait for it to go — not for it to appear
  await page.locator('#login-overlay').waitFor({ state: 'hidden', timeout: 15_000 });
  if (admin) await setAdmin(page, true);
}

async function setAdmin(page, on) {
  const isOn = await page.evaluate(() => /ON/.test(document.getElementById('admin-toggle-text').textContent));
  if (isOn !== on) {
    await page.locator('#btn-admin-toggle').evaluate((el) => el.click());
    await page.waitForTimeout(300);
  }
}

const readProject = (page) => page.evaluate((k) => {
  const state = JSON.parse(localStorage.getItem(k));
  return state.projects[state.activeProjectId];
}, STORE);

const writeProject = (page, mutate) => page.evaluate(([k, src]) => {
  const state = JSON.parse(localStorage.getItem(k));
  // eslint-disable-next-line no-new-func
  new Function('project', src)(state.projects[state.activeProjectId]);
  localStorage.setItem(k, JSON.stringify(state));
}, [STORE, mutate]);

// One device hands its whole project to another, through the app's own import —
// the same merge the live sync runs, so a test that passes here is a statement
// about the real thing and not about a helper.
async function handOver(from, to, tmpFile) {
  const json = await from.evaluate((k) => {
    const state = JSON.parse(localStorage.getItem(k));
    return JSON.stringify(state.projects[state.activeProjectId]);
  }, STORE);
  fs.writeFileSync(tmpFile, json);
  to.once('dialog', (d) => d.accept());          // "merge into the existing project?"
  await to.setInputFiles('#file-import', tmpFile);
  await to.waitForTimeout(1200);
}

// Count what is actually recorded, the way the map counts it.
const load = (project) => {
  let ticks = 0; let comments = 0; let reports = 0; let notes = 0; let issues = 0;
  (project.nodes || []).forEach((n) => {
    [n.status || {}, n.micro || {}, n.outer || {}].forEach((m) => {
      Object.values(m).forEach((s) => { if (s) ticks += 1; });
    });
    comments += Object.values(n.taskComments || {}).filter(Boolean).length;
    Object.values(n.reports || {}).forEach((e) => { reports += (e || []).length; });
    if (n.note) notes += 1;
    if (n.issue) issues += 1;
  });
  return { ticks, comments, reports, notes, issues };
};


// A stand-in for the shared database: one document, in memory, shared by every
// page attached to it. Enough to drive the real read/merge/write code without
// a network — and it speaks the one thing that matters here, the version tag
// that lets a write say "only if nobody moved since I looked".
//
// Attach it AFTER login(): Playwright gives priority to the handler added last,
// and login installs its own.
function makeFakeDb() {
  const db = {
    doc: null,
    etag: 'e0',
    puts: 0,
    gets: 0,
    rejected: 0,          // writes refused because someone else had moved
    online: true,
    readsFail: false,     // the connection flaps between the read and the write
    supportsEtag: true,   // not every deployment exposes the tag to the browser
  };

  // what an older build of the app does: the whole document, no tag, no asking
  db.legacyWrite = (doc) => {
    db.doc = JSON.parse(JSON.stringify(doc));
    db.etag = `e${Number(db.etag.slice(1)) + 1}`;
  };

  // Slip somebody else's write in between a reader's GET and its PUT — the
  // exact window the version tag exists to catch. Fires once.
  db.raceOnce = (mutate) => { db._race = mutate; };

  db.attach = async (page) => {
    await page.route('**/*.firebasedatabase.app/**', async (route) => {
      const req = route.request();
      if ((req.headers().accept || '').includes('event-stream')) return route.abort('failed');
      if (!db.online) return route.abort('failed');

      if (req.method() === 'GET') {
        if (db.readsFail) return route.abort('failed');
        db.gets += 1;
        const headers = { 'content-type': 'application/json' };
        // A browser cannot read a header off a cross-origin response unless the
        // server says it may. Without this line the tag is invisible to the
        // page and the write silently falls back to no `if-match` — which is
        // exactly what `supportsEtag: false` reproduces below.
        if (db.supportsEtag && req.headers()['x-firebase-etag']) {
          headers.etag = db.etag;
          headers['access-control-expose-headers'] = 'ETag';
        }
        const body = JSON.stringify(db.doc);
        await route.fulfill({ status: 200, headers, body });
        // only on the read that precedes a write — that is the window the tag
        // exists to catch, and the only one where a 412 can happen
        if (db._race && req.headers()['x-firebase-etag']) {
          const mutate = db._race;
          db._race = null;
          const next = JSON.parse(body);
          mutate(next);
          db.legacyWrite(next);        // they land first, and the tag moves
        }
        return undefined;
      }

      if (req.method() === 'PUT') {
        const ifMatch = req.headers()['if-match'];
        if (ifMatch && ifMatch !== db.etag) {
          db.rejected += 1;
          return route.fulfill({ status: 412, contentType: 'application/json',
            body: JSON.stringify({ error: 'mismatch' }) });
        }
        db.puts += 1;
        db.doc = JSON.parse(req.postData() || 'null');
        db.etag = `e${Number(db.etag.slice(1)) + 1}`;
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: req.postData() || 'null' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });
  };
  return db;
}

// Set or clear one tick straight in storage, the way a tap would leave it.
const setTick = (page, { tier = 'categories', index = 0, label = 'M07', on = true }) => page.evaluate(
  ([k, t, i, lb, val]) => {
    const s = JSON.parse(localStorage.getItem(k));
    const p = s.projects[s.activeProjectId];
    const bucket = { categories: 'status', microVars: 'micro', outerVars: 'outer' }[t];
    const id = p[t][i].id;
    const n = p.nodes.find((x) => x.label === lb);
    const now = new Date().toISOString();
    n[bucket][id] = val ? { at: now, by: 'bench' } : null;
    n.statusAt = { ...(n.statusAt || {}), [id]: now };
    localStorage.setItem(k, JSON.stringify(s));
    return id;
  }, [STORE, tier, index, label, on],
);

const getTick = (page, { tier = 'categories', index = 0, label = 'M07' } = {}) => page.evaluate(
  ([k, t, i, lb]) => {
    const s = JSON.parse(localStorage.getItem(k));
    const p = s.projects[s.activeProjectId];
    const bucket = { categories: 'status', microVars: 'micro', outerVars: 'outer' }[t];
    const n = p.nodes.find((x) => x.label === lb);
    return !!n[bucket][p[t][i].id];
  }, [STORE, tier, index, label],
);

// what the shared copy holds for one tick
const dbTick = (db, { tier = 'categories', index = 0, label = 'M07' } = {}) => {
  if (!db.doc) return null;
  const bucket = { categories: 'status', microVars: 'micro', outerVars: 'outer' }[tier];
  const id = db.doc[tier][index].id;
  const n = db.doc.nodes.find((x) => x.label === label);
  return !!(n && n[bucket] && n[bucket][id]);
};

module.exports = { STORE, REPO, settle, isolateFonts, stubFirebase, makeFakeDb, setTick, getTick, dbTick, watchForErrors, login, setAdmin, readProject, writeProject, handOver, load };
