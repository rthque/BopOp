// How two phones agree.
//
// Everything here is data in, data out: no screen, no storage, no network. That
// is what lets a test call it directly and get an answer in a millisecond,
// instead of driving a whole browser to ask the same question.
//
// The rule, everywhere: a change carries the date it was MADE, and the most
// recent one wins. A deletion is a change like any other, so it carries a date
// too — otherwise a union between two devices cannot tell "erased here" from
// "not seen here yet", and what somebody removed keeps coming back.
import { TIERS, tierList, allTaskItems, tierByList, bucketFor,
  MAX_CATEGORIES, MAX_MICRO, MAX_OUTER } from './tiers.js';
import { TOMBSTONE_MS, survives, stampAfter } from './dates.js';
import { normalizeNode, defaultStrings, getProcedure, PROC_TEXT_KEYS } from './model.js';
import { trimActivity } from './activity.js';
import { uid } from './utils.js';

// A shift recap is a log line, and the log is not the record: three hundred is
// about a year of them, which is more than anybody scrolls back through.
export const RECAP_KEEP = 300;

// Merge a project exported from another phone into the local one:
// categories/reports are matched by name, each task keeps the most recent
// stamp, report occurrences are unioned — nothing is ever deleted.
// A task deleted on one phone used to come straight back from the next one
// to sync, because a union by id has no way to tell "never existed here" from
// "was removed here". The id is remembered instead, for a month.
export function tombstones(project, kind) {
  project.tombstones = project.tombstones || {};
  project.tombstones[kind] = project.tombstones[kind] || {};
  return project.tombstones[kind];
}

// The headstone has to be dated AFTER the thing it buries, or the burial
// never takes: an item carrying a later date is read as "re-created since"
// and walks straight back in. A phone whose clock runs ten minutes fast
// stamps its tasks ten minutes into the future, so deleting one of those on
// a correct phone did nothing at all — the task came back at the next sync
// and nobody could see why.
export function tombstone(project, kind, id, item) {
  const standing = tombstones(project, kind)[id];
  const born = item && item.updatedAt;
  const floor = new Date(standing || 0).getTime() > new Date(born || 0).getTime() ? standing : born;
  tombstones(project, kind)[id] = stampAfter(floor);
}

export function pruneTombstones(project) {
  Object.values(project.tombstones || {}).forEach((map) => {
    Object.entries(map).forEach(([id, at]) => {
      if (Date.now() - new Date(at || 0).getTime() > TOMBSTONE_MS) delete map[id];
    });
  });
}

// The waiting room: tasks a full ring could not seat. They are real tasks
// with a real name and a real colour, kept whole so that the day a slice is
// freed they walk in exactly as they were — and so that a device which could
// not seat them never destroys them for the rest of the crew.
export function placeWaiting(project) {
  if (!Array.isArray(project.overflow)) { project.overflow = []; return; }
  const buried = (project.tombstones || {}).tasks || {};
  const seated = new Set(allTaskItems(project).map((i) => i.id));
  const at = (o) => new Date((o && o.updatedAt) || 0).getTime();
  // oldest first, then by id, so every device seats them in the same order
  const queue = project.overflow
    .filter((o) => o && o.id && tierByList(o.list))
    .sort((a, b) => at(a) - at(b) || String(a.id).localeCompare(String(b.id)));
  const waiting = [];
  queue.forEach((o) => {
    // already seated here, under this id or under this very name
    if (seated.has(o.id)) return;
    // deliberately deleted since, and not re-created after: let it go
    if (buried[o.id] && at(o) <= new Date(buried[o.id]).getTime()) return;
    const tier = tierByList(o.list);
    const list = tierList(project, tier);
    if (list.some((i) => (i.name || '').trim().toLowerCase() === (o.name || '').trim().toLowerCase())) return;
    if (list.length >= tier.max) { waiting.push(o); return; }
    const item = { id: o.id, name: o.name, color: o.color, updatedAt: o.updatedAt };
    ['color2', 'badge'].forEach((k) => { if (o[k]) item[k] = o[k]; });
    if (o.hidden) item.hidden = true;
    list.push(item);
    seated.add(o.id);
  });
  project.overflow = waiting;
}
// ---------- erasing, in a world where everything is a union ----------
// Ticks, comments, reports and notes merge as a UNION: whatever exists on
// either side is kept. That is deliberate — two techs working offline on
// different foundations must both come home with their work, and no sync
// must ever cost someone a morning of ticking.
// But a union cannot say "this was erased". So clearing the site wiped the
// screen, the next sync brought the old data straight back, and the wipe
// looked broken. One project-wide date fixes it: anything stamped before the
// wipe stops being data, on every device. Work done after it is untouched.
export function applyClear(project, cutoff) {
  if (!cutoff) return;
  (project.nodes || []).forEach((node) => {
    TIERS.map((t) => node[t.key]).forEach((map) => {
      Object.keys(map || {}).forEach((id) => {
        if (map[id] && !survives(map[id].at, cutoff)) map[id] = null;
      });
    });
    node.statusAt = node.statusAt || {};
    Object.keys(node.statusAt).forEach((id) => {
      if (!survives(node.statusAt[id], cutoff)) delete node.statusAt[id];
    });
    Object.values(node.reportGone || {}).forEach((keys) => {
      Object.keys(keys || {}).forEach((k) => {
        if (!survives(keys[k], cutoff)) delete keys[k];
      });
    });
    node.commentAt = node.commentAt || {};
    Object.keys(node.taskComments || {}).forEach((id) => {
      if (survives(node.commentAt[id], cutoff)) return;
      delete node.taskComments[id];
      delete node.commentAt[id];
    });
    Object.keys(node.reports || {}).forEach((id) => {
      const kept = (node.reports[id] || []).filter((en) => survives(en.at, cutoff));
      if (kept.length) node.reports[id] = kept; else delete node.reports[id];
    });
    if (node.note && !survives(node.noteAt, cutoff)) { node.note = ''; node.noteAt = null; }
    if (node.issue && !survives(node.issueAt, cutoff)) { node.issue = false; node.issueAt = null; }
  });
  // The punch list goes with them. It is the list of what is still wrong on
  // the foundations, so clearing the farm and keeping it would leave the crew
  // reading last campaign's defects against a blank map. Buried rather than
  // dropped, and dated past the wipe, so the other phones bury them too.
  (project.punchList || []).forEach((p) => {
    if (!p || p.deleted || survives(p.updatedAt || p.at, cutoff)) return;
    p.deleted = true;
    p.updatedAt = new Date(cutoff + 1).toISOString();
  });
}

export function mergeProjects(target, incoming) {
  // Tasks, ring tasks and inspections. Everything about them travels now:
  // the name, the colour, whether it is archived, and whether it was deleted.
  // Before, only the *existence* of a task crossed — matched by name — so a
  // recolour never left the laptop, a rename grew a duplicate on every other
  // device, and a delete or an archive was silently undone by the next sync.
  ['tasks', 'reports'].forEach((kind) => {
    Object.entries((incoming.tombstones || {})[kind] || {}).forEach(([id, at]) => {
      const t = tombstones(target, kind);
      if (!t[id] || new Date(at || 0) > new Date(t[id])) t[id] = at;
    });
  });

  const refused = [];
  // A task a full ring turns away used to simply cease to exist here — and
  // then this device pushed its own shorter list back to the team database and
  // the task was gone for everyone, with no way to ever get it back. So it
  // waits here instead, travelling with the project like everything else,
  // until somebody frees a slice and it takes its place on its own.
  target.overflow = Array.isArray(target.overflow) ? target.overflow : [];
  const park = (item, list) => {
    if (!item || !item.id) return;
    const keep = { id: item.id, name: item.name, list, updatedAt: item.updatedAt || null };
    ['color', 'color2', 'badge'].forEach((k) => { if (item[k]) keep[k] = item[k]; });
    if (item.hidden) keep.hidden = true;
    const at = (o) => new Date((o && o.updatedAt) || 0).getTime();
    const seat = target.overflow.findIndex((o) => o && o.id === keep.id);
    if (seat < 0) target.overflow.push(keep);
    else if (at(keep) > at(target.overflow[seat])) target.overflow[seat] = keep;
  };

  const mergeItems = (fromList, toList, maxLen, kind, drop, listName) => {
    const map = {};
    const gone = tombstones(target, kind);
    // Bury first, then add. The other way round, a device replacing a full
    // list of eight could not receive the replacement: the new tasks were
    // refused for lack of room by the very tasks they were replacing, which
    // were only removed afterwards.
    for (let i = toList.length - 1; i >= 0; i -= 1) {
      if (gone[toList[i].id]) { drop(toList[i]); toList.splice(i, 1); }
    }
    (fromList || []).forEach((item) => {
      if (!item || !item.id) return;
      // Buried here, and untouched there since: stay buried. But a task
      // deliberately re-created afterwards carries a newer date, and it must
      // be allowed back — ids are derived from the name, so re-adding a task
      // someone deleted last month lands on the very same id and used to be
      // refused for a month with no way to tell why.
      if (gone[item.id]) {
        if (new Date(item.updatedAt || 0).getTime() <= new Date(gone[item.id]).getTime()) return;
        delete gone[item.id];
      }
      let match = toList.find((t) => t.id === item.id)
        // an item created independently on two devices has two ids and one
        // name; the name is all we have to recognise it by
        || toList.find((t) => t.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (!match) {
        // A ring holds a fixed number of slices. A file bringing more than
        // fits used to be trimmed here without a word, and the ticks that
        // belonged to the refused tasks then landed nowhere — the map came
        // out mostly empty and nothing said why.
        if (toList.length >= maxLen) {
          refused.push(item.name || item.id);
          if (listName) park(item, listName);
          return;
        }
        match = { id: item.id, name: item.name, color: item.color, updatedAt: item.updatedAt };
        if (item.color2) match.color2 = item.color2;
        if (item.badge) match.badge = item.badge;
        if (item.hidden) match.hidden = true;
        toList.push(match);
        map[item.id] = match.id;
        return;
      }
      const tAt = new Date(match.updatedAt || 0).getTime();
      const iAt = new Date(item.updatedAt || 0).getTime();
      if (iAt > tAt) {
        match.name = item.name;
        if (item.color) match.color = item.color;
        if (item.color2) match.color2 = item.color2; else delete match.color2;
        if (item.badge) match.badge = item.badge; else delete match.badge;
        if (item.hidden) match.hidden = true; else delete match.hidden;
        match.updatedAt = item.updatedAt;
      }
      map[item.id] = match.id;
    });
    // anything buried by a tombstone that only arrived in this same payload
    for (let i = toList.length - 1; i >= 0; i -= 1) {
      if (gone[toList[i].id]) { drop(toList[i]); toList.splice(i, 1); }
    }
    return map;
  };

  const dropTask = (item) => {
    (target.nodes || []).forEach((n) => {
      TIERS.forEach((t) => { if (n[t.key]) delete n[t.key][item.id]; });
      delete n.taskComments[item.id];
      delete (n.commentAt || {})[item.id];
      delete (n.statusAt || {})[item.id];
    });
    if (target.procedures) delete target.procedures[item.id];
  };
  const dropReport = (item) => {
    (target.nodes || []).forEach((n) => {
      delete n.reports[item.id];
      delete (n.reportGone || {})[item.id];
    });
  };

  // whatever the other device had waiting joins ours before anything is placed
  (Array.isArray(incoming.overflow) ? incoming.overflow : [])
    .forEach((o) => { if (o && o.id && tierByList(o.list)) park(o, o.list); });

  const catMap = mergeItems(incoming.categories, target.categories, MAX_CATEGORIES, 'tasks', dropTask, 'categories');
  const microMap = mergeItems(incoming.microVars, target.microVars, MAX_MICRO, 'tasks', dropTask, 'microVars');
  const outerMap = mergeItems(incoming.outerVars, target.outerVars, MAX_OUTER, 'tasks', dropTask, 'outerVars');
  const reportMap = mergeItems(incoming.reportTypes, target.reportTypes, 99, 'reports', dropReport, null);

  // Somebody has freed a slice: the first task that has been waiting for one
  // walks in by itself, and the work already kept aside for it lights up with
  // it. Oldest first, so every device seats them in the same order.
  placeWaiting(target);
  pruneTombstones(target);
  target.nodes.forEach((n) => normalizeNode(n, target));

  // The order of the tasks, and which ring each is drawn in, is ONE layout
  // decision rather than a bag of independent facts — the same call as the
  // cable drawing. Most recently arranged wins. Two admins rearranging at the
  // same moment means one of them loses their arrangement, which is the price
  // of everyone seeing the same dial.
  const inOrderAt = new Date(incoming.tasksOrderedAt || 0).getTime();
  if (inOrderAt > new Date(target.tasksOrderedAt || 0).getTime()) {
    const idMap = Object.assign({}, catMap, microMap, outerMap);
    const byId = {};
    allTaskItems(target).forEach((it) => { byId[it.id] = it; });
    const placed = new Set();
    const next = {};
    TIERS.forEach((t) => { next[t.list] = []; });
    TIERS.forEach((t) => {
      (incoming[t.list] || []).forEach((it) => {
        const tid = idMap[it.id] || it.id;
        if (!byId[tid] || placed.has(tid)) return;
        next[t.list].push(byId[tid]);
        placed.add(tid);
      });
    });
    // a task this device has that the other side never saw keeps its place
    TIERS.forEach((t) => {
      tierList(target, t).forEach((it) => {
        if (placed.has(it.id)) return;
        next[t.list].push(it);
        placed.add(it.id);
      });
    });
    if (TIERS.every((t) => next[t.list].length <= t.max)) {
      TIERS.forEach((t) => { target[t.list] = next[t.list]; });
      target.tasksOrderedAt = incoming.tasksOrderedAt;
      target.nodes.forEach((n) => normalizeNode(n, target));
    }
  }

  // The wipe travels as a date, so a site cleared on one phone is cleared
  // everywhere the moment that phone syncs.
  //
  // It used to be merged by keeping the LATER of the two dates, which made a
  // wipe impossible to undo: the date sat in the team database for ever and
  // came back at every sync. Import a season of work after a wipe and the map
  // filled up, then emptied itself a minute later — the wipe outranked a
  // decision taken after it.
  //
  // So what travels is the DECISION and when it was taken, like everything
  // else here. Clearing the site is one decision; taking in a file older than
  // the wipe is another, and the more recent one wins. Devices that predate
  // this field send nothing, and for them the old rule still applies.
  const tSet = new Date(target.clearedAtSet || 0).getTime();
  const iSet = new Date(incoming.clearedAtSet || 0).getTime();
  let cut;
  if (tSet || iSet) {
    const winner = iSet > tSet ? incoming : target;
    cut = new Date(winner.clearedAt || 0).getTime();
    if (winner.clearedAt) target.clearedAt = winner.clearedAt;
    else delete target.clearedAt;
    target.clearedAtSet = new Date(Math.max(tSet, iSet)).toISOString();
  } else {
    cut = Math.max(
      new Date(target.clearedAt || 0).getTime(),
      new Date(incoming.clearedAt || 0).getTime(),
    );
    if (cut) target.clearedAt = new Date(cut).toISOString();
  }
  if (cut) applyClear(target, cut);

  const newer = (a, b) => {
    if (!a) return b || null;
    if (!b) return a;
    return new Date(b.at || 0).getTime() > new Date(a.at || 0).getTime() ? b : a;
  };

  // Where a fact arriving from another device lands on this one. Normally on
  // the task it belongs to, recognised through the maps above.
  //
  // But when this device does not know that task — a full ring refused it, or
  // it simply has not arrived yet — the tick, the comment, the inspection
  // used to be dropped right here, silently. That is how a season of work
  // came back as an empty map: the tasks were turned away for lack of room,
  // and every tick that named one went with them without a word.
  //
  // So the fact is kept under the name it arrived with instead. Nothing draws
  // it while its task is missing, and it lights up on its own the day the task
  // appears — task ids are derived from the task name, so the two always find
  // each other again. Only a task somebody deliberately deleted stays dropped:
  // a tombstone is a decision, and this must not undo it.
  const heldIds = new Set();
  const heldFor = (maps, kind) => (id) => {
    const known = maps.reduce((v, m) => v || m[id], null);
    if (known) return known;
    if (tombstones(target, kind)[id]) return null;
    heldIds.add(id);
    return id;
  };
  const taskLanding = heldFor([catMap, microMap, outerMap], 'tasks');
  const reportLanding = heldFor([reportMap], 'reports');
  const heldNodes = new Set();

  (incoming.nodes || []).forEach((inNode) => {
    const tNode = target.nodes.find((n) => n.label === inNode.label);
    // A foundation this device has never heard of. Nothing sensible can be
    // done with its work, but going quiet about it is how "half the map is
    // empty" turns into a mystery — so it is counted and reported.
    if (!tNode) { if (inNode && inNode.label) heldNodes.add(inNode.label); return; }
    // A tick travels by the date it last CHANGED, not by the date written on
    // the tick. Unticking left nothing behind for the union to see, so the
    // other phone posted the tick straight back a couple of seconds later.
    tNode.statusAt = tNode.statusAt || {};
    Object.entries(inNode.statusAt || {}).forEach(([id, at]) => {
      const tid = taskLanding(id);
      if (!tid || !survives(at, cut)) return;
      if (new Date(at || 0).getTime() <= new Date(tNode.statusAt[tid] || 0).getTime()) return;
      const bucket = bucketFor(tNode, tid);
      bucket[tid] = TIERS.reduce((v, t) => v || (inNode[t.key] || {})[id], null) || null;
      tNode.statusAt[tid] = at;
    });
    // written before ticks carried a date: union, as it used to be — but only
    // where no dated decision of ours stands in the way
    const mergeStampMap = (map) => {
      Object.entries(map || {}).forEach(([id, stamp]) => {
        const tid = taskLanding(id);
        if (!tid || (inNode.statusAt || {})[id]) return;
        if (stamp && !survives(stamp.at, cut)) return; // erased by a wipe
        const mine = new Date(tNode.statusAt[tid] || 0).getTime();
        if (mine && !(stamp && new Date(stamp.at || 0).getTime() > mine)) return;
        const bucket = bucketFor(tNode, tid);
        bucket[tid] = newer(bucket[tid], stamp);
      });
    };
    TIERS.forEach((t) => mergeStampMap(inNode[t.key]));
    // Comments are walked by their date, not by their text, because erasing
    // one leaves no text to walk — and the other device would post it back.
    tNode.commentAt = tNode.commentAt || {};
    Object.entries(inNode.commentAt || {}).forEach(([id, at]) => {
      const tid = taskLanding(id);
      if (!tid || !survives(at, cut)) return;
      if (new Date(at || 0).getTime() <= new Date(tNode.commentAt[tid] || 0).getTime()) return;
      const text = (inNode.taskComments || {})[id] || '';
      if (text) tNode.taskComments[tid] = text; else delete tNode.taskComments[tid];
      tNode.commentAt[tid] = at;
    });
    // written before comments carried a date: union by text, as it used to be
    Object.entries(inNode.taskComments || {}).forEach(([id, comment]) => {
      const tid = taskLanding(id);
      if (!tid || !comment) return;
      if ((inNode.commentAt || {})[id] || tNode.commentAt[tid]) return;
      if (!survives(null, cut)) return;
      const merged = pickText(tNode.taskComments[tid], comment);
      if (merged) tNode.taskComments[tid] = merged;
    });
    // Report occurrences stay a union — two techs each recording one offline
    // must both count — so a removed one is remembered by name instead.
    tNode.reportGone = tNode.reportGone || {};
    Object.entries(inNode.reportGone || {}).forEach(([id, keys]) => {
      const tid = reportLanding(id);
      if (!tid) return;
      const mine = tNode.reportGone[tid] = tNode.reportGone[tid] || {};
      Object.entries(keys || {}).forEach(([key, at]) => {
        if (!survives(at, cut)) return;
        if (!mine[key] || new Date(at || 0).getTime() > new Date(mine[key]).getTime()) mine[key] = at;
      });
    });
    Object.entries(inNode.reports || {}).forEach(([id, entries]) => {
      const tid = reportLanding(id);
      if (!tid) return;
      const existing = tNode.reports[tid] || [];
      const seen = new Set(existing.map((en) => `${en.at}|${en.by}`));
      (entries || []).forEach((en) => {
        if (!survives(en.at, cut)) return;
        const key = `${en.at}|${en.by}`;
        if (!seen.has(key)) { existing.push(en); seen.add(key); }
      });
      existing.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
      if (existing.length) tNode.reports[tid] = existing;
    });
    // and anything either side has since taken back
    Object.entries(tNode.reportGone).forEach(([tid, keys]) => {
      if (!tNode.reports[tid]) return;
      const kept = tNode.reports[tid].filter((en) => !keys[`${en.at}|${en.by}`]);
      if (kept.length) tNode.reports[tid] = kept; else delete tNode.reports[tid];
    });
    // A blocking point is a decision, and unticking one is as real a decision
    // as ticking it — dated, so the later one wins instead of "once flagged,
    // flagged forever". Undated flags from older data still merge as a union.
    const inIssueAt = new Date(inNode.issueAt || 0).getTime();
    const tIssueAt = new Date(tNode.issueAt || 0).getTime();
    if (inIssueAt > tIssueAt) {
      if (survives(inNode.issueAt, cut)) {
        tNode.issue = !!inNode.issue;
        tNode.issueAt = inNode.issueAt;
      }
    } else if (inNode.issue && !tIssueAt && survives(inNode.issueAt, cut)) {
      tNode.issue = true;
    }
    // Same for the note: emptying one is an edit, so the dates decide. Two
    // notes written offline at the same moment still fall back to the old
    // "longest text wins", which both devices agree on without talking.
    const inNoteAt = new Date(inNode.noteAt || 0).getTime();
    const tNoteAt = new Date(tNode.noteAt || 0).getTime();
    if (survives(inNode.noteAt, cut)) {
      if (inNoteAt > tNoteAt) {
        tNode.note = inNode.note || '';
        tNode.noteAt = inNode.noteAt;
      } else if (!inNoteAt && !tNoteAt) {
        tNode.note = pickText(tNode.note, inNode.note);
      }
    }
  });

  // One toolbox talk per day, so the id is the day: two devices writing the
  // same day's talk land on the same entry and the later one wins.
  target.tbts = target.tbts || [];
  (incoming.tbts || []).forEach((t) => {
    if (!t || !t.id) return;
    const mine = target.tbts.find((x) => x.id === t.id);
    if (!mine) { target.tbts.push(t); return; }
    if (new Date(t.updatedAt || 0).getTime() > new Date(mine.updatedAt || 0).getTime()) {
      mine.text = t.text; mine.by = t.by; mine.deleted = !!t.deleted; mine.updatedAt = t.updatedAt;
    }
  });
  // Recaps are a log: each one already went out to the channel, so they are
  // unioned by id and never rewritten.
  target.recaps = target.recaps || [];
  const seenRecaps = new Set(target.recaps.map((r) => r.id));
  (incoming.recaps || []).forEach((r) => {
    if (!r || !r.id || seenRecaps.has(r.id)) return;
    target.recaps.push(r); seenRecaps.add(r.id);
  });
  target.recaps.sort((a2, b2) => new Date(b2.at || 0) - new Date(a2.at || 0));
  target.recaps = target.recaps.slice(0, RECAP_KEEP);

  const byId = new Map(target.punchList.map((p) => [p.id, p]));
  const byText = new Map(target.punchList.map((p) => [p.text, p]));
  (incoming.punchList || []).forEach((p) => {
    const existing = byId.get(p.id) || byText.get(p.text);
    if (!existing) {
      target.punchList.push(p);
      byId.set(p.id, p);
      byText.set(p.text, p);
      return;
    }
    const tExisting = new Date(existing.updatedAt || existing.at || 0).getTime();
    const tIncoming = new Date(p.updatedAt || p.at || 0).getTime();
    if (tIncoming > tExisting) {
      existing.done = !!p.done;
      existing.deleted = !!p.deleted;
      existing.doneBy = p.doneBy || null;
      existing.updatedAt = p.updatedAt;
    }
  });

  Object.entries(incoming.procedures || {}).forEach(([id, proc]) => {
    // reportMap included: an inspection carries a method statement too, and
    // without it every instruction written on one was dropped on arrival
    const tid = catMap[id] || microMap[id] || outerMap[id] || reportMap[id];
    if (!tid) return;
    const tProc = getProcedure(target, tid);
    // Read every "changed" stamp BEFORE the loop below raises them to
    // whichever side is newer — asked afterwards they all answer "same".
    const heldAt = {};
    Object.keys(tProc.sectionUpdated || {}).forEach((k) => {
      heldAt[k] = new Date(tProc.sectionUpdated[k] || 0).getTime();
    });
    // Each written part is one paragraph somebody rewrites, and it is dated.
    // Keeping the longer side — as this did — cannot express a deletion: an
    // admin who removed a step got it back from the other phone. Newest wins;
    // with no date on either side the old rule stands, so nothing changes for
    // instructions untouched since this shipped.
    PROC_TEXT_KEYS.forEach((k) => {
      const iAt = new Date(((proc && proc.sectionUpdated) || {})[k] || 0).getTime();
      const tAt = heldAt[k] || 0;
      if (iAt > tAt) tProc[k] = (proc && proc[k]) || '';
      else if (!iAt && !tAt) tProc[k] = pickText(tProc[k], proc && proc[k]);
    });
    const consAtBefore = heldAt.consumables || 0;
    // keep the most recent "changed" stamp per section so every device
    // flags the same updates
    const inStamps = (proc && proc.sectionUpdated) || {};
    Object.keys(inStamps).forEach((k) => {
      const a = new Date(tProc.sectionUpdated[k] || 0).getTime();
      const bTime = new Date(inStamps[k] || 0).getTime();
      if (bTime > a) { tProc.sectionUpdated[k] = inStamps[k]; tProc.updatedBy = proc.updatedBy || tProc.updatedBy; }
    });
    // How long the task takes and how many people it needs: one fact each,
    // so newest wins on the pair. The stamp is the one the editor writes.
    const effortAtBefore = heldAt.effort || 0;
    // Consumables travel as a block, most recently edited wins — the same
    // rule as the cable layout, and for the same reason.
    //
    // They used to be unioned by name, which cannot express a removal: an
    // admin who deleted a line got it back from the other device two seconds
    // later, and an admin who *renamed* one ended up with both names, because
    // the old one still existed on the other side and the union re-added it.
    // A picking list is one list, not a bag of independent facts.
    //
    // The stamp is the one the editor already writes on every change
    // (markProcedureChanged → sectionUpdated.consumables), so nothing new has
    // to be recorded for this to work. With no stamp on either side neither
    // list has been touched since this shipped: keep what is already here.
    const inEffortAt = new Date((proc.sectionUpdated || {}).effort || 0).getTime();
    if (inEffortAt > effortAtBefore || (!tProc.minutes && proc && proc.minutes)) {
      if (proc && proc.minutes) tProc.minutes = proc.minutes; else delete tProc.minutes;
      if (proc && proc.people) tProc.people = proc.people; else delete tProc.people;
    }
    if (Array.isArray(proc && proc.consumables)) {
      tProc.consumables = tProc.consumables || [];
      const iAt = new Date((proc.sectionUpdated || {}).consumables || 0).getTime();
      if (iAt > consAtBefore || !tProc.consumables.length) {
        tProc.consumables = proc.consumables
          .filter((c) => c && c.name)
          .map((c) => ({ name: c.name, restock: !!c.restock }));
      }
    }
  });

  // Cables. These were not merged at all before, which is why a routing
  // corrected on the laptop never reached the phones and looked like a
  // browser-cache problem.
  //
  // They travel as a block, not edge by edge. Merging them one by one gives a
  // map that is neither device's — the union of two different routings — and
  // there is no way to remove a cable the other phone keeps putting back.
  // A cable layout is one drawing: the most recently edited one wins whole.
  // Endpoints are matched by foundation label, because node ids are minted
  // per device and mean nothing on the other side.
  if (Array.isArray(incoming.connections)) {
    const tAt = new Date(target.cablesAt || 0).getTime();
    const iAt = new Date(incoming.cablesAt || 0).getTime();
    // no stamp on either side: neither has been touched since this shipped,
    // so keep what is already here rather than shuffling the map about
    if (iAt > tAt) {
      const labelOf = {};
      (incoming.nodes || []).forEach((n) => { labelOf[n.id] = n.label; });
      const idOf = {};
      target.nodes.forEach((n) => { idOf[n.label] = n.id; });
      const rebuilt = [];
      const seen = new Set();
      incoming.connections.forEach((c) => {
        const a = idOf[labelOf[c.a]];
        const b = idOf[labelOf[c.b]];
        if (!a || !b || a === b) return;
        const key = [a, b].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const next = { id: c.id || uid(), a, b };
        if (typeof c.string === 'number') next.string = c.string;
        if (Array.isArray(c.bends) && c.bends.length) {
          next.bends = c.bends
            .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
            .map((p) => ({ x: p.x, y: p.y }));
          if (!next.bends.length) delete next.bends;
        }
        rebuilt.push(next);
      });
      target.connections = rebuilt;
      target.cablesAt = incoming.cablesAt;
    }
  }

  // permits to work: union by id, most recently touched wins, and a closed
  // permit stays closed — the other phone must not reopen it
  if (Array.isArray(incoming.permits)) {
    target.permits = target.permits || [];
    const byId = {};
    target.permits.forEach((p) => { byId[p.id] = p; });
    incoming.permits.forEach((p) => {
      if (!p || !p.id) return;
      const t = byId[p.id];
      if (!t) { target.permits.push(JSON.parse(JSON.stringify(p))); byId[p.id] = p; return; }
      const tAt = new Date(t.updatedAt || t.at || 0).getTime();
      const iAt = new Date(p.updatedAt || p.at || 0).getTime();
      if (iAt > tAt) Object.assign(t, JSON.parse(JSON.stringify(p)));
      // closing always wins over an edit, whichever way the clocks fell
      if (p.deleted) { t.deleted = true; t.deletedAt = t.deletedAt || p.deletedAt; }
    });
  }

  // who has read which method statement. This used to live in localStorage,
  // so the same person opening the app on their phone was told again about an
  // instruction they had already read on the laptop. It is per person, and
  // the later reading wins.
  if (incoming.procSeen && typeof incoming.procSeen === 'object') {
    target.procSeen = target.procSeen || {};
    Object.entries(incoming.procSeen).forEach(([who, seen]) => {
      if (!seen || typeof seen !== 'object') return;
      target.procSeen[who] = target.procSeen[who] || {};
      Object.entries(seen).forEach(([itemId, at]) => {
        const t = new Date(target.procSeen[who][itemId] || 0).getTime();
        if (new Date(at || 0).getTime() > t) target.procSeen[who][itemId] = at;
      });
    });
  }

  // and which PART of each one they have looked at. Same rule, one level
  // deeper. A device still running the previous build simply does not send
  // this map; nothing here invents an entry it did not have.
  if (incoming.procSeenParts && typeof incoming.procSeenParts === 'object') {
    target.procSeenParts = target.procSeenParts || {};
    Object.entries(incoming.procSeenParts).forEach(([who, byItem]) => {
      if (!byItem || typeof byItem !== 'object') return;
      target.procSeenParts[who] = target.procSeenParts[who] || {};
      Object.entries(byItem).forEach(([itemId, parts]) => {
        if (!parts || typeof parts !== 'object') return;
        const tid = catMap[itemId] || microMap[itemId] || outerMap[itemId]
          || reportMap[itemId] || itemId;
        const held = target.procSeenParts[who][tid] || {};
        Object.entries(parts).forEach(([key, at]) => {
          if (new Date(at || 0).getTime() > new Date(held[key] || 0).getTime()) held[key] = at;
        });
        target.procSeenParts[who][tid] = held;
      });
    });
  }

  // What this merge could not place, for the caller to say out loud. A sync
  // that quietly swallows work is the one bug nobody can report, because
  // there is nothing to see: the map simply comes out emptier than the day.
  mergeProjects.refused = refused;                  // tasks turned away, rings full
  mergeProjects.held = [...heldIds];                // work kept aside, waiting for its task
  mergeProjects.unknownNodes = [...heldNodes];      // foundations this device does not have

  // strings SRCC: the most recent change wins.
  // This used to OR the two flags "to stay on the safe side", which made the
  // flag impossible to clear: the other device's stale "true" switched it
  // straight back on at the next sync, so lifting an SRCC never stuck.
  if (Array.isArray(incoming.strings)) {
    target.strings = target.strings || defaultStrings();
    incoming.strings.forEach((s, i) => {
      const t = target.strings[i];
      if (!t || !s) return;
      const tAt = new Date(t.srccAt || 0).getTime();
      const sAt = new Date(s.srccAt || 0).getTime();
      if (sAt > tAt) { t.srcc = !!s.srcc; t.srccAt = s.srccAt; }
      else if (!tAt && !sAt) t.srcc = t.srcc || !!s.srcc; // both untouched: keep the old behaviour
    });
  }
  // The access rules are one paragraph an admin rewrites, not a bag of facts.
  // They used to be merged by keeping whichever side was LONGER, which cannot
  // express "I took that line out": the other device posted the old, longer
  // paragraph straight back, and the edit looked like it had never saved.
  // Dated now, most recent wins. Without a date on either side the old rule
  // stands, so a device that has never edited them changes nothing.
  {
    const tAt = new Date(target.accessRulesAt || 0).getTime();
    const iAt = new Date(incoming.accessRulesAt || 0).getTime();
    if (iAt > tAt) {
      target.accessRules = incoming.accessRules || '';
      target.accessRulesAt = incoming.accessRulesAt;
    } else if (!tAt && !iAt) {
      target.accessRules = pickText(target.accessRules, incoming.accessRules);
    }
  }

  // annotations: union by id (keep the longer text on conflict).
  // A deletion always wins over an edit, so a note removed on one device
  // stays removed everywhere instead of being resurrected by the next pull.
  // activity log: union by id. It is append-only, so there is nothing to
  // reconcile — just merge the two trails and keep them in time order.
  target.activity = target.activity || [];
  const seenActivity = new Set(target.activity.map((e) => e.id));
  (incoming.activity || []).forEach((e) => {
    if (!e || !e.id || seenActivity.has(e.id)) return;
    seenActivity.add(e.id);
    target.activity.push(e);
  });
  trimActivity(target);

  // crew list: union by id, a removal wins, otherwise the newer edit wins
  target.team = target.team || [];
  const memberById = new Map(target.team.map((m) => [m.id, m]));
  (incoming.team || []).forEach((m) => {
    if (!m || !m.id) return;
    const found = memberById.get(m.id);
    if (!found) { target.team.push(m); memberById.set(m.id, m); return; }
    if (m.deleted) {
      found.deleted = true;
      found.deletedAt = found.deletedAt || m.deletedAt;
      return;
    }
    if (new Date(m.updatedAt || 0).getTime() > new Date(found.updatedAt || 0).getTime()) {
      found.name = m.name;
      found.admin = !!m.admin;
      found.style = m.style === 'orange' ? 'orange' : 'sky';
      found.updatedAt = m.updatedAt;
    }
  });

  target.annotations = target.annotations || [];
  const annById = new Map(target.annotations.map((a) => [a.id, a]));
  (incoming.annotations || []).forEach((a) => {
    const found = annById.get(a.id);
    if (!found) { target.annotations.push(a); annById.set(a.id, a); }
    else {
      found.text = pickText(found.text, a.text);
      if (a.deleted) {
        found.deleted = true;
        found.deletedAt = found.deletedAt || a.deletedAt;
      }
    }
  });

  // anonymous improvement suggestions: union by id, a deletion wins
  target.suggestions = target.suggestions || [];
  const sugById = new Map(target.suggestions.map((s) => [s.id, s]));
  (incoming.suggestions || []).forEach((s) => {
    if (!s || !s.id) return;
    const found = sugById.get(s.id);
    if (!found) { target.suggestions.push(s); sugById.set(s.id, s); }
    else if (s.deleted) { found.deleted = true; found.deletedAt = found.deletedAt || s.deletedAt; }
  });
  target.suggestions.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

  // hidden flags: keep whichever archived it (OR)
  allTaskItems(incoming).forEach((ic) => {
    const tid = catMap[ic.id] || microMap[ic.id];
    if (!tid) return;
    const titem = allTaskItems(target).find((t) => t.id === tid);
    if (titem && ic.hidden) titem.hidden = true;
  });
}

// Deterministic text merge (both devices converge to the same value):
// longer text wins, ties broken lexicographically.
export function pickText(a, b) {
  const ta = (a || '').trim();
  const tb = (b || '').trim();
  if (!tb) return ta;
  if (!ta) return tb;
  if (ta.length !== tb.length) return ta.length > tb.length ? ta : tb;
  return ta > tb ? ta : tb;
}
