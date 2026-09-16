# BopOp — Handover to the v2 rebuild

Frozen reference: tag `v1-reference` (commit `c532e62`), 63 merges on `master`, PRs #20–#70.
Everything below is drawn from that code and that history. Anything I could not verify from
either is marked **to verify**.

---

## 0. Launch prompt — read this first

> You are rebuilding BopOp from zero. A crew of offshore wind technicians uses v1 every day;
> v2 must be better on their first morning with it, and never lose a day's work.
>
> 1. Read this whole dossier and `sample-data.json` before writing anything.
> 2. Then ask me **every** question you have, in one batch, before any code. If something is
>    unclear, ambiguous or missing, ask — the point is to get it right from the start, not to
>    guess well. I would rather answer twenty questions once than find a wrong assumption in
>    week three.
> 3. Get my approval on (a) your plan and (b) mockups of the key screens, before building them.
> 4. Build in phases. Stop at the end of each phase so I can test on a real device.
> 5. Build only what is asked. Ideas beyond it are welcome — propose them, don't ship them.
> 6. Section 8 is a recommendation, not an order. Depart from it where you have a better
>    answer, and say why.
>
> **The old code.** A read-only archive is at
> `https://github.com/rthque/BopOp/archive/refs/tags/v1-reference.zip`. Open it only to check a
> specific rule this dossier cites, or to write the v1 import. Never read it wholesale, never
> copy its code, never inherit its data model — v1's model is the thing being replaced. If the
> archive and this dossier disagree, stop and ask me. v2 lives in a **new repository**; nothing
> is committed to the v1 repo.
>
> **Language.** Code, data, docs and default UI in English. French is one button away (§8.6).
>
> **Non-negotiable.** Reliability first: no silent data loss, ever. Where reliability and any
> other goal conflict, reliability wins and you say so. Everything else is a balance you argue
> for.

---

## 1. Why this exists, and what it taught

I am a BOP team leader on the Dieppe–Le Tréport offshore wind farm (62 foundations + one
offshore substation). BopOp answers two daily questions the paper board could not: **where is
every task on every foundation**, and **where is the project knowledge** — method statements,
tools and consumables, cable strings and restricted-access flags, permits.

| Phase | PRs | What happened |
|---|---|---|
| Build the board | #20–#28 | Dial per foundation, three task rings, map with cables. A map editor (add foundations, draw cables) was built and then **removed** — the farm is built, the map is read, not drawn (#27). |
| Make it shared | #29–#31 | Crew password checked against a hosted auth service; one shared account for everyone. |
| Make sync survive deletion | #32, #34 | The first real lesson (§5.1). |
| Transcribe the real work | #33, #38, #46 | The paper wall board of 19/07/26 became the task list; three rings 8/16/32; second colour + badge so 56 tasks stay distinguishable. |
| Make it operational | #39, #50, #56, #57 | Toolbox talk of the day, work-hours per foundation, a fourth "in progress" state, punch items tied to their foundation. |
| Bilingual | #60 | One flag button. **Only the static page was translated**; strings built by code and the task names themselves are still English-only. Unfinished. |
| The bad week | #61–#67 | A season of work imported from WhatsApp debriefs kept vanishing. Four distinct root causes, one family (§5.1). |
| Repair the foundations | #68–#70 | Dead editor removed; the merge engine extracted from the 7 000-line file so it can be tested in milliseconds; cables nudgeable again, behind a switch. |

**What worked.** Dial-per-foundation as the primary view — the crew reads it without training.
Dated decisions as the merge rule. A test suite in the repo running on every PR (#42), which is
the only reason the last ten changes did not each break two earlier ones.

**What failed.** (a) The data model grew by accretion inside one file, so every new field had to
be remembered in three places. (b) Sync was invented incrementally instead of designed once
(§5.1). (c) Offline was never actually built — see §5.3; calling it a failure is fair, but it
failed by never existing, not by breaking. (d) Bilingual was started and left half done.

---

## 2. Field use

| | |
|---|---|
| **Who** | ~4–8 people. Three roles: visitor (read-only), technician (records work), admin (edits project knowledge). |
| **Where** | On the foundation, on the crew transfer vessel, and at the office desk. |
| **When** | Ticking happens during the job; the debrief and the toolbox talk at the start and end of the shift. |
| **Devices** | Phones and tablets (Chrome / Chrome-based), and desktop Chrome at the office. One engine only is fine. |
| **Conditions** | Moving deck, gloves, direct sun. Large touch targets and high contrast are requirements, not taste. |
| **Network** | Stable on the foundation and on the vessel. Offline is the exception, not the design centre. |

---

## 3. Feature inventory

Role column: **V** visitor, **T** technician, **A** admin. Verdict: **keep** as is, **improve**,
**drop**. Every control present in `index.html` at `v1-reference` is listed.

### The map

| Feature | Role | Business rules | Verdict |
|---|---|---|---|
| Dial per foundation | V T A | 8 centre slices, 16 first ring, 32 second ring. Each slice is one task. A slice is drawn filled only when that task has a state. | **keep** — this is the product |
| Four tick states | T A | not done / in progress / partially done / done. `stampState()`. In progress = someone is on it now; counts **zero** toward work-hours and stays in "what is left" (#56). | **keep** |
| Second colour + badge | A | `item.color2` drawn as dots, `item.badge` = 1–2 emoji/letters, both only on a filled slice, clipped to it (#46). | **keep** |
| Grid outline on every slice | — | Drawn even where nothing is done. Removed in #40, restored in #41: without it the dial stops reading as a dial. **Do not re-litigate.** | **keep** |
| Substation (OSS) | V T A | Not one of the 62. Drawn at its real position and deliberately **not** scaled with the dials — it sits 117 world units from its nearest foundation where no two foundations are closer than 192. | **keep** |
| Cables + string numbers | V T A | 8 strings; every segment carries its string index; number drawn at the midpoint of the drawn route. | **keep** |
| SRCC flag per string | A | Turns that string's cable red and surfaces the restricted-access rules. | **keep** |
| Adjust the cables | A | Off by default. When on, dragging a cable adds an elbow (max 2); pulling the elbow back onto the straight line removes it (#70). | **improve** — see §11 Q3 (freeze) |
| Pan / pinch / wheel zoom | V T A | Camera clamped to the farm's bounding box. | **keep** |
| Map notes | V T A | Existing notes are drawn and synced; **the editor was removed** (#68). | **drop** the editor, **keep** rendering **to verify** any note actually exists in production |

### The foundation sheet

| Feature | Role | Business rules | Verdict |
|---|---|---|---|
| Task checklist | T A | Three groups matching the three rings; per-task state + free comment. | **keep** |
| Check all / uncheck all | T A | One control for the whole foundation (#21). | **keep** |
| Inspections (repeatable) | T A | Counted as dated occurrences, not a boolean. Removing one occurrence is remembered by name. | **keep** |
| Note + blocking point | T A | One free note and one "blocked" flag per foundation, both dated. | **keep** |
| Punch item | T A | Always attached to a foundation — adding one "on the fly" was tried and **cancelled** (#57). | **keep** |
| Copy 12 h recap | T A | Builds the WhatsApp debrief text for that foundation, or for the whole farm. | **improve** — see §11 Q5 |
| Work-hours + % | V T A | `minutes × people` per task. Partial counts half; in progress counts zero; untimed tasks are excluded from **both** sides of the ratio and the count is shown (#50). | **keep** |
| Substation sheet | T A | One free-text box only, no ticks (#58). | **keep** |

### Project knowledge (left panel)

| Feature | Role | Business rules | Verdict |
|---|---|---|---|
| Task list, 3 tiers | A | Rename, recolour, badge, archive, reorder, move between rings. Order **is** the slice order and travels. A full ring shows `16/16 — full` and cannot be chosen (#48). | **keep** |
| Additional inspections | A | Same method-statement machinery as tasks (#52). | **keep** |
| Method statements | T reads, A writes | Per task and per inspection. Sections: communication/report, method, tools & consumables, PPE & training — each in EN and FR separately. An inspection has **one** box instead (#55) and **no** time/crew field. | **keep** |
| Unread badge | T A | Marks the **section** that changed, clears per person once they have had it in view (½ visible, 0.75 s) (#53). Two maps: whole-sheet and per-section (`procSeen`, `procSeenParts`). | **keep**, simplify the two-map split |
| Tools & consumables | A | Travels as a block, last editor wins — a union by name cannot say "remove this" (#48). | **keep the rule**, §5.2 |
| Permits to work | T A | BOP / SAP / CTV + number + SRCC flag. Closing is a decision that always beats an edit. | **keep** |
| Strings + SRCC | A | 8 strings, restricted-access rules text is dated (#54). | **keep** |
| Legend | V T A | Colour key for the tasks. | **keep** |

### Day-to-day (right panel)

| Feature | Role | Business rules | Verdict |
|---|---|---|---|
| Toolbox talk (day by day) | T A | One per day, id is the day; archiving is automatic (#39). | **keep** |
| Recaps sent | T A | Log of what went out to WhatsApp, kept verbatim. | **keep** |
| Prepare & fill (day plan) | T A | Tick tomorrow's tasks, get the consolidated tools/consumables list. **Stored per device, never synced.** | **improve** — should be shared |
| Export CSV / export JSON | V T A | Full record out. | **keep** |
| Import JSON | A | Three ways in: MERGE, REPLACE, or cancel (#62). REPLACE keeps the 62 foundations and the cables even when the file is silent about them (#62, #65). | **improve** — §9 |
| "This device is the reference" | A | Authoritative push: skips the pre-merge and overwrites the shared copy (#64). | **drop** — a symptom of §5.1, not a feature |
| Activity log | T A | Two tabs: work on site, and app settings (#59). | **keep** |
| Suggestions box | V T A | Anonymous. | **keep** |
| Crew list | A | Names on the front door; who is an admin. | **keep** |
| Clear every foundation | A | Wipes ticks/comments/inspections/notes/blocking points on all 62. Tasks, method statements, crew and cables untouched. Stored as a **date**, not a deletion. | **keep**, §5.1 |
| Guide | V T A | In-app tour. | **improve** |
| Theme (auto/light/dark) | V T A | Per device. | **keep** |
| Language flag | V T A | Per device, top right (#60). | **improve** — finish it, §8.6 |
| Projects (new/rename/delete) | A | Multi-project machinery exists but one project is used. The project **name is the sync address** — renaming strands the data. | **drop** or make the name cosmetic |

---

## 4. Data

The split below is the single most important idea to carry into v2: **project knowledge** is what
the farm *is*; **progress** is what we *did to it*. v1 mixes both in one JSON blob
(`createEmptyProject()`, `app.js`). One example of each is in `sample-data.json`.

### Project knowledge — changes rarely, edited by admins

| Entity | Key fields | Notes |
|---|---|---|
| Farm | 62 foundations + OSS | Grid A–M × rows 1–7, real lat/lon per foundation. |
| Foundation | `label` (`"M07"`), position, `substation?` | Label is the human key and the merge key. |
| String | `n`, `srcc`, ordered list of segments | 8 strings, each walking outward from the substation (`app/farm.js`). |
| Cable segment | endpoints (by label), `string` index, `bends[]` | The whole layout is **one drawing**, dated `cablesAt`. |
| Access rules | free text, dated | Shown when a string is SRCC. |
| Task | `id`, `name`, `color`, `color2?`, `badge?`, `hidden?`, tier, order | `id` is derived from the name (`task-<slug>`), which is why a rename on two devices converges. 56 tasks across 3 tiers. |
| Inspection type | `id`, `name` | Repeatable; counted, not ticked. |
| Method statement | per task/inspection; `comm_*`, method, `tools_*`, `ppe_*` in EN **and** FR; `minutes`, `people`; consumables list | Sections dated individually (`sectionUpdated`). |

### Progress — changes constantly, recorded by technicians

| Entity | Key fields | Notes |
|---|---|---|
| Task state | per foundation × task → `null` \| `{at, by, wip?}` \| `{at, by, partial?}` \| `{at, by}` | Plus a **separate** map of when the state last *changed*. |
| Task comment | per foundation × task, text + date | |
| Inspection occurrence | per foundation × type, list of `{at, by}` | Union; removals remembered separately. |
| Note / blocking point | per foundation, text/bool + date | |
| Punch item | `nodeId`, `text`, `done`, `doneBy`, dated | Always tied to a foundation. |
| Permit | `kind` (BOP/SAP/CTV), `number`, `srcc`, dated | Closing always wins. |
| Toolbox talk | one per day, `id = tbt-<YYYY-MM-DD>` | |
| Recap sent | `at`, `by`, `scope`, verbatim text | Append-only log, capped. |
| Activity | `at`, `by`, `action`, `detail` | Append-only, capped at 800 entries / 180 days. |
| Read-state | who has read which method statement, and which section | Per person. Arguably neither knowledge nor progress — see §11 Q4. |

### Identifiers

Task ids derive from the task name; everything else uses a random id. This was a deliberate fix
(#20-era, documented 2026-08-01) so two devices configured separately talk about the same task.
Keep the principle — **stable, meaningful ids for project knowledge** — and make it explicit
rather than implicit in a slug function.

---

## 5. Bugs and lessons

Your impression was: browser storage, device sync, offline. The evidence **confirms sync**,
**corrects storage**, and **confirms offline with a different cause**.

Counted across PRs #20–#70: **12 bug-fix merges, 14 distinct symptoms, one family** — §5.1.
Browser storage itself caused exactly one (§5.4). Offline caused none, because it was never
built (§5.3).

### 5.1 The family: a merge that cannot express a decision *(12 merges, PRs #32–#68)*

Everything merges as a **union** — whatever exists on either side is kept — because two
technicians working apart must both come home with their work. But a union cannot say *"this was
erased"*, and it cannot say *"this was refused"*. Every bug below is that one sentence, in a
different costume.

| # | Symptom on the boat | Root cause | Fix |
|---|---|---|---|
| #32 | "Clear every foundation" undone seconds later | A wipe was an *absence*; the other phone's copy was merged back in | A wipe is a **date** on the project |
| #32 | Erasing a comment / note / blocking point undone | They carried no date at all | Stamp all three, most recent wins |
| #34 | Unticking a task came back | "Not done" is the absence of a stamp | A tick carries the date it last **changed**, separate from the date on the tick |
| #48 | A deleted consumable returned; a renamed one duplicated | Union by name | The list travels **as a block**, last editor wins |
| #48 | Moving a task to a full ring did nothing | Refusal shown for 2.6 s at the bottom of the screen | The count is on the menu option; a full ring cannot be chosen |
| #54 | A shortened text reverted to its long version | Merge kept the **longer** text, never looked at a date | Dated text, most recent wins |
| #61 | An import after a wipe silently lost 1 156 ticks | Everything older than the wipe date stopped being data | Count what the wipe would discard and say so **before** merging |
| #62 | 24 tasks instead of 48, most foundations at zero | A full ring refused tasks silently; their ticks then had nowhere to land | Say it out loud; add REPLACE as a third way in |
| #63 | Map fills on import, empties a minute later | Wipe dates merged with `max()`, so a wipe could never be undone | The **decision** and its date travel (`clearedAtSet`) |
| #64 | Random results after every sync round | Every push re-merged the server copy first, so a bad shared copy was re-mixed for ever | An explicit authoritative push |
| #65 | The 8 strings disappeared | REPLACE took a file with no cables literally | A file silent about cables is not a file saying "there are none" |
| #66 | Ticks vanish, once a minute, silently | A refused task took every tick naming it with it, and the device then pushed its shorter list back — deleting the task **for the whole crew** | Orphan work is held aside and lights up when its task arrives; refused tasks wait in a queue |
| #67 | A task from a fast-clocked phone could not be deleted | Clock-skew protection was applied to ticks only | Apply it to every dated decision |
| #68 | — | An elbow-drag handler that nothing could reach | Removed |

**The five rules that make this family impossible in v2**

1. **Every change is a decision with a server timestamp and an author.** Never infer a decision
   from the absence of data. "Not done", "erased", "emptied" are values, not gaps.
2. **Deletion is one mechanism, not four.** v1 has expiring tombstones for tasks *and* an
   absolute `deleted` flag for crew/permits/notes/suggestions. Pick one and apply it everywhere.
3. **Nothing is ever discarded silently.** If the server or the client cannot accept something,
   it says what and why, in the record and on the screen. v1 had six silent `return`s on an
   unresolvable id (fixed in #66) and one silent capacity refusal (#62).
4. **One source of truth per fact, and one writer.** The tug-of-war of #64 exists only because
   two copies both believed they were authoritative. With a server as the single truth, the
   whole family is structurally gone: there is nothing to merge.
5. **Never let two places hold the same knowledge.** v1's `mergeProjects()` and
   `projectDigest()` had to be updated in lockstep for every new field; a field merged but not
   digested was never saved and never pushed. Derive both from one declaration, or have neither.

### 5.2 A list is a whole, not a bag of facts *(#48, #65, 2026-08-01)*

Cable layout, consumables list, task order: these are **drawings**. Merging them item by item
produces something nobody drew. They travel as a block with one date, last editor wins, and that
is the right answer even though it means one of two simultaneous editors loses their edit.

### 5.3 Offline: never actually built

There is no service worker, no write queue, no conflict UI. `sync.status` has an `offline` state
that shows a chip and retries every 10 s (`scheduleSyncRetry`, `app.js`); writes stay in the
browser and are pushed whenever the connection returns. That is all. It worked by accident when
the gap was short and produced §5.1 bugs when it was not.

**v2 rule.** Network is stable on the foundation and the vessel. Treat offline as an exception:
block or clearly mark writes that cannot reach the server, show the state honestly, and never
invent a reconciliation algorithm. A short retry queue with a visible "not saved yet" marker is
enough; anything more elaborate is how §5.1 happened.

### 5.4 Browser storage: one real bug, and a structural risk

`localStorage` held the whole record under one key. The one genuine failure was quota: a full
device silently failed to save. Handled by sacrificing the daily snapshots first and warning the
user (`saveState()`, PR #20). The deeper problem is not the storage, it is that the browser was
the **only** copy: a cleared site data, a lost phone or a reinstalled browser was a total loss
until a manual export had been taken.

**v2 rule.** The browser holds nothing that matters. See §8.2.

### 5.5 Testing: the lesson that saved the rest

- Tests in the repo, CI on every PR (#42). Before that, suites lived outside the repo and were lost.
- Feature tests each passed and the app still failed in the field, because nothing walked the
  **whole path**. `the-whole-journey.spec.js` (#64) — import onto a device whose shared copy is in
  the broken state, publish, then nine seconds of real sync — is the test that finally caught it.
- A test that cannot fail on the old code proves nothing. #67's three tests were each verified by
  running them against the unfixed code first. Make that a habit, not an afterthought.
- Extracting the merge into its own module (#69) turned a 3-minute browser run into a 97 ms
  command-line run, and immediately surfaced a missing dependency that the browser suite could
  only report as "8 tests red". **Pure logic must be callable without a browser.**

At `v1-reference`: 118 browser tests (Playwright, Chromium only) + 8 unit tests (`node --test`).

---

## 6. Site structure for v2

v1 is one screen with two slide-over drawers and eleven modal overlays. It works on a phone but
everything is equally deep, and the guide exists because nobody finds anything. Proposed:

```
/                     Map — the farm, dial per foundation          V T A
  /foundation/:label  Foundation sheet: tasks, comments, inspections,
                      note, blocking point, punch, work-hours       V T A
/today                The shift: toolbox talk, day plan, recap,
                      permits open today                            V T A
/knowledge            Project knowledge
  /tasks              Task list, 3 tiers, colours, order            A edits
  /tasks/:id          Method statement (EN | FR), time & crew,
                      tools & consumables                           T reads
  /inspections        Inspection types + their sheets               A edits
  /strings            The 8 strings, SRCC, access rules             A edits
/log                  Activity: work on site | app settings         T A
/admin                Crew & accounts, backups, import/export,
                      clear the farm, suggestions                   A
```

Rules carried over: the map is the home screen and needs no explanation; a punch always names its
foundation; project knowledge is reachable **from the task you are doing**, not from a lone icon
in the top bar (#23 removed exactly that).

---

## 7. Visual identity

v1's language is "nautical chart": sea, paper, ink — deliberately not a spreadsheet, and
readable in direct sun. Keep the intent, raise the craft.

| Token | Light | Dark | Use |
|---|---|---|---|
| sea | `#E6EFF1` / `#D6E6EA` | `#0C1E2B` / `#081722` | the map surface |
| paper | `#F7F0E1` / `#FDFAF3` / `#EDE3CE` | `#14293A` / `#1B3448` / `#0F2231` | panels, cards, chrome |
| ink | `#0D2739` / `#2B4C66` / `#5C7488` | — | text, **never pure black** |
| rule | `#DBCEB3` / `#C0AE8E` | — | hairlines |
| accent | `#00718F` / `#009BC2` / `#005872` | — | primary actions |
| cable / SRCC | `#B03A2E` | — | restricted access |
| amber / green | `#A6690D` `#D9911F` / `#1E6B4A` | — | partial / done |

Type: Archivo (UI) + Fraunces (display). Both are deliberate choices — avoid the default
system-font look.

**For v2.** Keep the chart metaphor and the sun-readable contrast. Raise the ambition on: the
first-open moment, the dial as a signature object (it is genuinely distinctive — build the
identity around it), density on desktop (v1 wastes a wide screen), and motion that is quiet and
useful. Avoid: cards inside cards, purple-blue gradients, bouncy animation, grey-on-colour text.
Required: 44 px minimum touch targets, legible with gloves and in glare, and a real tablet layout
— v1 is a phone layout stretched.

---

## 8. Recommended architecture *(a recommendation — depart from it with a reason)*

### 8.1 Stack
A server-rendered or SPA web app with a real backend and a relational database. Any mainstream
choice is fine; what matters is that the server owns the data and enforces the rules. v1's "no
build step, no backend" constraint was right for a one-file prototype and is the root of §5.1 —
drop it.

### 8.2 Data and the server as single source of truth
- Every write goes to the server immediately, gets a **server** timestamp and an author, and is
  confirmed visibly. Client clocks are never trusted (§5.1 rule 1, #67).
- The browser caches for speed only. Clearing site data must lose nothing.
- Project knowledge and progress in **separate tables with separate lifecycles** (§4). Changing
  the app must never make data obsolete: stable ids, a version on the schema, and a tested
  conversion for every version bump. v1 shipped the frame for this (`SCHEMA_VERSION`, migrations)
  and never needed it — v2 will.
- Model progress as an **append-only event per decision** (who, when, what, on which foundation,
  which task, which state), with the current state derived. That makes "who unticked this and
  when" answerable, makes undo natural, and makes §5.1 structurally impossible.

### 8.3 Sync
With one server there is no merge to write. Each device subscribes to changes (websocket or
server-sent events) and updates live. Two people on the same foundation both write; last write
wins per field, both are recorded, and the screen shows the other person's change as it lands.
The only client-side queue is the short offline exception of §5.3.

### 8.4 Backups
Full project backup — knowledge and progress — on demand **and** on a schedule, with configurable
frequency and retention, stored **outside the main database**, restorable in one action, and
exported in a readable format that the app can re-import. v1's daily local snapshot was the first
thing sacrificed when the device filled up; that must not be the design.

### 8.5 Accounts and rights
One account and one password per person. Rights enforced **on the server**, never only in the UI —
v1 hid admin controls with CSS, which is presentation, not protection. Three roles as today.
The site is not indexed.

### 8.6 Bilingual, finished this time
Two layers, both needed: **interface strings** (a normal i18n catalogue) and **project content** —
task names, method statements, tools — which must exist in EN and FR as two fields on the same
record, editable side by side. One button switches both. v1 did the first layer only (#60), which
is why the crew still reads English task names. A missing translation falls back to the other
language and is visibly marked as missing.

### 8.7 Tests
Pure domain logic callable without a browser and tested in milliseconds (§5.5). End-to-end tests
for the journeys in §10. CI on every change. Every bug fix arrives with a test that fails on the
unfixed code.

### 8.8 AI agent interface
A documented, authenticated API so an agent can later (a) bulk-enter progress from the daily
WhatsApp debriefs and (b) make targeted edits — add method statements from a list, fill in
missing translations. Requirements: a **dry-run preview** of every change, explicit human
approval before anything is written, full attribution in the activity log, and one-action undo of
a whole batch. Build the API surface in phase 1 even if no agent uses it until phase 5 — retro-fitting
preview-and-undo onto a write path is how you get §5.1 again.

### 8.9 Phases, and what I test at each

| Phase | Built | What I test |
|---|---|---|
| 1 | Data model, server, accounts and rights, backup/restore, i18n frame, CI | Log in as each role; restore a backup over a live project; switch language on an empty shell |
| 2 | Map + foundation sheet + task states | Tick from two devices on the same foundation; untick; check it holds after a reload |
| 3 | Project knowledge: tasks, method statements, tools, strings, SRCC | Rename a task, shorten a method statement, delete a consumable — all must stick |
| 4 | The shift: toolbox talk, day plan, recap, punch, permits, activity log | A full shift, end to end, on a phone with gloves |
| 5 | v1 import, agent API, polish | The migration report of §9; a dry-run agent batch |

---

## 9. Migrating v1 data

v1 exports one JSON object (the `project`). The import must be a **one-off, verified migration**,
not a feature.

| Step | Rule |
|---|---|
| 1. Export | Take the v1 export from the device that is authoritative, plus a copy of the shared database. Compare them first; if they disagree, ask before choosing. |
| 2. Map knowledge | 62 foundations by `label`; 8 strings and their segments; tasks by id **and** by name (v1 matched both — expect a few names that resolve to two ids); method statements per language and section; tools & consumables. |
| 3. Map progress | Task states carry `{at, by}` plus a separate change-date map — take the **change date** as the event time. Inspections are lists of occurrences. Punch, permits, toolbox talks, recaps map one to one. |
| 4. Reconcile | A v1 record may hold work whose task no longer exists (the "waiting room", `project.overflow`, and orphan ticks held under an unknown id, #66). These are **real work**: import them as unattached events and list them for me to re-attach. |
| 5. Report | Print counts **before and after**: foundations, tasks per tier, ticks by state, comments, inspection occurrences, punch, permits, toolbox talks, method statements with EN text, with FR text. Any line where before ≠ after must be explained, not rounded. |

Do not import: the activity log (start fresh), map notes (**to verify** any exist), the
multi-project machinery, the per-device day plan.

---

## 10. Acceptance criteria

Each is a scenario, verifiable by hand and automatable. These double as the scorecard for
comparing the two rebuilds.

| # | Scenario | Pass |
|---|---|---|
| A1 | Two devices open the same foundation. A ticks task X; B is watching. | B sees it within seconds without reloading |
| A2 | A ticks X, B unticks X a moment later. Both reload. | Both show unticked; the log shows both decisions with author and time |
| A3 | A phone's clock is 10 minutes fast. It ticks X. A correct phone unticks X. | Unticked wins |
| A4 | Pull the network on the vessel, tick three tasks, restore the network. | The three are marked "not saved yet" while offline, then saved, with no silent loss and no duplicate |
| A5 | Admin shortens a method statement and deletes a consumable. Another device had the old version open. | The shorter text and the shorter list win everywhere |
| A6 | Admin renames a task that has 200 ticks against it. | Every tick still points at it; no duplicate task appears anywhere |
| A7 | Admin deletes a task. Another device still had it. | It stays deleted, and its work is either removed with it or listed as orphaned — never silently resurrected |
| A8 | Restore last night's backup over a live project. | Exactly the backed-up state, in one action, with a confirmation naming what is being replaced |
| A9 | Press the flag button. | Interface **and** project content (task names, method statements, tools) switch language; a missing translation is visibly marked |
| A10 | Clear the farm for a new campaign. | Ticks/comments/inspections/notes gone on all 62; tasks, method statements, crew, cables untouched; no device brings the old work back |
| A11 | Visitor account. | Can read everything; every write path is refused **by the server**, not merely hidden |
| A12 | Agent submits a batch of 40 tick updates from a debrief. | A preview lists all 40; nothing is written before approval; the log attributes them to the agent; one action undoes the batch |
| A13 | Open on a phone, a tablet and a desktop. | Each is a real layout, not a stretch; targets ≥ 44 px; readable in direct sun |
| A14 | Import the v1 export. | The §9 report balances, and every discrepancy is explained |

---

## 11. Open questions, with my recommendation

| # | Question | My recommendation |
|---|---|---|
| Q1 | Should progress be an **event log** (every tick a row, state derived) or a current-state table? | Event log. It costs more in phase 1 and makes §5.1 impossible, gives you "who and when" for free, and is what the agent interface needs for undo. |
| Q2 | Keep the **four** task states (not done / in progress / partially done / done)? | Keep. "In progress" was added for a real reason — two technicians starting the same task (#56) — and the crew uses it. |
| Q3 | When do the cables **freeze**? | Freeze the layout as project knowledge once you approve it, and keep a hidden admin override rather than removing the tool. A layout you can never touch again is the reason the map editor came back. |
| Q4 | Is "who has read which method statement" worth rebuilding? | Yes, but simplify: one read-mark per person per section, no second map. v1's two-map split (`procSeen` + `procSeenParts`) existed only to stay compatible with phones running an older version. |
| Q5 | Should the 12 h recap stay copy-to-WhatsApp, or post itself? | Keep copy-to-clipboard in v1 form for phase 4. An automatic post is a separate integration and a separate consent conversation with the crew. |
| Q6 | Is the **multi-project** machinery worth keeping? | Drop it. One farm, one project. It exists in v1, is unused, and its project name doubles as the storage address — a rename strands the data. |
| Q7 | Who hosts, and what is the budget ceiling? | Needed before phase 1. A small managed database + app host is enough for 8 users; say the ceiling and I will size the backups to it. |
| Q8 | Do the 62 foundation labels, string layout and task names count as **confidential**? | The repo is public today. Tell me, and if yes the v2 repo is private and the sample data fully synthetic. |
| Q9 | Should v1 keep running while v2 is built? | Yes, read-write, until the §9 migration balances. Freeze it for one shift on cut-over day. |
