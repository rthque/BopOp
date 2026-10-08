// Everything in this repository is published (see deploy.yml), so a copy of the
// app left in a subfolder is a second live BopOp, on the same origin as the
// real one. Without the preview tag it would open the crew's real record on
// whatever phone visits it, and write to the team database as if it were the
// real thing — with whatever code that copy happens to hold.
//
// `test/` is not ours: it is BopOp V2, deposited by the V2 repository's own
// deploy robot. It is a different app with its own storage, and is left alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOT_OURS = new Set(['test', 'node_modules', '.git', 'tests', 'docs', 'test-results', 'playwright-report']);

const copiesOfTheApp = () => fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !NOT_OURS.has(d.name))
  .map((d) => path.join(ROOT, d.name, 'index.html'))
  .filter((f) => fs.existsSync(f) && fs.existsSync(path.join(path.dirname(f), 'app.js')));

test('every copy of the app beside the real one is marked as a preview', () => {
  for (const file of copiesOfTheApp()) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /<meta name="bopop-preview"/,
      `${path.relative(ROOT, file)} is a live copy of BopOp without the preview tag — it would write into the crew's real data`);
    assert.match(html, /<meta name="robots" content="noindex/,
      `${path.relative(ROOT, file)} would be indexed by search engines`);
  }
});

test('the real site at the root is not marked as a preview', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<meta name="bopop-preview"/,
    'the root index.html carries the preview tag: the real site would stop writing to the team database');
});
