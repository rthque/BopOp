# Op BOP tre FOU — BOP works tracker

Static web app (no backend) to track BOP works progress across the 62 foundations of the Dieppe Le Tréport wind farm, inspired by the paper punch-list poster used on site.

## Features

- **62 foundations** laid out exactly like the reference cable map (letter A–M / row 1–7 grid, zero-padded labels, K01 included, no K03), with the real inter-array cable strings radiating from the OSS. Positions are fixed: drag = pan, pinch = zoom, tap = interact.
- **Tasks (up to 24)** — one single list. Whether a task is drawn as a slice of the central pie or a cell of the outer ring is a drawing detail the app decides: the centre fills first, the ring takes the rest. Nobody has to classify anything.
- **Task states** — not done / **partially done (hatched fill)** / done. Every check is timestamped and attributed to the logged-in technician.
- **Task comments** — a 💬 note per task per foundation, plus a free note per foundation.
- **Reports (repeatable)** — 8 repeatable report types per foundation (Survey In/OUT, ferry daily check, Aconex 100% control, SRL load indicator, guano & smells, boatlanding SharePoint tracking, cable cleats, punch) counted with their dates and authors.
- **Login screen** — technicians pick their name (password `BOPBOP`); a **Visitor** mode gives full read-only access. The name of whoever validates a task is shown in grey next to it.
- **Activity log (admin)** — every change in one chronological list: date, time, person, what happened. Ticks and part-ticks, comments, bulk updates, tasks added / renamed / hidden / deleted, SRCC changes, crew changes, method-statement edits, strings created or deleted. A hairline marks each new run of updates — a different person, or a break of more than half an hour — so a day reads as shifts rather than as a wall of lines. Copyable as text. Bounded to the last 800 entries / 180 days, because it travels with the project into the database.
- **Everything an admin changes travels.** Task and inspection ids are derived from their names, so two devices that each set themselves up before ever syncing agree on which task is which — they used to be random, and the merge fell back on matching names, which meant a rename grew a duplicate on every other device. Colour, name and the archived flag now carry a timestamp and merge last-write-wins; a deletion leaves a tombstone for 30 days so the next device to sync cannot bring the task back.
- **Editable crew list** — an admin adds, renames, recolours or removes the people on the login screen (left panel → *Crew on the login screen*), and decides who is an admin. The list syncs to every device. Guards: no duplicate names, you cannot remove yourself, and there is always at least one admin left. Removing someone only takes them off the login screen — everything they validated keeps their name on it.
- **Admin mode** — Antonin, Yohan, Etienne and Quentin can enable admin mode (foot of the right panel) to add, rename, recolour, hide or delete tasks, edit method statements, manage the crew, read the activity log, and manage projects. Everyone else is read-only for configuration.
- **Method statements** — per task: method statement (EN by default, 🇫🇷 toggle), tools & consumables, PPE & required trainings. Editable in admin mode. **Reached from the task itself**: tap any task in the left-panel *Tasks* list (in admin mode, the document button on its row) and its instruction opens, expanded and scrolled to. There is no separate button in the top bar — an isolated icon nobody finds is worse than no icon. An instruction this person has not read yet is flagged with a red dot on its own row, and the count of updated instructions rides on the button that opens the task list.
- **Windows close where you tap.** Every secondary window (method statements, day plan, cable, crew, activity log, suggestions, map note) closes on a tap beside it, on `Escape`, or on its close button — an edit in progress is committed on the way out, never dropped. The foundation card is deliberately excluded: you work in it for minutes at a time and a stray tap next to a checkbox must not throw you out.
- **12h recap for WhatsApp** — one click copies a `■ FOU → X07` formatted summary of everything done in the last 12 hours (per foundation or farm-wide), ready to paste in the tracking channel. A shift, not a day: twenty-four hours reached back over yesterday's work and repeated what the channel already had.
- **Permits to work** — the permits open right now, at the top of the right panel: BOP / SAP / CTV, the number, an SRCC flag (`BOP → A32992 srcc`). A missing leading `A` is added, a duplicate is refused, and closing one is a tombstone so it cannot come back from another phone. Everyone sees them; a technician can open and close them.
- **Clear every foundation** (admin) — wipes every tick, task comment, inspection, note, blocking point and punch list entry across the farm, for a new campaign. The punch list goes with them on purpose: it lists what is still wrong on the foundations, and keeping it against a blank map would have the crew reading last campaign's defects. Asked twice: a spelled-out warning, then the crew password. Method statements, the task list, the crew, the cables, the permits and the activity log are deliberately untouched — those are how the site is set up, not what was done on it. Export a backup first; it cannot be undone. The wipe is stored as a **date**, not as an absence, and that date syncs: everything stamped before it stops being data on every phone, so a teammate whose device still holds the old campaign cannot post it back — which is exactly what used to happen a couple of seconds after the wipe. Work done *after* it is never touched.
- **CSV backup** — one click downloads a full Excel-compatible export (every task, state, date, author, comment, report occurrence). Note: automatic daily e-mails are not possible from a fully static site; use the CSV/JSON export buttons (a scheduled backup service can be added later if a backend becomes available).
- **Per-task progress on the task itself** — `xx/62 · xx%` and a 3px hairline on the row you are already reading. There is no separate progress panel: the same twenty-four numbers in two places helped nobody. An archived task drops into an *Archived (n)* drawer at the foot of the list.
- **8 inter-array strings** numbered S1–S8, with the string number written along every cable segment so you always know which string you are looking at.
- **The map is a finished drawing, not an editor.** Tréport is built: there is no tool anywhere to add or delete a foundation, add or delete a cable, or bend one. The map is read, tapped and panned. A cable can still be given its string (tap it in admin mode) because that is a label on an existing cable, not a change to the layout. A project created for another site — recognised by having no OSS — keeps *+ Add string*.
- **Draw your own string** (admin, other sites) — *+ Add string* in the left panel: give it a number, then tap the foundations one after another in cable order. A dashed preview and a running count follow the taps; *Undo last* and *Cancel* are one tap away. Only strings drawn this way can be deleted — the eight real ones are the wind farm itself.
- **Elbows already on a cable** are still drawn, and the string number still follows the bend instead of floating off the line. There is no longer a tool to add, move or remove one.
- **Give a cable its string** (admin) — tap any cable on the map to open it: which string it belongs to, or none. A cable with no string carries no number and can never be flagged SRCC, which is what happened to every cable redrawn by hand. Cables that lost their string are **renumbered on load** wherever both ends still agree; anything genuinely ambiguous is left alone for a human to set here. Every cable has an invisible 18px tap target under it, because a 1.9px line cannot be hit with a glove on.
- **The cable layout syncs.** It never did — a routing corrected on the laptop stayed on the laptop and looked like a browser-cache problem. It now travels between devices **as one drawing**: the most recently edited layout wins whole, matched by foundation label. Merging cable by cable would give a map that is neither device's, with cables the other phone keeps putting back. The trade-off is deliberate: two people re-routing at the same time means one of them loses their edit, which is the right call for a drawing that is set up once and rarely touched. *Make this device's cable layout the reference* (left panel, admin) re-stamps it from the device where the map is right — and it wins even against a device whose clock runs fast.
- **SRCC strings** — any string can be flagged restricted: its cable becomes a bold red run, every foundation it feeds is ringed in red, and a restricted-access reminder appears on the string panel and on each of those foundations.
- **The OSS is the platform itself**, drawn at a foundation's size with no box and no caption around it. Its tap target is a modest disc rather than the whole drawing — a catcher that big swallowed the first stretch of every cable leaving it, and those cables could no longer be tapped.
- **The map cannot be panned away.** When the farm is smaller than the view it stays centred; when it is bigger you can pan but never past the outermost foundation. No foundation can be dragged off-screen at any zoom.
- **Two-language method statements** — EN/FR toggle that keeps your place (the instruction you were reading stays open and scrolled where it was). The method statement, the tools & consumables and the PPE & trainings each have their own EN and FR text, so writing one language never overwrites the other. Missing or outdated translations are flagged, and an admin can copy the other language across as a starting point. Translation is deliberately manual: a machine-translated safety instruction is a hazard, not a convenience. The structured consumables list stays shared by both languages on purpose — it is the picking list the day plan adds up, and one item must not be counted twice under two names.
- **Map notes**: place free text anywhere on the map at four sizes — small notes only show when zoomed in, large ones stay readable zoomed out (to signal a crane, spare equipment, etc.).
- **Today's tasks & kit**: pick the day's tasks to get the aggregated tools & consumables to prepare, with recurring consumables to restock highlighted.
- **Changed-instruction alerts** — when an admin edits a method statement, its tools or its consumables, the exact part that changed is highlighted for 24h with a "changed <date>" tag, a red dot appears on that task's row, and the count rides on the button that opens the task list. The flag clears for that person once they open the instruction. **Who has read what is stored in the project, not on the device**: it used to live in `localStorage`, so the same technician was told again on their phone about an instruction they had already read on the laptop.
- **Anonymous suggestions box** — a 💡 menu where anyone (including visitors) can write an improvement idea; no name is ever attached. The collected suggestions are only readable by admins (in admin mode), who can delete handled ones.
- **Hide/archive a task** to declutter the map while keeping its history. Archiving is honoured everywhere it should be: off the map, out of the foundation card, out of the day's kit list, and out of the farm-wide progress figure — but kept in the CSV export and in the method statements, because that is history, not work being asked for.
- **Bulk-validate** a task across all 62 foundations in one click (admin), or **Check all / Uncheck all** on a single foundation — one button on the *Tasks* heading that covers every task, centre and ring alike, and lands in the activity log as a single line.
- Mobile-first: on phone/tablet the editing chrome disappears, the map takes the full screen; pinch-zoom is stable and the farm always fills the screen.

Data is stored in the browser (`localStorage`). Use **Export/Import** to move a project between devices.

## What is kept, and for how long

**The worksite record is never purged.** Task states with their date and author, comments, free notes, repeatable inspections, punch items and map notes stay for good — there is no expiry anywhere in the code that touches them.

Exactly two things are bounded, and neither is worksite data:

| | Rule | Why |
|---|---|---|
| Activity log | last 800 entries / 180 days | it is a trail *about* the record, not the record; it rides along into the database |
| Deleted-item tombstones | 30 days | they exist only to stop a deleted item coming back from another device |

Measured sizes: a fresh project is **31 KB**. A worst case — all 24 tasks ticked with a comment on every one of the 63 points, 20 occurrences of all 8 inspections everywhere, 200 punch items and a full 800-entry log — is **878 KB**, against a browser budget of about **4.9 MB**.

The one part that grows without limit is the repeatable inspections: roughly 22 KB per complete round of all 8 inspections on all 62 foundations, so on the order of 200 such rounds before the browser budget is reached. Firebase has no equivalent limit.

If a device ever does fill up, saving **frees the daily safety snapshots first and never the project**, retries, and if it still cannot write it says so out loud instead of losing the change silently. Regular **Export CSV / Export JSON** remains the way to hold a copy that does not depend on any one device.

## Design

The interface uses a **marine-chart** language, chosen for a tool that is read on deck in daylight:

- **Paper and sea** — buff chart paper for the panels and chrome, pale sea for the map, split like a real nautical chart.
- **Deep navy ink** (never pure black) on paper, for maximum contrast in direct sun.
- **Hairline rules and a two-level graticule** instead of boxed cards, so nothing is a card inside a card.
- **Type**: *Fraunces* for the wordmark and titles, *Archivo* for everything else (both from Google Fonts; the app falls back to Georgia/system fonts and stays fully usable when offline).
- **Light and dark, same chart.** In the dark the paper becomes a slate deck and the ink becomes lamp-light; the cyan, red, amber and green accents are lifted, because the deep tones of a paper chart go muddy on a dark ground. The button in the top bar cycles **Auto → Light → Dark**: auto follows the phone or laptop, the manual settings hold whatever the device thinks — at sea the light changes long before the operating system decides it has. The choice is per device and is applied in a `<head>` script *before the first paint*, so opening the app at 5am never flashes a white screen. Every text/background pair in the dark theme clears 4.5:1.
- **One type scale, seven steps** (`--t-micro` → `--t-display`), each with a job. The whole scale shifts one notch on a phone — reading sizes up for arm's length and gloves, the display title down because the topbar is the tightest strip on the screen. No rule carries its own size.
- **One icon set**: a single SVG sprite on a 24px grid with one 1.8px stroke, always drawn in the ink colour of whatever it sits in. No emoji in the interface — an emoji is a different picture on every phone, each with its own palette and weight, and mixing them with drawn icons is what made the app read as assembled rather than designed. Emoji remain only where they are *content*: the WhatsApp recap format (`■ FOU → G04`, `- Task → ✅`) is a contract with the tracking channel.
- **Large tap targets** (44px, 48px on phones) so the app can be driven with gloves on.
- **One scroll per panel.** No box that scrolls inside a box that scrolls — you could never tell which one your finger was moving.
- **All `@media` blocks live at the end of the stylesheet**, ordered widest to narrowest. They used to sit mid-file, so any base rule written further down silently beat them.
- Status is colour-coded at a glance: neutral = not done, amber = partially done, green = done.

## Team account (write protection)

The database URL lives in `app.js`, which every browser downloads, so it can never be secret. Without a team account the rules have to allow anyone to write.

`SYNC_API_KEY` is set, so the crew password is no longer compared in this file: Firebase checks it, and only a signed-in device gets a token the database accepts for writes. Reads stay open so Visitor keeps working. (A Firebase Web API key is not a secret — it ships inside every client and Google documents it as public. What it buys is the server-side check.)

**The password typed on the login screen is this account's password.** They must match, and Firebase refuses anything under six characters — so the crew password is `BOPBOP`.

It is deliberately **not** translated in the app (type `BOP`, send `BOPBOP`). Every browser downloads `app.js`, so the account password would then sit in plain sight and anyone reading the page source could write to the team's data — which is the one thing the team account exists to prevent. Whatever is typed is what gets sent.

Someone still typing the old `BOP` is not turned away: they work on their own device and are told what the password is now. They get no token, so they cannot write to the shared database. They knew the old crew password, so they are crew, and being stranded offshore over three letters helps nobody.

**Nobody can be locked out of their own tracker.** If Firebase refuses — the account is not set up yet, or its password has drifted from the one everyone types — a person who gave the crew password still gets in and works on that device. The database rules refuse their writes, so nothing shared can be damaged. Without that, one console setting away from home would strand the whole crew at sea. A stranger who does not know the crew password is still refused.

Rules to pair with it:

```json
{ "rules": { "projects": { ".read": true, ".write": "auth != null" } } }
```

Notes:
- A device that has signed in once keeps working offline and syncs when the connection returns — nobody gets locked out at sea. A device that has never signed in can still be used in Visitor (read-only) mode without a connection.
- Changing the account password in Firebase revokes every device on their next token refresh.
- Leave `SYNC_API_KEY` empty to keep the previous open behaviour.

## Hosting

`index.html` + `styles.css` + `app.js`, no build step and no JS dependencies (web fonts are the only external asset, and they degrade gracefully). A GitHub Actions workflow deploys to GitHub Pages on every push to `master`.

## The paper board, transcribed

`data/tableau-19-07-26.json` is the wall board of 19/07/26 read off a photograph
and turned into a project the app can import (Share & backup → Import). It
carries the eight tasks of the board's colour wheel, the eight "Fait" markers
drawn beside each foundation, the 22 punch list entries and the handwritten map
notes — and a wipe date, so importing it replaces whatever the app was holding
rather than piling the board on top of it. It deliberately carries no cables, no
permits, no crew and no method statements: those stay as they are on the device.

The wheel is read clockwise from twelve o'clock, in the order the board's legend
gives: Scotch Kote, hand rail bolts, Rubber cabinet, sacrificial parts, casse
cœur, cable tray bracket, rust in steel, earthing cable.
