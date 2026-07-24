# Op BOP tre FOU — BOP works tracker

Static web app (no backend) to track BOP works progress across the 62 foundations of the Dieppe Le Tréport wind farm, inspired by the paper punch-list poster used on site.

## Features

- **62 foundations** laid out exactly like the reference cable map (letter A–M / row 1–7 grid, zero-padded labels, K01 included, no K03), with the real inter-array cable strings radiating from the OSS. Positions are fixed: drag = pan, pinch = zoom, tap = interact.
- **Main categories (up to 8)** — slices of the central pie of each foundation.
- **Secondary categories (up to 16)** — cells of the outer ring.
- **Task states** — not done / **partially done (hatched fill)** / done. Every check is timestamped and attributed to the logged-in technician.
- **Task comments** — a 💬 note per task per foundation, plus a free note per foundation.
- **Reports (repeatable)** — 8 repeatable report types per foundation (Survey In/OUT, ferry daily check, Aconex 100% control, SRL load indicator, guano & smells, boatlanding SharePoint tracking, cable cleats, punch) counted with their dates and authors.
- **Login screen** — technicians pick their name (password `BOP`); a **Visitor** mode gives full read-only access. The name of whoever validates a task is shown in grey next to it.
- **Admin mode** — Antonin, Yohan, Etienne and Quentin can enable admin mode (bottom of the left panel) to edit/add/move/delete categories, edit method statements, and manage projects. Everyone else is read-only for configuration.
- **Method statements** — 📖 menu with, per task: method statement (EN by default, 🇫🇷 toggle), tools & consumables, PPE & required trainings. Editable in admin mode.
- **24h recap for WhatsApp** — one click copies a `■ FOU → X07` formatted summary of everything done in the last 24 hours (per foundation or farm-wide), ready to paste in the tracking channel.
- **CSV backup** — one click downloads a full Excel-compatible export (every task, state, date, author, comment, report occurrence). Note: automatic daily e-mails are not possible from a fully static site; use the CSV/JSON export buttons (a scheduled backup service can be added later if a backend becomes available).
- **Punch list** and per-category **progress bars**.
- **8 inter-array strings** numbered S1–S8; any string can be flagged **SRCC** (restricted): its cable turns red and a restricted-access reminder is shown on the string panel and on every foundation of that string.
- **Map notes**: place free text anywhere on the map at four sizes — small notes only show when zoomed in, large ones stay readable zoomed out (to signal a crane, spare equipment, etc.).
- **Today's tasks & kit**: pick the day's tasks to get the aggregated tools & consumables to prepare, with recurring consumables to restock highlighted.
- **Anonymous suggestions box** — a 💡 menu where anyone (including visitors) can write an improvement idea; no name is ever attached. The collected suggestions are only readable by admins (in admin mode), who can delete handled ones.
- **Hide/archive categories** to declutter the map while keeping their history.
- **Bulk-validate** a category across all 62 foundations in one click (admin).
- **Paste a WhatsApp recap** (`■ FOU → G04` / `- Task → ✅`) to auto-tick the matching tasks on the map.
- Mobile-first: on phone/tablet the editing chrome disappears, the map takes the full screen; pinch-zoom is stable and the farm always fills the screen.

Data is stored in the browser (`localStorage`). Use **Export/Import** to move a project between devices.

## Hosting

`index.html` + `styles.css` + `app.js`, no dependencies. A GitHub Actions workflow deploys to GitHub Pages on every push to `master`.
