// The fast tests. These call the merge straight out and answer in about a
// millisecond each — where the same question asked through a browser costs
// several seconds. That difference is the whole reason app/merge.js exists as
// its own file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProjects, placeWaiting, tombstone, applyClear } from '../../app/merge.js';
import { MAX_CATEGORIES } from '../../app/tiers.js';

const AT = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

// the smallest thing the merge accepts: a farm with two foundations
const farm = (over = {}) => Object.assign({
  categories: [], microVars: [], outerVars: [], reportTypes: [],
  nodes: [
    { label: 'A01', status: {}, micro: {}, outer: {}, statusAt: {}, taskComments: {}, commentAt: {}, reports: {}, reportGone: {} },
    { label: 'A02', status: {}, micro: {}, outer: {}, statusAt: {}, taskComments: {}, commentAt: {}, reports: {}, reportGone: {} },
  ],
  procedures: {}, recaps: [], tbts: [], punchList: [], team: [], permits: [],
  strings: [], connections: [], annotations: [], suggestions: [], activity: [],
}, over);

const task = (id, name, at) => ({ id, name, color: '#274A72', updatedAt: at || AT(-1000) });
const tickedOn = (project, label, id, at) => {
  const n = project.nodes.find((x) => x.label === label);
  n.status[id] = { at, by: 'Etienne' };
  n.statusAt[id] = at;
  return project;
};

test('a tick arrives with its task', () => {
  const mine = farm();
  const theirs = tickedOn(farm({ categories: [task('t1', 'Peinture')] }), 'A01', 't1', AT());
  mergeProjects(mine, theirs);
  assert.equal(mine.categories.length, 1);
  assert.ok(mine.nodes[0].status.t1, 'the tick landed on A01');
});

test('a tick whose task will not fit is kept aside, not dropped', () => {
  const full = Array.from({ length: MAX_CATEGORIES }, (_, i) => task(`f${i}`, `Filler ${i}`));
  const mine = farm({ categories: full.slice() });
  const theirs = tickedOn(farm({ categories: full.concat(task('extra', 'One too many')) }),
    'A01', 'extra', AT());

  mergeProjects(mine, theirs);

  assert.equal(mine.categories.length, MAX_CATEGORIES, 'the ring stays full');
  assert.ok(!mine.categories.some((c) => c.id === 'extra'), 'the task was turned away');
  assert.ok(mine.nodes[0].status.extra, 'but its tick is kept aside');
  assert.deepEqual(mergeProjects.refused, ['One too many'], 'and the refusal is reported');
  assert.ok(mine.overflow.some((o) => o.id === 'extra'), 'the task waits its turn');
});

test('and takes its place by itself once a slice is freed', () => {
  const full = Array.from({ length: MAX_CATEGORIES }, (_, i) => task(`f${i}`, `Filler ${i}`));
  const mine = farm({ categories: full.slice() });
  mergeProjects(mine, farm({ categories: full.concat(task('extra', 'One too many')) }));
  assert.equal(mine.categories.length, MAX_CATEGORIES);

  mine.categories = mine.categories.filter((c) => c.id !== 'f0');
  placeWaiting(mine);

  assert.ok(mine.categories.some((c) => c.id === 'extra'), 'it walked in on its own');
  assert.equal(mine.overflow.length, 0, 'and left the waiting room');
});

test('a task deleted on purpose stays deleted, and so does its work', () => {
  const mine = farm({ categories: [task('t1', 'Peinture')] });
  tombstone(mine, 'tasks', 't1', mine.categories[0]);
  mine.categories = [];

  const theirs = tickedOn(farm({ categories: [task('t1', 'Peinture')] }), 'A01', 't1', AT());
  mergeProjects(mine, theirs);

  assert.equal(mine.categories.length, 0, 'it did not come back');
  assert.ok(!mine.nodes[0].status.t1, 'and neither did the tick that named it');
  assert.ok(!(mine.overflow || []).some((o) => o.id === 't1'), 'nor through the waiting room');
});

test('a headstone is always dated after the task it buries', () => {
  // the task came from a phone whose clock runs ten minutes fast
  const p = farm({ categories: [task('t1', 'Peinture', AT(600000))] });
  tombstone(p, 'tasks', 't1', p.categories[0]);
  assert.ok(new Date(p.tombstones.tasks.t1) > new Date(p.categories[0].updatedAt),
    'otherwise the task reads as re-created and walks straight back in');
});

test('unticking travels, instead of being posted back a second later', () => {
  const done = AT(-60000);
  const mine = tickedOn(farm({ categories: [task('t1', 'Peinture')] }), 'A01', 't1', done);
  // they unticked it, later
  const theirs = farm({ categories: [task('t1', 'Peinture')] });
  theirs.nodes[0].status.t1 = null;
  theirs.nodes[0].statusAt.t1 = AT();

  mergeProjects(mine, theirs);
  assert.equal(mine.nodes[0].status.t1, null, 'the more recent decision wins');
});

test('clearing the farm spares the work done after it', () => {
  const p = farm({ categories: [task('t1', 'Peinture')] });
  tickedOn(p, 'A01', 't1', AT(-120000));   // before the wipe
  tickedOn(p, 'A02', 't1', AT());          // after it
  applyClear(p, Date.now() - 60000);

  assert.equal(p.nodes[0].status.t1, null, 'old work is no longer data');
  assert.ok(p.nodes[1].status.t1, 'work done since is untouched');
});

test('the tasks a merge could not place are named, not swallowed', () => {
  const full = Array.from({ length: MAX_CATEGORIES }, (_, i) => task(`f${i}`, `Filler ${i}`));
  const mine = farm({ categories: full.slice() });
  mergeProjects(mine, farm({
    categories: full.concat([task('x1', 'Trop une'), task('x2', 'Trop deux')]),
  }));
  assert.deepEqual(mergeProjects.refused.sort(), ['Trop deux', 'Trop une']);
});
