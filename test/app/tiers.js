// The three rings a task can live in, and the four ways to ask a question about
// them. Pure data and pure lookups — no screen, no storage — so this file can be
// read by a test in a few milliseconds instead of a few seconds in a browser.
export const MAX_CATEGORIES = 8;
export const MAX_MICRO = 16;
export const MAX_OUTER = 32;

// A foundation is drawn as a dial: eight slices in the middle, then two rings
// that only appear once there are tasks to fill them. One table, because the
// alternative was the same three-way branch written out in thirty places.
export const TIERS = [
  { list: 'categories', key: 'status', max: MAX_CATEGORIES, dom: 'category-list',
    modal: 'modal-categories', label: 'Centre', hint: 'the eight slices in the middle' },
  { list: 'microVars', key: 'micro', max: MAX_MICRO, dom: 'micro-list',
    modal: 'modal-micro', label: 'First ring', hint: 'appears once the centre is full' },
  { list: 'outerVars', key: 'outer', max: MAX_OUTER, dom: 'outer-list',
    modal: 'modal-outer', label: 'Second ring', hint: 'the outermost band' },
];
export const tierList = (project, tier) => (project && project[tier.list]) || [];
export const allTaskItems = (project) => TIERS.reduce((out, t) => out.concat(tierList(project, t)), []);
// Everything that carries a method statement: the 56 tasks, and the
// repeatable inspections. They are different kinds of work — one is a tick on
// a dial, the other is an occurrence you count — but the instruction sheet is
// the same object, written and read in one place.
export const allProcedureItems = (project) => allTaskItems(project)
  .concat(((project && project.reportTypes) || []));
export const tierOfItem = (project, id) => TIERS.find((t) => tierList(project, t).some((i) => i.id === id));
export const tierByList = (name) => TIERS.find((t) => t.list === name);
// the bucket a task's ticks live in on a node
export const bucketFor = (node, id) => {
  const t = TIERS.find((x) => node[x.key] && (id in node[x.key]));
  return t ? node[t.key] : node.status;
};
