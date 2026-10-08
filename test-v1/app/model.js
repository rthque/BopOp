// The shape of one foundation, made whole. A record that has travelled between
// phones, or come back from an older version of the app, is patched up here
// before anything else reads it.
import { TIERS, tierList } from './tiers.js';
import { TOMBSTONE_MS } from './dates.js';
import { STRING_GROUPS } from './farm.js';


export function normalizeNode(node, project) {
  node.status = node.status || {};
  node.micro = node.micro || {};
  node.taskComments = node.taskComments || {};
  node.commentAt = node.commentAt || {};
  node.statusAt = node.statusAt || {};
  node.outer = node.outer || {};
  node.reports = node.reports || {};
  node.reportGone = node.reportGone || {};
  Object.values(node.reportGone).forEach((keys) => {
    Object.entries(keys || {}).forEach(([k, at]) => {
      if (Date.now() - new Date(at || 0).getTime() > TOMBSTONE_MS) delete keys[k];
    });
  });
  TIERS.forEach((t) => {
    const map = node[t.key];
    Object.keys(map).forEach((k) => {
      if (map[k] === true) map[k] = { at: null, by: null };
      else if (map[k] === false) map[k] = null;
    });
  });
  // every task owns a slot in exactly one bucket — the one its tier names.
  // A task moved to another ring takes its ticks with it, so the slot has to
  // follow the task rather than stay where it was first created.
  TIERS.forEach((t) => {
    tierList(project, t).forEach((item) => {
      if (!(item.id in node[t.key])) {
        const from = TIERS.find((o) => o !== t && (item.id in node[o.key]));
        node[t.key][item.id] = from ? node[from.key][item.id] : null;
        if (from) delete node[from.key][item.id];
      }
    });
  });
}

// The eight inter-array cables, before anybody has drawn anything.
export function defaultStrings() {
  return STRING_GROUPS.map((_, i) => ({ n: i + 1, srcc: false }));
}

// The method statement for one task or inspection, created empty on first ask
// rather than scattered `|| {}` at every reader.
export function getProcedure(project, itemId) {
  if (!project.procedures[itemId]) {
    project.procedures[itemId] = { comm_en: '', comm_fr: '', en: '', fr: '', tools_en: '', tools_fr: '', ppe_en: '', ppe_fr: '' };
  }
  const proc = project.procedures[itemId];
  if (!proc.sectionUpdated || typeof proc.sectionUpdated !== 'object') proc.sectionUpdated = {};
  return proc;
}

// every free-text part of a method statement exists once per language:
// writing the tools in French must not overwrite the English ones
export const PROC_TEXT_KEYS = ['comm_en', 'comm_fr', 'en', 'fr', 'tools_en', 'tools_fr', 'ppe_en', 'ppe_fr'];
