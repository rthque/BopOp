# Op BOP tre FOU — BOP works tracker

Static web app (no backend) to track BOP works progress across the 62 foundations of the Dieppe Le Tréport wind farm, inspired by the paper punch-list poster used on site.

## Features

- **62 foundations** laid out exactly like the reference cable map (letter A–M / row 1–7 grid, zero-padded labels, K01 included, no K03), with the real inter-array cable strings radiating from the OSS. Positions are fixed: drag = pan, pinch = zoom, tap = interact.
- **Tasks (up to 24)** — one single list. Whether a task is drawn as a slice of the central pie or a cell of the outer ring is a drawing detail the app decides: the centre fills first, the ring takes the rest. Nobody has to classify anything.
- **Task states** — not done / **partially done (hatched fill)** / done. Every check is timestamped and attributed to the logged-in technician.
- **Task comments** — a 💬 note per task per foundation, plus a free note per foundation.
- **Reports (repeatable)** — 8 repeatable report types per foundation (Survey In/OUT, ferry daily check, Aconex 100% control, SRL load indicator, guano & smells, boatlanding SharePoint tracking, cable cleats, punch) counted with their dates and authors.
- **Login screen** — technicians pick their name (password `BOP`); a **Visitor** mode gives full read-only access. The name of whoever validates a task is shown in grey next to it.
- **Activity log (admin)** — every change in one chronological list: date, time, person, what happened. Ticks and part-ticks, comments, bulk updates, tasks added / renamed / hidden / deleted, SRCC changes, crew changes, method-statement edits, strings created or deleted. A hairline marks each new run of updates — a different person, or a break of more than half an hour — so a day reads as shifts rather than as a wall of lines. Copyable as text. Bounded to the last 800 entries / 180 days, because it travels with the project into the database.
- **Editable crew list** — an admin adds, renames, recolours or removes the people on the login screen (left panel → *Crew on the login screen*), and decides who is an admin. The list syncs to every device. Guards: no duplicate names, you cannot remove yourself, and there is always at least one admin left. Removing someone only takes them off the login screen — everything they validated keeps their name on it.
- **Admin mode** — Antonin, Yohan, Etienne and Quentin can enable admin mode (bottom of the left panel) to add, rename, hide or delete tasks, edit method statements, manage the crew, read the activity log, and manage projects. Everyone else is read-only for configuration.
- **Method statements** — 📖 menu with, per task: method statement (EN by default, 🇫🇷 toggle), tools & consumables, PPE & required trainings. Editable in admin mode.
- **24h recap for WhatsApp** — one click copies a `■ FOU → X07` formatted summary of everything done in the last 24 hours (per foundation or farm-wide), ready to paste in the tracking channel.
- **CSV backup** — one click downloads a full Excel-compatible export (every task, state, date, author, comment, report occurrence). Note: automatic daily e-mails are not possible from a fully static site; use the CSV/JSON export buttons (a scheduled backup service can be added later if a backend becomes available).
- **Punch list** and per-task **progress bars**.
- **8 inter-array strings** numbered S1–S8, with the string number written along every cable segment so you always know which string you are looking at.
- **Draw your own string** (admin) — *+ Add string* in the left panel: give it a number, then tap the foundations one after another in cable order. A dashed preview and a running count follow the taps; *Undo last* and *Cancel* are one tap away. Only strings drawn this way can be deleted — the eight real ones are the wind farm itself.
- **Elbows on a cable** (admin) — the elbow tool bends a cable around an obstacle: tap the cable to add an elbow (two at most), drag it to place it, tap it to remove it. The string number follows the bend instead of floating off the line, and elbows are kept inside the farm so a cable can never run off into empty sea.
- **SRCC strings** — any string can be flagged restricted: its cable becomes a bold red run, every foundation it feeds is ringed in red, and a restricted-access reminder appears on the string panel and on each of those foundations.
- **The map cannot be panned away.** When the farm is smaller than the view it stays centred; when it is bigger you can pan but never past the outermost foundation. No foundation can be dragged off-screen at any zoom.
- **Two-language method statements** — EN/FR toggle that keeps your place (the instruction you were reading stays open and scrolled where it was). The method statement, the tools & consumables and the PPE & trainings each have their own EN and FR text, so writing one language never overwrites the other. Missing or outdated translations are flagged, and an admin can copy the other language across as a starting point. Translation is deliberately manual: a machine-translated safety instruction is a hazard, not a convenience. The structured consumables list stays shared by both languages on purpose — it is the picking list the day plan adds up, and one item must not be counted twice under two names.
- **Map notes**: place free text anywhere on the map at four sizes — small notes only show when zoomed in, large ones stay readable zoomed out (to signal a crane, spare equipment, etc.).
- **Today's tasks & kit**: pick the day's tasks to get the aggregated tools & consumables to prepare, with recurring consumables to restock highlighted.
- **Changed-instruction alerts** — when an admin edits a method statement, its tools or its consumables, the exact part that changed is highlighted for 24h with a "changed <date>" tag, and every technician gets an unread counter on the 📖 button. The flag clears for that person once they open the instruction, so each tech is nudged towards the latest way of working without anyone having to chase them.
- **Anonymous suggestions box** — a 💡 menu where anyone (including visitors) can write an improvement idea; no name is ever attached. The collected suggestions are only readable by admins (in admin mode), who can delete handled ones.
- **Hide/archive a task** to declutter the map while keeping its history.
- **Bulk-validate** a task across all 62 foundations in one click (admin), or **Check all / Uncheck all** on a single foundation — one button on the *Tasks* heading that covers every task, centre and ring alike, and lands in the activity log as a single line.
- **Paste a WhatsApp recap** (`■ FOU → G04` / `- Task → ✅`) to auto-tick the matching tasks on the map.
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

Setting `SYNC_API_KEY` (and a Firebase Email/Password account) moves the crew password out of this file: Firebase checks it, and only a signed-in device gets a token that the database will accept for writes. Reads stay open so the Visitor mode keeps working.

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
