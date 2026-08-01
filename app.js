(() => {
  'use strict';

  const STORAGE_KEY = 'worksite-tracker:v7';
  const USER_KEY = 'worksite-tracker:user';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const LOCALE = 'en-GB';

  const NODE_R = 34;       // inner pie radius (8 main categories)
  const HUB_R = 9;         // center hub (open details)
  const RING_IN = 37;      // second ring (16 secondary categories), inner radius
  const RING_OUT = 52;     // second ring, outer radius
  const GRID_UNIT = 140;   // world-space spacing between adjacent grid cells

  const MAX_CATEGORIES = 8;
  const MAX_MICRO = 16;

  // ---------- team ----------
  const PASSWORD = 'BOP';
  const ADMIN_NAMES = ['Antonin', 'Yohan', 'Etienne', 'Quentin'];
  const LOGIN_ROWS = [
    { names: ['Antonin', 'Yohan'], style: 'sky' },
    { split: true, left: ['Quentin', 'Yoan', 'LP', 'Benoît'], right: ['Etienne', 'Baptiste', 'Greg', 'Seb'], style: 'orange' },
    { names: ['Silvio', 'Stan'], style: 'sky' },
    { names: ['Guilhem', 'Angel', 'Mika', 'Max', 'Erwan', 'Luc', 'Mathieu'], style: 'sky' },
  ];

  // The crew is project data, not a constant: an admin adds or removes people
  // without waiting for a code change. Seeded once from the rows above.
  // Seeded ids must be identical on every device. With a random id per device,
  // the union-by-id merge stacked one whole copy of the crew per phone and the
  // login screen filled up with the same names over and over.
  function teamSeedId(name) {
    return `crew-${String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  function defaultTeam() {
    const out = [];
    LOGIN_ROWS.forEach((row) => {
      (row.split ? row.left.concat(row.right) : row.names).forEach((name) => {
        out.push({
          id: teamSeedId(name),
          name,
          admin: ADMIN_NAMES.includes(name),
          style: row.style,
          updatedAt: new Date().toISOString(),
        });
      });
    });
    return out;
  }

  function liveTeam(project) {
    const seen = new Set();
    // deduped on the way out too, so a half-applied sync can never put the
    // same name on the login screen twice
    return ((project && project.team) || []).filter((m) => {
      if (!m || m.deleted || !m.name) return false;
      const key = String(m.name).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ---------- farm layout ----------
  // Foundation grid (letter column A–M, no I, numeric row 1–7), validated
  // against the official coordinates spreadsheet (Fondations_OWF.xlsx):
  // no J02 nor K03; K01 and L03 exist. Labels are zero-padded (A02, K01…).
  const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M'];
  const COLUMN_ROWS = {
    A: [2, 3, 4],
    B: [2, 3, 4],
    C: [2, 3, 4],
    D: [3, 4, 5, 6, 7],
    E: [1, 2, 3, 4, 5, 6, 7],
    F: [1, 2, 5, 6, 7],
    G: [1, 2, 4, 5, 6, 7],
    H: [1, 2, 4, 5, 6, 7],
    J: [1, 4, 5, 6, 7],
    K: [1, 4, 5, 6, 7],
    L: [1, 2, 3, 4, 5, 6, 7],
    M: [1, 2, 3, 4, 5, 6, 7],
  };

  function fouLabel(col, row) {
    return `${col}0${row}`;
  }

  // 8 inter-array cable strings (numbered 1..8), each an ordered list of cable
  // segments, read off the reference site map by following the little black
  // string numbers written along each red cable. Every string walks outward
  // from the OSS (empty L3 grid slot). Membership (all 62 FOUs, once each):
  //   S1: K04 J04 J05 H05 G05 F05 E05 D05   (8, "between D05 and K04")
  //   S2: L04 L05 L06 L07 M07 M06 M05 M04   (8, upper L/M columns)
  //   S3: K07 J07 H07 G07 F07 E07 D07       (7, row 7)
  //   S4: K05 K06 J06 H06 G06 F06 E06 D06   (8, row 6 + K05)
  //   S5: L03 L02 L01 K01 M01 M02 M03       (7, lower L/M columns)
  //   S6: G04 E04 D04 C04 B04 A04 A03 A02   (8, west row 4 → A column)
  //   S7: H04 E03 E02 D03 C03 C02 B03 B02   (8, south-west cluster)
  //   S8: J01 H01 H02 G02 F02 G01 F01 E01   (8, row 1 + row 2 partial)
  const STRING_GROUPS = [
    [['OSS', 'K04'], ['K04', 'J04'], ['J04', 'J05'], ['J05', 'H05'], ['H05', 'G05'], ['G05', 'F05'], ['F05', 'E05'], ['E05', 'D05']],
    [['OSS', 'L04'], ['L04', 'L05'], ['L05', 'L06'], ['L06', 'L07'], ['L07', 'M07'], ['M07', 'M06'], ['M06', 'M05'], ['M05', 'M04']],
    [['OSS', 'K07'], ['K07', 'J07'], ['J07', 'H07'], ['H07', 'G07'], ['G07', 'F07'], ['F07', 'E07'], ['E07', 'D07']],
    [['OSS', 'K05'], ['K05', 'K06'], ['K06', 'J06'], ['J06', 'H06'], ['H06', 'G06'], ['G06', 'F06'], ['F06', 'E06'], ['E06', 'D06']],
    [['OSS', 'L03'], ['L03', 'L02'], ['L02', 'L01'], ['L01', 'K01'], ['L01', 'M01'], ['M01', 'M02'], ['M02', 'M03']],
    [['OSS', 'G04'], ['G04', 'E04'], ['E04', 'D04'], ['D04', 'C04'], ['C04', 'B04'], ['B04', 'A04'], ['A04', 'A03'], ['A03', 'A02']],
    [['OSS', 'H04'], ['H04', 'E03'], ['E03', 'E02'], ['E03', 'D03'], ['D03', 'C03'], ['C03', 'C02'], ['C03', 'B03'], ['B03', 'B02']],
    [['OSS', 'J01'], ['J01', 'H01'], ['H01', 'H02'], ['H02', 'G02'], ['G02', 'F02'], ['G02', 'G01'], ['G01', 'F01'], ['F01', 'E01']],
  ];

  const CABLE_COLOR = '#7C93A6';
  const SRCC_COLOR = '#B03A2E';
  const DEFAULT_ACCESS_RULES = [
    'SRCC — String / cable circuit under restricted access.',
    '• Confirm the string is authorised & safe to approach before boarding any FOU on it.',
    '• Isolation / LOTO and permit-to-work must be in place.',
    '• Coordinate with the control room; stay clear of live HV cable works.',
    '• Do not start works on this string without SRCC clearance.',
  ].join('\n');

  // annotation font sizes are in WORLD units, so a small note is only legible
  // once zoomed in, and a big one stays readable when zoomed right out.
  const ANNOT_SIZES = [
    { key: 'S', label: 'Small', size: 16 },
    { key: 'M', label: 'Medium', size: 30 },
    { key: 'L', label: 'Large', size: 52 },
    { key: 'XL', label: 'Extra large', size: 90 },
  ];

  const LAYOUT_VERSION = 4;

  // Real WGS84 positions of every foundation and the OSS, from the official
  // coordinates spreadsheet: label -> [lat, lon, DMS string].
  const COORDS = {
    "A02": [50.088528, 1.06775, "50\u00b005'18.7\"N 1\u00b004'03.9\"E"],
    "A03": [50.095778, 1.056861, "50\u00b005'44.8\"N 1\u00b003'24.7\"E"],
    "A04": [50.103194, 1.046222, "50\u00b006'11.5\"N 1\u00b002'46.4\"E"],
    "B02": [50.096639, 1.080972, "50\u00b005'47.9\"N 1\u00b004'51.5\"E"],
    "B03": [50.104, 1.070444, "50\u00b006'14.4\"N 1\u00b004'13.6\"E"],
    "B04": [50.111056, 1.059028, "50\u00b006'39.8\"N 1\u00b003'32.5\"E"],
    "C02": [50.104694, 1.094278, "50\u00b006'16.9\"N 1\u00b005'39.4\"E"],
    "C03": [50.112306, 1.083417, "50\u00b006'44.3\"N 1\u00b005'00.3\"E"],
    "C04": [50.1194, 1.07288, "50\u00b007'09.8\"N 1\u00b004'22.4\"E"],
    "D03": [50.120083, 1.096889, "50\u00b007'12.3\"N 1\u00b005'48.8\"E"],
    "D04": [50.1275, 1.086028, "50\u00b007'39.0\"N 1\u00b005'09.7\"E"],
    "D05": [50.135028, 1.074472, "50\u00b008'06.1\"N 1\u00b004'28.1\"E"],
    "D06": [50.1421, 1.06344, "50\u00b008'31.6\"N 1\u00b003'48.4\"E"],
    "D07": [50.149528, 1.053667, "50\u00b008'58.3\"N 1\u00b003'13.2\"E"],
    "E01": [50.113472, 1.131139, "50\u00b006'48.5\"N 1\u00b007'52.1\"E"],
    "E02": [50.1207, 1.12086, "50\u00b007'14.5\"N 1\u00b007'15.1\"E"],
    "E03": [50.128861, 1.110028, "50\u00b007'43.9\"N 1\u00b006'36.1\"E"],
    "E04": [50.1355, 1.099278, "50\u00b008'07.8\"N 1\u00b005'57.4\"E"],
    "E05": [50.142778, 1.088611, "50\u00b008'34.0\"N 1\u00b005'19.0\"E"],
    "E06": [50.150267, 1.077806, "50\u00b009'01.0\"N 1\u00b004'40.1\"E"],
    "E07": [50.157206, 1.067481, "50\u00b009'25.9\"N 1\u00b004'02.9\"E"],
    "F01": [50.121306, 1.144861, "50\u00b007'16.7\"N 1\u00b008'41.5\"E"],
    "F02": [50.128806, 1.134194, "50\u00b007'43.7\"N 1\u00b008'03.1\"E"],
    "F05": [50.150972, 1.102194, "50\u00b009'03.5\"N 1\u00b006'07.9\"E"],
    "F06": [50.157991, 1.091016, "50\u00b009'28.8\"N 1\u00b005'27.7\"E"],
    "F07": [50.165639, 1.080278, "50\u00b009'56.3\"N 1\u00b004'49.0\"E"],
    "G01": [50.129611, 1.158028, "50\u00b007'46.6\"N 1\u00b009'28.9\"E"],
    "G02": [50.136806, 1.147417, "50\u00b008'12.5\"N 1\u00b008'50.7\"E"],
    "G04": [50.1516, 1.12598, "50\u00b009'05.8\"N 1\u00b007'33.5\"E"],
    "G05": [50.159033, 1.115131, "50\u00b009'32.5\"N 1\u00b006'54.5\"E"],
    "G06": [50.166556, 1.1045, "50\u00b009'59.6\"N 1\u00b006'16.2\"E"],
    "G07": [50.173446, 1.093942, "50\u00b010'24.4\"N 1\u00b005'38.2\"E"],
    "H01": [50.1375, 1.171417, "50\u00b008'15.0\"N 1\u00b010'17.1\"E"],
    "H02": [50.144861, 1.160639, "50\u00b008'41.5\"N 1\u00b009'38.3\"E"],
    "H04": [50.159628, 1.139278, "50\u00b009'34.7\"N 1\u00b008'21.4\"E"],
    "H05": [50.166861, 1.128278, "50\u00b010'00.7\"N 1\u00b007'41.8\"E"],
    "H06": [50.1737, 1.11691, "50\u00b010'25.3\"N 1\u00b007'00.9\"E"],
    "H07": [50.181694, 1.106778, "50\u00b010'54.1\"N 1\u00b006'24.4\"E"],
    "J01": [50.145806, 1.185167, "50\u00b008'44.9\"N 1\u00b011'06.6\"E"],
    "J04": [50.167667, 1.1525, "50\u00b010'03.6\"N 1\u00b009'09.0\"E"],
    "J05": [50.174972, 1.141667, "50\u00b010'29.9\"N 1\u00b008'30.0\"E"],
    "J06": [50.182661, 1.13106, "50\u00b010'57.6\"N 1\u00b007'51.8\"E"],
    "J07": [50.189694, 1.119972, "50\u00b011'22.9\"N 1\u00b007'11.9\"E"],
    "K01": [50.1536, 1.19796, "50\u00b009'13.0\"N 1\u00b011'52.7\"E"],
    "K04": [50.175694, 1.165917, "50\u00b010'32.5\"N 1\u00b009'57.3\"E"],
    "K05": [50.1831, 1.15509, "50\u00b010'59.2\"N 1\u00b009'18.3\"E"],
    "K06": [50.190362, 1.144129, "50\u00b011'25.3\"N 1\u00b008'38.9\"E"],
    "K07": [50.197806, 1.133361, "50\u00b011'52.1\"N 1\u00b008'00.1\"E"],
    "L01": [50.161925, 1.211712, "50\u00b009'42.9\"N 1\u00b012'42.2\"E"],
    "L02": [50.1691, 1.20074, "50\u00b010'08.8\"N 1\u00b012'02.7\"E"],
    "L03": [50.175988, 1.19026, "50\u00b010'33.6\"N 1\u00b011'24.9\"E"],
    "L04": [50.183694, 1.179139, "50\u00b011'01.3\"N 1\u00b010'44.9\"E"],
    "L05": [50.191139, 1.168056, "50\u00b011'28.1\"N 1\u00b010'05.0\"E"],
    "L06": [50.197917, 1.15725, "50\u00b011'52.5\"N 1\u00b009'26.1\"E"],
    "L07": [50.205833, 1.146889, "50\u00b012'21.0\"N 1\u00b008'48.8\"E"],
    "M01": [50.169639, 1.224556, "50\u00b010'10.7\"N 1\u00b013'28.4\"E"],
    "M02": [50.177, 1.21392, "50\u00b010'37.2\"N 1\u00b012'50.1\"E"],
    "M03": [50.1844, 1.20314, "50\u00b011'03.8\"N 1\u00b012'11.3\"E"],
    "M04": [50.192, 1.192333, "50\u00b011'31.2\"N 1\u00b011'32.4\"E"],
    "M05": [50.199222, 1.181528, "50\u00b011'57.2\"N 1\u00b010'53.5\"E"],
    "M06": [50.206472, 1.170722, "50\u00b012'23.3\"N 1\u00b010'14.6\"E"],
    "M07": [50.213806, 1.159722, "50\u00b012'49.7\"N 1\u00b009'35.0\"E"],
    "OSS": [50.1797, 1.17252, "50\u00b010'46.9\"N 1\u00b010'21.1\"E"],
  };

  // local equirectangular projection around the farm centre (north stays up)
  const GEO_REF = { lat: 50.15, lon: 1.12 };
  const M_PER_DEG_LAT = 111200;
  const M_PER_DEG_LON = 111320 * Math.cos((GEO_REF.lat * Math.PI) / 180);
  const WORLD_PER_M = 0.18;

  function geoToWorld(lat, lon) {
    return {
      x: (lon - GEO_REF.lon) * M_PER_DEG_LON * WORLD_PER_M,
      y: -(lat - GEO_REF.lat) * M_PER_DEG_LAT * WORLD_PER_M,
    };
  }

  function nodePosition(label, colIndex, row) {
    const c = COORDS[label];
    if (c) return geoToWorld(c[0], c[1]);
    return gridToWorld(colIndex, row);
  }

  let state = null;
  let user = null; // { name, role: 'tech'|'visitor', admin: bool }
  let mode = 'select'; // 'select' | 'connect' | 'delete' | 'bend' | 'newstring'
  let pendingConnectFrom = null;
  // a string being drawn by tapping foundations, one after another
  let newString = null; // { n, picks: [nodeId] }
  const MAX_BENDS = 2;  // one or two elbows per cable, no more
  let placingText = false;
  let editingAnnotId = null;
  let openNodeId = null;
  let pendingLoginName = null;
  let procLang = 'en';
  // only one instruction is expanded at a time: two open at once on a phone
  // means scrolling past one to reach the other, and neither gets read
  let openProcId = null;
  let syncingProcOpen = false;
  // the whole method-statement window follows the FR/EN toggle, labels included
  function procL(en, fr) { return procLang === 'en' ? en : fr; }
  // every free-text part of a method statement exists once per language:
  // writing the tools in French must not overwrite the English ones
  const PROC_TEXT_KEYS = ['en', 'fr', 'tools_en', 'tools_fr', 'ppe_en', 'ppe_fr'];
  function otherLang(lang) { return lang === 'en' ? 'fr' : 'en'; }
  // the day plan needs *a* list, so fall back to the other language rather
  // than handing out an empty kit because only one side is written
  function procText(proc, base, lang) {
    const mine = ((proc && proc[`${base}_${lang}`]) || '').trim();
    return mine || ((proc && proc[`${base}_${otherLang(lang)}`]) || '').trim();
  }
  let svgEl = null;
  let camera = { x: 0, y: 0, scale: 1, minScale: 0.1, maxScale: 8 };

  // ---------- utils ----------

  // ---------- appearance ----------
  // Auto follows the phone or laptop. The manual override is deliberate: at sea
  // the light changes long before the operating system decides it has, and
  // nobody wants the screen flipping mid-task.
  const THEME_KEY = 'worksite-tracker:theme';
  const THEME_ORDER = ['auto', 'light', 'dark'];
  let themePref = 'auto';

  function prefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function effectiveTheme() {
    if (themePref === 'dark') return 'dark';
    if (themePref === 'light') return 'light';
    return prefersDark() ? 'dark' : 'light';
  }

  function applyTheme() {
    const dark = effectiveTheme() === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    // native controls and scrollbars follow, otherwise they stay bright white
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0A1B27' : '#1E3A63');

    const btn = document.getElementById('btn-theme');
    if (btn) {
      const icon = themePref === 'auto' ? 'auto' : (themePref === 'dark' ? 'moon' : 'sun');
      btn.innerHTML = iconMarkup(icon);
      const label = { auto: 'Appearance: follows your device', light: 'Appearance: always light', dark: 'Appearance: always dark' };
      btn.title = `${label[themePref]} — tap to change`;
      btn.setAttribute('aria-label', label[themePref]);
    }
    // the cables are drawn, not styled by a sheet, so they need repainting
    if (svgEl && getActiveProject()) renderCanvas();
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (THEME_ORDER.includes(saved)) themePref = saved;
    } catch (e) { /* private mode — auto is a fine default */ }
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (themePref === 'auto') applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    applyTheme();
  }

  function cycleTheme() {
    themePref = THEME_ORDER[(THEME_ORDER.indexOf(themePref) + 1) % THEME_ORDER.length];
    try { localStorage.setItem(THEME_KEY, themePref); } catch (e) { /* noop */ }
    applyTheme();
    const said = { auto: 'Appearance follows your device.', light: 'Always light.', dark: 'Always dark.' };
    showToast(said[themePref]);
  }


  // ---------- activity log ----------
  // Append-only trail of who changed what, and when. Kept bounded because it
  // rides along with the project into localStorage and the database.
  const ACTIVITY_MAX = 800;
  const ACTIVITY_DAYS = 180;

  function trimActivity(project) {
    if (!Array.isArray(project.activity)) { project.activity = []; return; }
    const cutoff = Date.now() - ACTIVITY_DAYS * 24 * 3600 * 1000;
    project.activity = project.activity
      .filter((e) => e && e.at && new Date(e.at).getTime() > cutoff)
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .slice(-ACTIVITY_MAX);
  }

  function logActivity(action, detail) {
    const project = getActiveProject();
    if (!project) return;
    project.activity = project.activity || [];
    project.activity.push({
      id: uid(),
      at: new Date().toISOString(),
      by: (user && user.name) || 'Unknown',
      action,
      detail: String(detail == null ? '' : detail),
    });
    trimActivity(project);
  }


  // ---------- activity log window ----------
  // A "session" is one run of updates: the same person, without a long break.
  // Splitting on that is what turns a wall of lines into "here is what the
  // 06:40 crew did, here is what the afternoon crew did".
  const SESSION_GAP_MS = 30 * 60 * 1000;

  const ACTIVITY_LABELS = {
    task: 'Task', comment: 'Comment', bulk: 'Bulk update', report: 'Inspection',
    punch: 'Punch list', note: 'Foundation note', 'map-note': 'Map note',
    srcc: 'SRCC', crew: 'Crew', procedure: 'Method statement', string: 'String',
    'task-added': 'Task added', 'task-renamed': 'Task renamed', 'task-deleted': 'Task deleted',
    'task-hidden': 'Task hidden', 'task-shown': 'Task shown', permit: 'Permit to work',
  };

  function activityEntries(project) {
    return (project.activity || [])
      .slice()
      .sort((a, b) => new Date(b.at) - new Date(a.at)); // newest first
  }

  function renderLog() {
    const project = getActiveProject();
    const body = document.getElementById('log-body');
    if (!body || !project) return;
    body.innerHTML = '';
    const entries = activityEntries(project);

    if (!entries.length) {
      const p = document.createElement('p');
      p.className = 'proc-text proc-empty';
      p.textContent = 'Nothing recorded yet. Every change from now on lands here.';
      body.appendChild(p);
      return;
    }

    let lastDay = null;
    let prev = null;
    entries.forEach((e) => {
      const when = new Date(e.at);
      const day = when.toDateString();
      if (day !== lastDay) {
        const h = document.createElement('div');
        h.className = 'log-day';
        h.textContent = when.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        body.appendChild(h);
        lastDay = day;
        prev = null; // a new day is always a new session
      } else if (prev && (prev.by !== e.by || Math.abs(new Date(prev.at) - when) > SESSION_GAP_MS)) {
        const sep = document.createElement('div');
        sep.className = 'log-session-break';
        body.appendChild(sep);
      }

      const row = document.createElement('div');
      row.className = 'log-row';

      const time = document.createElement('span');
      time.className = 'log-time';
      time.textContent = when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });

      const who = document.createElement('span');
      who.className = 'log-who';
      who.textContent = e.by || 'Unknown';

      const what = document.createElement('span');
      what.className = 'log-what';
      const kind = document.createElement('span');
      kind.className = 'log-kind';
      kind.textContent = ACTIVITY_LABELS[e.action] || e.action;
      const detail = document.createElement('span');
      detail.className = 'log-detail';
      detail.textContent = e.detail || '';
      what.append(kind, detail);

      row.append(time, who, what);
      body.appendChild(row);
      prev = e;
    });
  }

  function logAsText() {
    const project = getActiveProject();
    return activityEntries(project).map((e) => {
      const d = new Date(e.at);
      return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })} — ${e.by} — ${ACTIVITY_LABELS[e.action] || e.action}: ${e.detail}`;
    }).join('\n');
  }

  function stateWord(key) {
    if (key === 'done') return 'done';
    if (key === 'partial') return 'partially done';
    return 'not done';
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // one place that knows how an icon is written, so the set stays coherent
  function iconMarkup(name, cls = 'ico') {
    return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function wedgePath(cx, cy, r, startAngle, endAngle) {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
  }

  function polar(radius, angle) {
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  }

  function ringSegmentPath(rIn, rOut, a0, a1) {
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const pt = (r, a) => `${r * Math.cos(a)},${r * Math.sin(a)}`;
    return `M${pt(rIn, a0)} L${pt(rOut, a0)} A${rOut},${rOut} 0 ${large} 1 ${pt(rOut, a1)} L${pt(rIn, a1)} A${rIn},${rIn} 0 ${large} 0 ${pt(rIn, a0)} Z`;
  }

  function microPaletteColor(i) {
    const hue = Math.round((360 / MAX_MICRO) * i);
    return `hsl(${hue}, 60%, 45%)`;
  }

  // A checked task is stored as { at: ISO date, by: name|null, partial?: true }
  // (null = not done) so details can show when and by whom it was validated.
  function checkStamp(partial) {
    const stamp = { at: new Date().toISOString(), by: user ? user.name : null };
    if (partial) stamp.partial = true;
    return stamp;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString(LOCALE)} ${d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}`;
  }

  function formatStamp(stamp) {
    if (!stamp || !stamp.at) return '';
    const datePart = formatDate(stamp.at);
    return stamp.by ? `${datePart} — ${stamp.by}` : datePart;
  }

  function showToast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  function copyText(text, doneMessage) {
    const finish = () => showToast(doneMessage || 'Copied to clipboard.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish).catch(() => fallbackCopy(text, finish));
    } else {
      fallbackCopy(text, finish);
    }
  }

  function fallbackCopy(text, finish) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
    finish();
  }

  // ---------- permissions ----------
  function canEdit() {
    return !!user && user.role !== 'visitor';
  }

  function isAdminName() {
    if (!user) return false;
    const member = liveTeam(getActiveProject()).find((m) => m.name === user.name);
    // fall back to the original list only while the crew list is still loading
    return member ? !!member.admin : ADMIN_NAMES.includes(user.name);
  }

  function isAdmin() {
    return canEdit() && isAdminName() && !!user.admin;
  }

  function applyPermissionClasses() {
    document.body.classList.toggle('can-edit', canEdit());
    document.body.classList.toggle('is-admin', isAdmin());
    const adminSection = document.getElementById('admin-section');
    adminSection.classList.toggle('hidden', !isAdminName());
    const toggleBtn = document.getElementById('btn-admin-toggle');
    const toggleText = document.getElementById('admin-toggle-text');
    if (toggleText) toggleText.textContent = `Admin mode: ${isAdmin() ? 'ON' : 'OFF'}`;
    toggleBtn.classList.toggle('active', isAdmin());
    const chip = document.getElementById('user-chip');
    if (user) {
      const who = user.role === 'visitor' ? 'Visitor' : user.name;
      chip.innerHTML = `${iconMarkup(user.role === 'visitor' ? 'eye' : 'user', 'ico ico--sm')}<span>${escapeHtml(who)}</span>`;
      chip.classList.toggle('user-chip--admin', isAdmin());
    } else {
      chip.textContent = '';
    }
  }

  // ---------- auth ----------
  function loadUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name && parsed.role) return parsed;
    } catch (e) { /* noop */ }
    return null;
  }

  function saveUser() {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function loginAs(name, role) {
    user = { name, role, admin: false };
    saveUser();
    document.getElementById('login-overlay').classList.add('hidden');
    applyPermissionClasses();
    render();
    safeFitToContent();
    // Sync starts at boot, before anyone has signed in, so the live stream
    // and its REST calls are anonymous at that point. Restart them now that a
    // token exists, otherwise the stream stays unauthenticated all session.
    startSync();
    maybeRemindBackup();
  }

  function logout() {
    user = null;
    saveUser();
    applyPermissionClasses();
    // the device keeps its team credential on purpose: the next person still
    // has to know the crew password to log in, and a shared tablet must keep
    // working at sea. Changing the password in Firebase revokes every device.
    startSync();
    showLogin();
  }

  function showLogin() {
    pendingLoginName = null;
    document.getElementById('login-password').classList.add('hidden');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-password-input').value = '';
    document.getElementById('login-overlay').classList.remove('hidden');
  }

  // One flowing grid rather than fixed rows: the crew list is editable now, so
  // the layout has to hold together whoever is added or removed.
  function renderLogin() {
    const rows = document.getElementById('login-rows');
    rows.innerHTML = '';
    const team = liveTeam(getActiveProject());
    const div = document.createElement('div');
    div.className = 'login-row';
    team.forEach((m) => {
      const btn = document.createElement('button');
      btn.className = `btn login-name login-name--${m.style === 'orange' ? 'orange' : 'sky'}`;
      btn.textContent = m.name;
      btn.addEventListener('click', () => {
        pendingLoginName = m.name;
        document.getElementById('login-password-label').textContent = `Password for ${m.name}:`;
        document.getElementById('login-password').classList.remove('hidden');
        document.getElementById('login-error').classList.add('hidden');
        const input = document.getElementById('login-password-input');
        input.value = '';
        input.focus();
      });
      div.appendChild(btn);
    });
    rows.appendChild(div);
    if (!team.length) {
      const p = document.createElement('p');
      p.className = 'login-subtitle';
      p.textContent = 'No one on the crew list yet — use Visitor to get in.';
      rows.appendChild(p);
    }
  }

  // ---------- state ----------
  function createEmptyProject(name) {
    return {
      id: uid(),
      name,
      updatedAt: new Date().toISOString(),
      categories: [],
      microVars: [],
      reportTypes: [],
      procedures: {},
      nodes: [],
      connections: [],
      strings: defaultStrings(),
      accessRules: DEFAULT_ACCESS_RULES,
      annotations: [],
      punchList: [],
    };
  }

  function defaultStrings() {
    return STRING_GROUPS.map((_, i) => ({ n: i + 1, srcc: false }));
  }

  // (re)build cable connections from the 8 string groups, tagging each segment
  // with its 0-based string index, matching endpoints by label.
  function rebuildConnections(project) {
    const byLabel = {};
    project.nodes.forEach((n) => { byLabel[n.label] = n; });
    project.connections = [];
    STRING_GROUPS.forEach((edges, si) => {
      edges.forEach(([la, lb]) => {
        if (byLabel[la] && byLabel[lb]) {
          project.connections.push({ id: uid(), a: byLabel[la].id, b: byLabel[lb].id, string: si });
        }
      });
    });
  }

  // The eight tasks, the eight ring tasks and the eight inspections the site
  // started with. Their ids are derived from their names, so two phones that
  // each seeded themselves before ever syncing agree on which task is which —
  // random ids meant the merge had to fall back on matching names, and a rename
  // then produced a duplicate on every other device.
  const SEED_CATEGORIES = [
    { name: 'Tower cabinet rust treatment & rubber placement', color: '#274A72' },
    { name: 'ScotchKoat on earthing cable', color: '#0085AD' },
    { name: 'Grating repair with G8 resin', color: '#6BA539' },
    { name: 'Installed cable tray brackets', color: '#AECB54' },
  ];
  const SEED_MICROVARS = [
    { name: 'Safety pin gate', color: '#F59E0B' },
    { name: 'Hang off platform: caution sign', color: '#8A5CB8' },
    { name: 'Pick up keys', color: '#51B2D1' },
    { name: 'Water ingress check', color: '#C4453C' },
  ];
  const SEED_REPORTS = [
    'Survey In/OUT',
    'Ferry daily check inspection',
    'Control if all Aconex inspections are 100%',
    'SRL load indicator report',
    'Guano on all platforms & smells report',
    'Boatlanding tracking on SharePoint',
    'Cable cleats report',
    'Punch',
  ];

  const slug = (name) => String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function taskSeedId(name) { return `task-${slug(name)}`; }
  function reportSeedId(name) { return `rep-${slug(name)}`; }

  function defaultReportTypes() {
    return SEED_REPORTS.map((name) => ({ id: reportSeedId(name), name }));
  }

  function normalizeNode(node, project) {
    node.status = node.status || {};
    node.micro = node.micro || {};
    node.taskComments = node.taskComments || {};
    node.reports = node.reports || {};
    [node.status, node.micro].forEach((map) => {
      Object.keys(map).forEach((k) => {
        if (map[k] === true) map[k] = { at: null, by: null };
        else if (map[k] === false) map[k] = null;
      });
    });
    project.categories.concat(project.microVars).forEach((item) => {
      if (!(item.id in node.status) && !(item.id in node.micro)) {
        (project.categories.includes(item) ? node.status : node.micro)[item.id] = null;
      }
    });
  }

  function normalizeProject(project) {
    project.categories = project.categories || [];
    project.microVars = project.microVars || [];
    project.connections = project.connections || [];
    project.punchList = project.punchList || [];
    project.procedures = project.procedures || {};
    project.annotations = project.annotations || [];
    project.suggestions = project.suggestions || [];
    trimActivity(project);
    if (!Array.isArray(project.team) || !project.team.length) project.team = defaultTeam();
    project.team.forEach((m) => {
      if (!m.id) m.id = uid();
      if (m.style !== 'orange') m.style = 'sky';
      if (!m.updatedAt) m.updatedAt = new Date(0).toISOString();
    });
    // Repair lists already stacked by the random-id bug: collapse by name and
    // tombstone the extras. Keeping the smallest id makes every device pick the
    // same survivor on its own, so they all converge without talking.
    const seenNames = new Map();
    project.team.forEach((m) => {
      if (m.deleted || !m.name) return;
      const key = String(m.name).trim().toLowerCase();
      if (!key) return;
      const kept = seenNames.get(key);
      if (!kept) { seenNames.set(key, m); return; }
      const winner = m.id < kept.id ? m : kept;
      const loser = m.id < kept.id ? kept : m;
      winner.admin = winner.admin || loser.admin; // never silently drop admin rights
      loser.deleted = true;
      loser.deletedAt = loser.deletedAt || new Date().toISOString();
      seenNames.set(key, winner);
    });
    // seeded with the eight real strings, but an admin can add more, so only
    // top the list up — never truncate it back to eight
    if (!Array.isArray(project.strings) || project.strings.length < STRING_GROUPS.length) {
      const kept = Array.isArray(project.strings) ? project.strings : [];
      project.strings = defaultStrings().map((s, i) => kept[i] || s);
    }
    project.strings.forEach((s, i) => {
      if (typeof s.n !== 'number') s.n = i + 1;
      if (!Array.isArray(s.picks)) delete s.picks;
    });
    // elbows are stored on the cable, capped so a segment stays readable
    (project.connections || []).forEach((c) => {
      if (!Array.isArray(c.bends)) { delete c.bends; return; }
      c.bends = c.bends.filter((b) => b && Number.isFinite(b.x) && Number.isFinite(b.y)).slice(0, MAX_BENDS);
      c.bends = c.bends.map((b) => clampToContent(b, project));
      if (!c.bends.length) delete c.bends;
    });
    if (typeof project.accessRules !== 'string') project.accessRules = DEFAULT_ACCESS_RULES;
    if (!Array.isArray(project.reportTypes) || !project.reportTypes.length) {
      project.reportTypes = defaultReportTypes();
    }
    // structured consumables live on each procedure
    Object.values(project.procedures).forEach((proc) => {
      if (!proc) return;
      if (!Array.isArray(proc.consumables)) proc.consumables = [];
      // tools & PPE used to be a single field shared by both languages, so
      // writing them in French silently replaced the English ones. Split them
      // per language, keeping the old text on both sides so nothing already
      // written is lost — the reader is then warned that one side needs review.
      ['tools', 'ppe'].forEach((base) => {
        if (typeof proc[base] !== 'string') return;
        const legacy = proc[base];
        if (legacy.trim()) {
          if (!proc[`${base}_en`]) proc[`${base}_en`] = legacy;
          if (!proc[`${base}_fr`]) proc[`${base}_fr`] = legacy;
        }
        delete proc[base];
        const stamp = proc.sectionUpdated && proc.sectionUpdated[base];
        if (stamp) {
          proc.sectionUpdated[`${base}_en`] = proc.sectionUpdated[`${base}_en`] || stamp;
          proc.sectionUpdated[`${base}_fr`] = proc.sectionUpdated[`${base}_fr`] || stamp;
          delete proc.sectionUpdated[base];
        }
      });
    });
    // rename the historical seed project
    if (project.name === 'Dieppe Le Tréport — 62 FOU' || project.name === 'BOP tasks on tre FOU') project.name = 'Op BOP tre FOU';
    // purge punch tombstones older than 30 days
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    project.punchList = project.punchList.filter(
      (p) => !p.deleted || new Date(p.updatedAt || 0).getTime() > cutoff,
    );
    (project.nodes || []).forEach((n) => normalizeNode(n, project));

    // This is the real wind farm, not a blank site: 62 foundations, 8 strings,
    // an OSS in the middle. Nothing more will ever be built here, so the tools
    // that add to the layout are switched off. A project made for another site
    // has no OSS and keeps them.
    if (project.fixedLayout === undefined) {
      project.fixedLayout = (project.nodes || []).some((n) => n.label === 'OSS');
    }

    // one-shot layout migration: grid corrected against the official
    // spreadsheet (J02 removed, L03 added), cables rebuilt, brand colors
    if ((project.layoutVersion || 0) < LAYOUT_VERSION) {
      project.nodes = project.nodes.filter((n) => n.label !== 'J02');
      if (!project.nodes.some((n) => n.label === 'L03')) {
        const l03 = {
          id: uid(),
          label: 'L03',
          x: 0,
          y: 0,
          status: {},
          micro: {},
          taskComments: {},
          reports: {},
          issue: false,
          note: '',
        };
        normalizeNode(l03, project);
        project.nodes.push(l03);
      }
      rebuildConnections(project);
      const brandColors = {
        'Tower cabinet rust treatment & rubber placement': '#274A72',
        'ScotchKoat on earthing cable': '#0085AD',
        'Grating repair with G8 resin': '#6BA539',
        'Installed cable tray brackets': '#AECB54',
        'Safety pin gate': '#F59E0B',
        'Hang off platform: caution sign': '#8A5CB8',
        'Pick up keys': '#51B2D1',
        'Water ingress check': '#C4453C',
      };
      project.categories.concat(project.microVars).forEach((item) => {
        if (brandColors[item.name]) item.color = brandColors[item.name];
      });
      project.layoutVersion = LAYOUT_VERSION;
    }

    // carry this device's old local read-record into the project once, so the
    // first sync after this ships shares what people have already read
    if (!project.procSeen) {
      project.procSeen = {};
      try {
        const all = JSON.parse(localStorage.getItem('worksite-tracker:procSeen') || '{}');
        Object.entries(all).forEach(([who, seen]) => {
          if (seen && typeof seen === 'object') project.procSeen[who] = Object.assign({}, seen);
        });
      } catch (e) { project.procSeen = {}; }
    }

    // One-shot identity repair. The seeded tasks and inspections used to get a
    // random id per device, so two phones that each set themselves up before
    // ever syncing disagreed on which task is which. The merge papered over it
    // by matching names — until someone renamed one, and every other device
    // grew a duplicate. Give the seeded ones an id derived from their name and
    // carry every reference across: nothing is lost, the id is just renamed.
    (function repairSeedIds() {
      const wanted = {};
      SEED_CATEGORIES.forEach((c) => { wanted[c.name.trim().toLowerCase()] = taskSeedId(c.name); });
      SEED_MICROVARS.forEach((c) => { wanted[c.name.trim().toLowerCase()] = taskSeedId(c.name); });
      const wantedReport = {};
      SEED_REPORTS.forEach((n) => { wantedReport[n.trim().toLowerCase()] = reportSeedId(n); });

      const rename = {};
      const claim = (list, table) => {
        (list || []).forEach((item) => {
          if (!item || !item.name) return;
          const want = table[item.name.trim().toLowerCase()];
          if (!want || want === item.id) return;
          // never collide with an id that is already in use
          if ((list || []).some((o) => o !== item && o.id === want)) return;
          rename[item.id] = want;
          item.id = want;
        });
      };
      claim(project.categories, wanted);
      claim(project.microVars, wanted);
      claim(project.reportTypes, wantedReport);
      if (!Object.keys(rename).length) return;

      const remapKeys = (obj) => {
        if (!obj) return obj;
        const out = {};
        Object.entries(obj).forEach(([k, v]) => { out[rename[k] || k] = v; });
        return out;
      };
      (project.nodes || []).forEach((n) => {
        n.status = remapKeys(n.status);
        n.micro = remapKeys(n.micro);
        n.taskComments = remapKeys(n.taskComments);
        n.reports = remapKeys(n.reports);
      });
      project.procedures = remapKeys(project.procedures);
      Object.keys(project.procSeen || {}).forEach((who) => {
        project.procSeen[who] = remapKeys(project.procSeen[who]);
      });
      // today's picked tasks, kept on this device and keyed by task id
      try {
        const plan = JSON.parse(localStorage.getItem('worksite-tracker:dayplan') || '{}');
        if (plan && typeof plan === 'object') {
          localStorage.setItem('worksite-tracker:dayplan', JSON.stringify(remapKeys(plan)));
        }
      } catch (e) { /* the day plan is rebuilt in one tap anyway */ }
    })();

    // Cables drawn by hand before this version carry no string, so they show no
    // number on the map and can never be flagged SRCC. Adopt the string their
    // two ends already share. Repeated because fixing one cable can make the
    // next one unambiguous; three passes settle any chain worth guessing at.
    for (let pass = 0; pass < 3; pass += 1) {
      let fixed = 0;
      (project.connections || []).forEach((c) => {
        if (typeof c.string === 'number') return;
        const si = inferString(project, c.a, c.b);
        if (typeof si === 'number') { c.string = si; fixed += 1; }
      });
      if (!fixed) break;
    }

    // positions are derived data: pin every known point to its real
    // geographic location (north up)
    (project.nodes || []).forEach((n) => {
      const c = COORDS[n.label];
      if (c) {
        const pos = geoToWorld(c[0], c[1]);
        n.x = pos.x;
        n.y = pos.y;
      }
    });
    return project;
  }

  function seedWindFarmProject() {
    const project = createEmptyProject('Op BOP tre FOU');

    project.layoutVersion = LAYOUT_VERSION;

    project.categories = SEED_CATEGORIES.map((c) => ({ id: taskSeedId(c.name), ...c }));
    project.microVars = SEED_MICROVARS.map((c) => ({ id: taskSeedId(c.name), ...c }));

    project.reportTypes = defaultReportTypes();

    COLS.forEach((col, colIndex) => {
      (COLUMN_ROWS[col] || []).forEach((row) => {
        const label = fouLabel(col, row);
        const pos = nodePosition(label, colIndex, row);
        const node = {
          id: uid(),
          label,
          x: pos.x,
          y: pos.y,
          status: {},
          micro: {},
          taskComments: {},
          reports: {},
          issue: false,
          note: '',
        };
        project.categories.forEach((cat) => { node.status[cat.id] = null; });
        project.microVars.forEach((mv) => { node.micro[mv.id] = null; });
        project.nodes.push(node);
      });
    });

    // offshore substation (OSS) — real position, not one of the 62 foundations
    const ossPos = geoToWorld(COORDS.OSS[0], COORDS.OSS[1]);
    project.nodes.push({
      id: uid(),
      label: 'OSS',
      x: ossPos.x,
      y: ossPos.y,
      status: {},
      micro: {},
      taskComments: {},
      reports: {},
      issue: false,
      note: 'Offshore substation',
      substation: true,
    });

    rebuildConnections(project);

    return project;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.projects && parsed.activeProjectId) {
          // Normalising is a convenience; the saved work is the valuable part.
          // A throw in here used to fall through and reseed a blank site, so a
          // single bad field silently wiped everything anyone had recorded.
          Object.values(parsed.projects).forEach((p) => {
            try { normalizeProject(p); } catch (err) { console.error('normalize failed, project kept as-is', err); }
          });
          return parsed;
        }
      } catch (e) { /* genuinely unreadable JSON — fall through to seed */ }
    }
    const demo = seedWindFarmProject();
    // a brand-new install has to go through the same normalisation as a loaded
    // one, otherwise every migration silently skips first-time devices
    normalizeProject(demo);
    return { activeProjectId: demo.id, projects: { [demo.id]: demo } };
  }

  let storageWarned = false;

  // Worksite records are meant to be kept for good, so a failed write must never
  // pass unnoticed. This used to be a bare setItem: once the device filled up it
  // threw, the change was lost, and nothing said so.
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageWarned = false;
      return true;
    } catch (err) {
      // Make room from the copies, never from the original: the daily snapshots
      // are a safety net, the project is the record.
      let freed = false;
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(SNAP_PREFIX))
          .sort()
          .forEach((k) => { localStorage.removeItem(k); freed = true; });
      } catch (e) { /* nothing to free */ }
      if (freed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          return true;
        } catch (e) { /* still full */ }
      }
      if (!storageWarned) {
        storageWarned = true;
        showToast('This device is out of storage — export a backup now, from Share & backup.');
      }
      console.error('saveState failed', err);
      return false;
    }
  }

  // ---------- data safety ----------
  const SNAP_PREFIX = 'worksite-tracker:snap:';

  // one automatic local snapshot per day (last 5 kept) to recover from mistakes
  function dailySnapshot() {
    try {
      const key = SNAP_PREFIX + new Date().toISOString().slice(0, 10);
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(SNAP_PREFIX)).sort();
      while (keys.length > 5) localStorage.removeItem(keys.shift());
    } catch (e) { /* storage full — never block the app */ }
  }

  function maybeRemindBackup() {
    if (!canEdit()) return;
    const project = getActiveProject();
    if (!project) return;
    const hasData = project.nodes.some((n) => Object.values(n.status).some(Boolean)
      || Object.values(n.micro).some(Boolean)
      || Object.keys(n.reports || {}).some((k) => (n.reports[k] || []).length));
    if (!hasData) return;
    const last = state.lastExportAt ? new Date(state.lastExportAt).getTime() : 0;
    if (Date.now() - last > 24 * 3600 * 1000) {
      setTimeout(() => showToast('Tip: export a backup (right panel) — data lives only on this device.'), 1800);
    }
  }

  function markExported() {
    state.lastExportAt = new Date().toISOString();
    saveState();
  }

  // Merge a project exported from another phone into the local one:
  // categories/reports are matched by name, each task keeps the most recent
  // stamp, report occurrences are unioned — nothing is ever deleted.
  // A task deleted on one phone used to come straight back from the next one
  // to sync, because a union by id has no way to tell "never existed here" from
  // "was removed here". The id is remembered instead, for a month.
  const TOMBSTONE_MS = 30 * 24 * 3600 * 1000;

  function tombstones(project, kind) {
    project.tombstones = project.tombstones || {};
    project.tombstones[kind] = project.tombstones[kind] || {};
    return project.tombstones[kind];
  }

  function tombstone(project, kind, id) {
    tombstones(project, kind)[id] = new Date().toISOString();
  }

  function pruneTombstones(project) {
    Object.values(project.tombstones || {}).forEach((map) => {
      Object.entries(map).forEach(([id, at]) => {
        if (Date.now() - new Date(at || 0).getTime() > TOMBSTONE_MS) delete map[id];
      });
    });
  }

  function mergeProjects(target, incoming) {
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

    const mergeItems = (fromList, toList, maxLen, kind, drop) => {
      const map = {};
      const gone = tombstones(target, kind);
      (fromList || []).forEach((item) => {
        if (!item || !item.id) return;
        if (gone[item.id]) return; // removed here: do not resurrect it
        let match = toList.find((t) => t.id === item.id)
          // an item created independently on two devices has two ids and one
          // name; the name is all we have to recognise it by
          || toList.find((t) => t.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (!match) {
          if (toList.length >= maxLen) return;
          match = { id: item.id, name: item.name, color: item.color, updatedAt: item.updatedAt };
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
          if (item.hidden) match.hidden = true; else delete match.hidden;
          match.updatedAt = item.updatedAt;
        }
        map[item.id] = match.id;
      });
      // and anything this device is holding that the other side buried
      for (let i = toList.length - 1; i >= 0; i -= 1) {
        if (gone[toList[i].id]) { drop(toList[i]); toList.splice(i, 1); }
      }
      return map;
    };

    const dropTask = (item) => {
      (target.nodes || []).forEach((n) => {
        delete n.status[item.id]; delete n.micro[item.id]; delete n.taskComments[item.id];
      });
      if (target.procedures) delete target.procedures[item.id];
    };
    const dropReport = (item) => {
      (target.nodes || []).forEach((n) => { delete n.reports[item.id]; });
    };

    const catMap = mergeItems(incoming.categories, target.categories, MAX_CATEGORIES, 'tasks', dropTask);
    const microMap = mergeItems(incoming.microVars, target.microVars, MAX_MICRO, 'tasks', dropTask);
    const reportMap = mergeItems(incoming.reportTypes, target.reportTypes, 99, 'reports', dropReport);
    pruneTombstones(target);
    target.nodes.forEach((n) => normalizeNode(n, target));

    const newer = (a, b) => {
      if (!a) return b || null;
      if (!b) return a;
      return new Date(b.at || 0).getTime() > new Date(a.at || 0).getTime() ? b : a;
    };

    (incoming.nodes || []).forEach((inNode) => {
      const tNode = target.nodes.find((n) => n.label === inNode.label);
      if (!tNode) return;
      const mergeStampMap = (map) => {
        Object.entries(map || {}).forEach(([id, stamp]) => {
          const tid = catMap[id] || microMap[id];
          if (!tid) return;
          const bucket = (tid in tNode.status) ? tNode.status : tNode.micro;
          bucket[tid] = newer(bucket[tid], stamp);
        });
      };
      mergeStampMap(inNode.status);
      mergeStampMap(inNode.micro);
      Object.entries(inNode.taskComments || {}).forEach(([id, comment]) => {
        const tid = catMap[id] || microMap[id];
        if (!tid || !comment) return;
        const merged = pickText(tNode.taskComments[tid], comment);
        if (merged) tNode.taskComments[tid] = merged;
      });
      Object.entries(inNode.reports || {}).forEach(([id, entries]) => {
        const tid = reportMap[id];
        if (!tid) return;
        const existing = tNode.reports[tid] || [];
        const seen = new Set(existing.map((en) => `${en.at}|${en.by}`));
        (entries || []).forEach((en) => {
          const key = `${en.at}|${en.by}`;
          if (!seen.has(key)) { existing.push(en); seen.add(key); }
        });
        existing.sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
        tNode.reports[tid] = existing;
      });
      if (inNode.issue) tNode.issue = true;
      tNode.note = pickText(tNode.note, inNode.note);
    });

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
      const tid = catMap[id] || microMap[id];
      if (!tid) return;
      const tProc = getProcedure(target, tid);
      PROC_TEXT_KEYS.forEach((k) => {
        tProc[k] = pickText(tProc[k], proc && proc[k]);
      });
      // keep the most recent "changed" stamp per section so every device
      // flags the same updates
      const inStamps = (proc && proc.sectionUpdated) || {};
      Object.keys(inStamps).forEach((k) => {
        const a = new Date(tProc.sectionUpdated[k] || 0).getTime();
        const bTime = new Date(inStamps[k] || 0).getTime();
        if (bTime > a) { tProc.sectionUpdated[k] = inStamps[k]; tProc.updatedBy = proc.updatedBy || tProc.updatedBy; }
      });
      // consumables: union by name, restock flag OR-ed
      if (Array.isArray(proc && proc.consumables)) {
        tProc.consumables = tProc.consumables || [];
        proc.consumables.forEach((c) => {
          if (!c || !c.name) return;
          const found = tProc.consumables.find((x) => normalizeName(x.name) === normalizeName(c.name));
          if (found) found.restock = found.restock || !!c.restock;
          else tProc.consumables.push({ name: c.name, restock: !!c.restock });
        });
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
    target.accessRules = pickText(target.accessRules, incoming.accessRules);

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
    incoming.categories.concat(incoming.microVars || []).forEach((ic) => {
      const tid = catMap[ic.id] || microMap[ic.id];
      if (!tid) return;
      const titem = target.categories.concat(target.microVars).find((t) => t.id === tid);
      if (titem && ic.hidden) titem.hidden = true;
    });
  }

  // Deterministic text merge (both devices converge to the same value):
  // longer text wins, ties broken lexicographically.
  function pickText(a, b) {
    const ta = (a || '').trim();
    const tb = (b || '').trim();
    if (!tb) return ta;
    if (!ta) return tb;
    if (ta.length !== tb.length) return ta.length > tb.length ? ta : tb;
    return ta > tb ? ta : tb;
  }

  // ---------- team sync (Firebase Realtime Database, REST + SSE) ----------
  // Set SYNC_DB_URL to the team database URL, e.g.
  // 'https://trefou-default-rtdb.europe-west1.firebasedatabase.app'
  // Empty string = sync disabled, the app works purely locally.
  const SYNC_DB_URL = 'https://op-bop-tre-fou-default-rtdb.europe-west1.firebasedatabase.app';
  const SYNC_URL_OVERRIDE_KEY = 'worksite-tracker:syncUrl';

  // ---------- team account (write protection) ----------
  // Without this, the database URL sits in this file — which every browser
  // downloads — so anyone who reads the page source can write to the team's
  // data. With it, the crew password is checked by Firebase instead of by
  // this file, and only a signed-in device may write.
  // Leave SYNC_API_KEY empty to keep the previous open behaviour.
  const SYNC_API_KEY = '';
  const TEAM_EMAIL = 'crew@op-bop-tre-fou.app';
  const AUTH_KEY = 'worksite-tracker:auth';

  const auth = { idToken: null, refreshToken: null, expiresAt: 0 };

  function authConfigured() { return !!SYNC_API_KEY; }

  function loadAuth() {
    try {
      const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (saved && saved.refreshToken) {
        auth.refreshToken = saved.refreshToken;
        auth.idToken = saved.idToken || null;
        auth.expiresAt = saved.expiresAt || 0;
      }
    } catch (e) { /* noop */ }
  }

  function saveAuth() {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({
        refreshToken: auth.refreshToken, idToken: auth.idToken, expiresAt: auth.expiresAt,
      }));
    } catch (e) { /* noop */ }
  }

  function clearAuth() {
    auth.idToken = null; auth.refreshToken = null; auth.expiresAt = 0;
    try { localStorage.removeItem(AUTH_KEY); } catch (e) { /* noop */ }
  }

  // this device has signed in successfully at least once
  function deviceTrusted() { return !!auth.refreshToken; }

  // Returns 'ok' | 'wrong-password' | 'offline'
  async function signInTeam(password) {
    if (!authConfigured()) return 'ok';
    let res;
    try {
      res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${SYNC_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEAM_EMAIL, password, returnSecureToken: true }),
      });
    } catch (e) {
      return 'offline'; // no network: caller decides whether to let them work locally
    }
    if (!res.ok) return 'wrong-password';
    const data = await res.json();
    auth.idToken = data.idToken;
    auth.refreshToken = data.refreshToken;
    auth.expiresAt = Date.now() + (Number(data.expiresIn || 3600) - 60) * 1000;
    saveAuth();
    return 'ok';
  }

  // Keeps a usable token around; returns null when offline or not signed in,
  // and the app then simply works locally until the connection is back.
  async function ensureAuthToken() {
    if (!authConfigured()) return null;
    if (auth.idToken && Date.now() < auth.expiresAt) return auth.idToken;
    if (!auth.refreshToken) return null;
    try {
      const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${SYNC_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}`,
      });
      if (!res.ok) {
        // the account or its password changed: force a fresh sign-in
        if (res.status === 400) clearAuth();
        return null;
      }
      const data = await res.json();
      auth.idToken = data.id_token;
      auth.refreshToken = data.refresh_token || auth.refreshToken;
      auth.expiresAt = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000;
      saveAuth();
      return auth.idToken;
    } catch (e) {
      return null;
    }
  }

  async function authedUrl(base) {
    const token = await ensureAuthToken();
    if (!token) return base;
    return `${base}${base.includes('?') ? '&' : '?'}auth=${encodeURIComponent(token)}`;
  }

  const sync = {
    status: 'off', // 'off' | 'live' | 'syncing' | 'offline'
    dirty: false,
    es: null,
    url: null,
    pullTimer: null,
    pushTimer: null,
    retryTimer: null,
    pollTimer: null,
    busy: false,
  };

  function syncBaseUrl() {
    return (localStorage.getItem(SYNC_URL_OVERRIDE_KEY) || SYNC_DB_URL || '').replace(/\/+$/, '');
  }

  function projectSlug(name) {
    return String(name || 'project')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project';
  }

  function syncProjectUrl() {
    const base = syncBaseUrl();
    const project = getActiveProject();
    if (!base || !project) return null;
    return `${base}/projects/${projectSlug(project.name)}.json`;
  }

  function setSyncStatus(status) {
    sync.status = status;
    const chip = document.getElementById('sync-chip');
    if (!chip) return;
    if (status === 'off') { chip.classList.add('hidden'); return; }
    chip.classList.remove('hidden');
    chip.classList.remove('sync-live', 'sync-syncing', 'sync-offline', 'sync-locked');
    // the word is wrapped so narrow phones can keep just the dot and leave
    // the project name room to breathe
    // a status light, not a glyph: on a narrow phone only the dot survives and
    // a bare "○" in a box read as an unfinished control
    const dot = '<span class="sync-dot"></span>';
    if (status === 'live') { chip.classList.add('sync-live'); chip.innerHTML = `${dot}<span class="sync-word">live</span>`; chip.title = 'Synced with the team in real time'; }
    else if (status === 'syncing') { chip.classList.add('sync-syncing'); chip.innerHTML = `${dot}<span class="sync-word">sync</span>`; chip.title = 'Syncing…'; }
    else if (status === 'unauthorised') { chip.classList.add('sync-locked'); chip.innerHTML = `${iconMarkup('warn', 'ico ico--sm')}<span class="sync-word">sign in</span>`; chip.title = 'Your work is saved on this device but the database refused it. Log out and sign in again with the crew password.'; }
    else { chip.classList.add('sync-offline'); chip.innerHTML = `${dot}<span class="sync-word">offline</span>`; chip.title = 'No connection — working locally, will sync when back online'; }
  }

  // Order-independent digest of the data that matters, so two devices can
  // tell whether they hold the same information (colors/positions excluded).
  function projectDigest(project) {
    const lines = [];
    const itemName = {};
    project.categories.concat(project.microVars).forEach((i) => { itemName[i.id] = i.name; });
    const reportName = {};
    (project.reportTypes || []).forEach((r) => { reportName[r.id] = r.name; });
    project.categories.concat(project.microVars).forEach((i) => {
      lines.push(`C|${i.id}|${i.name}|${i.color || ''}|${i.hidden ? 1 : 0}|${i.updatedAt || ''}`);
    });
    (project.reportTypes || []).forEach((r) => lines.push(`Y|${r.id}|${r.name}|${r.updatedAt || ''}`));
    Object.entries(project.tombstones || {}).forEach(([kind, map]) => {
      Object.entries(map || {}).forEach(([id, at]) => lines.push(`Z|${kind}|${id}|${at}`));
    });
    (project.nodes || []).forEach((n) => {
      [n.status || {}, n.micro || {}].forEach((map) => {
        Object.entries(map).forEach(([id, st]) => {
          if (st) lines.push(`S|${n.label}|${itemName[id] || id}|${st.partial ? 'p' : 'd'}|${st.at || ''}|${st.by || ''}`);
        });
      });
      Object.entries(n.taskComments || {}).forEach(([id, c]) => {
        if (c) lines.push(`K|${n.label}|${itemName[id] || id}|${c}`);
      });
      Object.entries(n.reports || {}).forEach(([id, entries]) => {
        (entries || []).forEach((e) => lines.push(`R|${n.label}|${reportName[id] || id}|${e.at || ''}|${e.by || ''}`));
      });
      if (n.note) lines.push(`N|${n.label}|${n.note}`);
      if (n.issue) lines.push(`X|${n.label}`);
    });
    (project.punchList || []).forEach((p) => {
      lines.push(`P|${p.text}|${p.done ? 1 : 0}|${p.deleted ? 1 : 0}|${p.updatedAt || ''}`);
    });
    (project.strings || []).forEach((s, i) => lines.push(`G|${i}|${s.srcc ? 1 : 0}|${s.srccAt || ''}`));
    // the cable layout: without this a re-routed cable changed nothing the
    // sync could see, so the correction never left the device it was made on
    const nodeLabel = {};
    (project.nodes || []).forEach((n) => { nodeLabel[n.id] = n.label; });
    (project.connections || []).forEach((c) => {
      const ends = [nodeLabel[c.a] || c.a, nodeLabel[c.b] || c.b].sort().join('-');
      const bends = (c.bends || []).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
      lines.push(`E|${ends}|${typeof c.string === 'number' ? c.string : ''}|${bends}`);
    });
    (project.permits || []).forEach((p) => {
      lines.push(`Q|${p.id}|${p.kind}|${p.number}|${p.srcc ? 1 : 0}|${p.deleted ? 1 : 0}|${p.updatedAt || p.at || ''}`);
    });
    Object.entries(project.procSeen || {}).forEach(([who, seen]) => {
      Object.entries(seen || {}).forEach(([itemId, at]) => lines.push(`V|${who}|${itemId}|${at}`));
    });
    lines.push(`A|${project.accessRules || ''}`);
    (project.activity || []).forEach((e) => lines.push(`L|${e.id}`));
    (project.team || []).forEach((m) => lines.push(`W|${m.id}|${m.name}|${m.admin ? 1 : 0}|${m.style}|${m.deleted ? 1 : 0}|${m.updatedAt || ''}`));
    (project.annotations || []).forEach((an) => lines.push(`T|${an.id}|${an.text}|${an.size}|${Math.round(an.x)}|${Math.round(an.y)}|${an.deleted ? 1 : 0}`));
    (project.suggestions || []).forEach((s) => lines.push(`U|${s.id}|${s.text}|${s.at || ''}|${s.deleted ? 1 : 0}`));
    Object.entries(project.procedures || {}).forEach(([id, proc]) => {
      if (!proc) return;
      const body = PROC_TEXT_KEYS.map((k) => proc[k] || '').join('|');
      const cons = (proc.consumables || []).map((c) => `${c.name}:${c.restock ? 1 : 0}`).join(',');
      const upd = Object.entries(proc.sectionUpdated || {}).sort()
        .map(([k, v]) => `${k}@${v}`).join(',');
      if (body.replace(/\|/g, '') || cons) lines.push(`M|${itemName[id] || id}|${body}|${cons}|${upd}`);
    });
    return lines.sort().join('\n');
  }

  function markSyncDirty() {
    if (sync.status === 'off' || !canEdit()) return;
    sync.dirty = true;
    clearTimeout(sync.pushTimer);
    sync.pushTimer = setTimeout(syncPush, 1500);
  }

  async function syncFetchRemote() {
    const res = await fetch(await authedUrl(sync.url), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`GET ${res.status}`);
    return res.json();
  }

  // pull remote state and merge it into the local project (nothing is lost:
  // per-task most recent wins, reports/punch are unioned)
  async function syncPull() {
    if (!sync.url || sync.busy) return;
    sync.busy = true;
    try {
      setSyncStatus('syncing');
      const remote = await syncFetchRemote();
      const project = getActiveProject();
      if (remote && Array.isArray(remote.nodes)) {
        normalizeProject(remote);
        const digestBefore = projectDigest(project);
        mergeProjects(project, remote);
        normalizeProject(project);
        const digestAfter = projectDigest(project);
        if (digestAfter !== digestBefore) {
          saveState();
          refreshAfterRemoteChange();
          showToast('Updated from the team');
        }
        // local holds info the server lacks → push it
        if (canEdit() && digestAfter !== projectDigest(remote)) {
          sync.dirty = true;
        }
      } else if (canEdit()) {
        sync.dirty = true; // empty space: we are the first device, seed it
      }
      if (sync.dirty && canEdit()) {
        clearTimeout(sync.pushTimer);
        sync.pushTimer = setTimeout(syncPush, 400);
      }
      setSyncStatus('live');
    } catch (e) {
      setSyncStatus('offline');
      scheduleSyncRetry();
    } finally {
      sync.busy = false;
    }
  }

  async function syncPush() {
    if (!sync.url || !canEdit()) return;
    if (sync.busy) { clearTimeout(sync.pushTimer); sync.pushTimer = setTimeout(syncPush, 800); return; }
    sync.busy = true;
    try {
      setSyncStatus('syncing');
      const project = getActiveProject();
      // merge latest remote first so a PUT never erases teammates' work
      try {
        const remote = await syncFetchRemote();
        if (remote && Array.isArray(remote.nodes)) {
          normalizeProject(remote);
          mergeProjects(project, remote);
          normalizeProject(project);
          saveState();
        }
      } catch (e) { /* remote unreachable — try the PUT anyway */ }
      const res = await fetch(await authedUrl(sync.url), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      // 401/403 means the database refused an unauthenticated write: the work
      // is safe locally, it just cannot leave this device until sign-in works
      if (res.status === 401 || res.status === 403) {
        setSyncStatus('unauthorised');
        sync.busy = false;
        return;
      }
      if (!res.ok) throw new Error(`PUT ${res.status}`);
      sync.dirty = false;
      setSyncStatus('live');
    } catch (e) {
      setSyncStatus('offline');
      scheduleSyncRetry();
    } finally {
      sync.busy = false;
    }
  }

  function scheduleSyncRetry() {
    clearTimeout(sync.retryTimer);
    sync.retryTimer = setTimeout(() => {
      if (sync.status === 'offline') startSync();
    }, 10000);
  }

  function schedulePull(delay) {
    clearTimeout(sync.pullTimer);
    sync.pullTimer = setTimeout(syncPull, delay);
  }

  // lightweight refresh that leaves any text field the user is typing in alone
  function refreshAfterRemoteChange() {
    renderCanvas();
    renderProgress();
    renderPunchList();
    renderHeader();
    const modalOpen = !document.getElementById('node-modal').classList.contains('hidden');
    if (modalOpen && openNodeId) {
      const node = currentModalNode();
      const project = getActiveProject();
      if (node && !node.substation) {
        refreshModalTasks(node);
        renderModalReports(node);
      }
    }
  }

  function stopSync() {
    if (sync.es) { try { sync.es.close(); } catch (e) { /* noop */ } sync.es = null; }
    clearTimeout(sync.pullTimer);
    clearTimeout(sync.pushTimer);
    clearTimeout(sync.retryTimer);
    clearInterval(sync.pollTimer);
  }

  async function startSync() {
    stopSync();
    sync.url = syncProjectUrl();
    if (!sync.url) { setSyncStatus('off'); return; }
    setSyncStatus('syncing');
    syncPull();
    // Firebase RTDB streams changes over SSE on the same REST URL
    try {
      sync.es = new EventSource(await authedUrl(sync.url));
      const onRemoteEvent = () => schedulePull(600);
      sync.es.addEventListener('put', onRemoteEvent);
      sync.es.addEventListener('patch', onRemoteEvent);
      sync.es.onerror = () => {
        // EventSource retries by itself; if it gave up, fall back to retry loop
        if (sync.es && sync.es.readyState === 2) {
          setSyncStatus('offline');
          scheduleSyncRetry();
        }
      };
    } catch (e) { /* SSE unavailable — polling below still covers us */ }
    // safety-net poll in case an SSE event is missed
    sync.pollTimer = setInterval(() => syncPull(), 60000);
  }

  function touchAndSave() {
    const project = getActiveProject();
    if (project) project.updatedAt = new Date().toISOString();
    saveState();
    markSyncDirty();
  }

  // "Newer wins" only works if a new stamp really is newer. Phone clocks drift,
  // and a stamp that arrived from a device running ten minutes fast would sit in
  // the future: every later edit here would look older and be thrown away. So a
  // stamp is always at least one millisecond past whatever it replaces.
  function stampAfter(previous) {
    const prev = new Date(previous || 0).getTime();
    const now = Date.now();
    return new Date(Number.isFinite(prev) && prev >= now ? prev + 1 : now).toISOString();
  }

  // The cable layout is one drawing, not a bag of independent facts: it travels
  // between devices as a block, most recently edited wins (see mergeProjects).
  // Every edit to a cable stamps it, so the other phones know whose routing is
  // the newer one.
  function touchCables(projectArg) {
    const project = projectArg || getActiveProject();
    if (project) project.cablesAt = stampAfter(project.cablesAt);
  }

  function getActiveProject() {
    return state.projects[state.activeProjectId];
  }

  // ---------- grid -> world position (keeps the map orientation) ----------
  function gridToWorld(colIndex, row) {
    return {
      x: (colIndex - row) * GRID_UNIT,
      y: -(colIndex + row) * GRID_UNIT,
    };
  }

  // ---------- mutations ----------
  function deleteNode(nodeId) {
    const project = getActiveProject();
    project.nodes = project.nodes.filter((n) => n.id !== nodeId);
    project.connections = project.connections.filter((c) => c.a !== nodeId && c.b !== nodeId);
    touchCables();
    touchAndSave();
    render();
  }

  function deleteConnection(connId) {
    const project = getActiveProject();
    const conn = project.connections.find((c) => c.id === connId);
    if (conn) logActivity('string', `Cable ${cableName(project, conn)} removed`);
    project.connections = project.connections.filter((c) => c.id !== connId);
    touchCables();
    touchAndSave();
    render();
  }


  // ---------- cable geometry ----------
  function cablePoints(conn, a, b) {
    const pts = [{ x: a.x, y: a.y }];
    (conn.bends || []).forEach((bend) => pts.push({ x: bend.x, y: bend.y }));
    pts.push({ x: b.x, y: b.y });
    return pts;
  }

  // halfway along the drawn route, not halfway between the two foundations —
  // otherwise the string number floats off the cable as soon as it bends
  function pathMidpoint(pts) {
    let total = 0;
    const segs = [];
    for (let i = 1; i < pts.length; i += 1) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segs.push(d);
      total += d;
    }
    let target = total / 2;
    for (let i = 0; i < segs.length; i += 1) {
      if (target <= segs[i] || i === segs.length - 1) {
        const t = segs[i] ? target / segs[i] : 0;
        return {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
        };
      }
      target -= segs[i];
    }
    return pts[0];
  }

  function stringNumber(project, index) {
    const s = (project.strings || [])[index];
    return s && typeof s.n === 'number' ? s.n : index + 1;
  }

  // nearest point on the cable to where the finger landed, so a new elbow
  // starts exactly on the line instead of jumping to the tap position
  function closestPointOnPath(pts, p) {
    let best = { x: pts[0].x, y: pts[0].y, d: Infinity, seg: 0 };
    for (let i = 1; i < pts.length; i += 1) {
      const ax = pts[i - 1].x, ay = pts[i - 1].y;
      const bx = pts[i].x, by = pts[i].y;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len2)) : 0;
      const qx = ax + dx * t, qy = ay + dy * t;
      const d = Math.hypot(p.x - qx, p.y - qy);
      if (d < best.d) best = { x: qx, y: qy, d, seg: i - 1 };
    }
    return best;
  }

  // an elbow may not be dragged outside the farm: the cable would run off into
  // empty sea, and the pan limit (which follows the foundations) could not
  // follow it there
  function clampToContent(point, projectArg) {
    // the project is passed in during loading, when there is no active one yet;
    // reaching for getActiveProject() here threw, and the throw was swallowed
    // by loadState's catch, which then reseeded the whole site from scratch
    const project = projectArg || getActiveProject();
    if (!project || !project.nodes || !project.nodes.length) return point;
    const box = contentBox(project);
    return {
      x: Math.min(Math.max(point.x, box.minX), box.maxX),
      y: Math.min(Math.max(point.y, box.minY), box.maxY),
    };
  }

  function addBendToConnection(connId, worldPoint) {
    const project = getActiveProject();
    const conn = project.connections.find((c) => c.id === connId);
    if (!conn) return;
    const nodeById = {};
    project.nodes.forEach((n) => { nodeById[n.id] = n; });
    const a = nodeById[conn.a];
    const b = nodeById[conn.b];
    if (!a || !b) return;
    conn.bends = conn.bends || [];
    if (conn.bends.length >= MAX_BENDS) {
      showToast(`A cable takes at most ${MAX_BENDS} elbows. Tap an elbow to remove it.`);
      return;
    }
    const pts = cablePoints(conn, a, b);
    const hit = closestPointOnPath(pts, worldPoint);
    const spot = clampToContent(hit);
    conn.bends.splice(hit.seg, 0, { x: Math.round(spot.x), y: Math.round(spot.y) });
    touchCables();
    touchAndSave();
    renderCanvas();
  }

  function removeBend(connId, index) {
    const project = getActiveProject();
    const conn = project.connections.find((c) => c.id === connId);
    if (!conn || !Array.isArray(conn.bends)) return;
    conn.bends.splice(index, 1);
    if (!conn.bends.length) delete conn.bends;
    touchCables();
    touchAndSave();
    renderCanvas();
  }

  // A cable drawn by hand between two foundations that already sit on the same
  // string is a re-route of that string, not a new circuit. Without this it
  // stayed unnumbered — no figure along the line, and no way to flag it SRCC,
  // because SRCC is a property of the string.
  function inferString(project, aId, bId) {
    const aS = nodeStringIndices(project, aId);
    const bS = nodeStringIndices(project, bId);
    const common = aS.filter((s) => bS.indexOf(s) !== -1);
    if (common.length === 1) return common[0];
    if (common.length) return null;                       // ambiguous: let a human say
    if (aS.length === 1 && !bS.length) return aS[0];      // extending a string to a new point
    if (bS.length === 1 && !aS.length) return bS[0];
    return null;
  }

  function addConnection(aId, bId, stringIndex) {
    const project = getActiveProject();
    if (aId === bId) return;
    const exists = project.connections.some(
      (c) => (c.a === aId && c.b === bId) || (c.a === bId && c.b === aId),
    );
    if (exists) return;
    const conn = { id: uid(), a: aId, b: bId };
    const si = typeof stringIndex === 'number' ? stringIndex : inferString(project, aId, bId);
    if (typeof si === 'number') conn.string = si;
    project.connections.push(conn);
    touchCables();
    touchAndSave();
    return conn;
  }

  function setConnectionString(connId, stringIndex) {
    const project = getActiveProject();
    const conn = project.connections.find((c) => c.id === connId);
    if (!conn) return;
    const was = typeof conn.string === 'number' ? `S${stringNumber(project, conn.string)}` : 'none';
    if (typeof stringIndex === 'number') conn.string = stringIndex;
    else delete conn.string;
    const now = typeof conn.string === 'number' ? `S${stringNumber(project, conn.string)}` : 'none';
    if (was !== now) logActivity('string', `Cable ${cableName(project, conn)} → ${now}`);
    touchCables();
    touchAndSave();
    renderCanvas();
  }

  function cableName(project, conn) {
    const byId = {};
    project.nodes.forEach((n) => { byId[n.id] = n.label; });
    return `${byId[conn.a] || '?'} → ${byId[conn.b] || '?'}`;
  }

  // ---------- camera (pan / zoom) ----------
  function svgRect() {
    return svgEl.getBoundingClientRect();
  }

  // The camera may never travel far enough for a foundation to leave the map.
  // Panning used to be unbounded, so at any zoom you could drag the farm out
  // of view entirely — worse on a phone, where a flick moves a long way.
  function clampCameraToContent() {
    const project = getActiveProject();
    const rect = svgRect();
    if (!project || !project.nodes.length || !rect.width || !rect.height) return;
    const box = contentBox(project);
    const halfW = rect.width / camera.scale / 2;
    const halfH = rect.height / camera.scale / 2;
    // axis smaller than the view: nothing to pan towards, so it stays centred
    if (box.w <= halfW * 2) camera.x = box.cx;
    else camera.x = Math.min(Math.max(camera.x, box.minX + halfW), box.maxX - halfW);
    if (box.h <= halfH * 2) camera.y = box.cy;
    else camera.y = Math.min(Math.max(camera.y, box.minY + halfH), box.maxY - halfH);
  }

  function applyViewBox() {
    const rect = svgRect();
    if (!rect.width || !rect.height) return;
    clampCameraToContent();
    const w = rect.width / camera.scale;
    const h = rect.height / camera.scale;
    svgEl.setAttribute('viewBox', `${camera.x - w / 2} ${camera.y - h / 2} ${w} ${h}`);
  }

  function clampScale(s) {
    return Math.min(camera.maxScale, Math.max(camera.minScale, s));
  }

  function screenToWorld(px, py) {
    const rect = svgRect();
    return {
      x: camera.x + (px - rect.left - rect.width / 2) / camera.scale,
      y: camera.y + (py - rect.top - rect.height / 2) / camera.scale,
    };
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = svgRect();
    if (!rect.width) return;
    const worldBefore = screenToWorld(clientX, clientY);
    camera.scale = clampScale(camera.scale * factor);
    camera.x = worldBefore.x - (clientX - rect.left - rect.width / 2) / camera.scale;
    camera.y = worldBefore.y - (clientY - rect.top - rect.height / 2) / camera.scale;
    applyViewBox();
  }

  // Bounding box of the farm plus a tight margin, so that at maximum zoom-out
  // the outermost foundations sit just a few millimetres from the screen edges
  // (west→left, east→right, north→top, south→bottom).
  function contentBox(project) {
    // ring + the label that hangs below each node, so the bottom row's labels
    // are never clipped at maximum zoom-out
    const pad = RING_OUT + 26;
    const xs = project.nodes.map((n) => n.x);
    const ys = project.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    return {
      minX, maxX, minY, maxY,
      w: Math.max(maxX - minX, 1),
      h: Math.max(maxY - minY, 1),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }

  function fitToContent() {
    const project = getActiveProject();
    const rect = svgRect();
    if (!project || !project.nodes.length || !rect.width || !rect.height) {
      camera = { x: 0, y: 0, scale: 1, minScale: 0.1, maxScale: 8 };
      applyViewBox();
      return;
    }
    const box = contentBox(project);
    const scale = Math.min(rect.width / box.w, rect.height / box.h);
    camera = {
      x: box.cx,
      y: box.cy,
      scale,
      // max zoom-out == this tight fill: the whole park fills the screen edge
      // to edge and cannot be shrunk any smaller.
      minScale: scale,
      maxScale: Math.max(10, scale * 14),
    };
    applyViewBox();
  }

  // The canvas can change size long after the first fit: phone rotation, a
  // drawer opening, the browser chrome collapsing, or the web fonts landing.
  // Recompute the zoom-out floor against the new size, otherwise the
  // "farm always fills the screen" guarantee silently goes stale.
  function refreshCameraBounds() {
    const project = getActiveProject();
    const rect = svgRect();
    if (!project || !project.nodes.length || !rect.width || !rect.height) return;
    const box = contentBox(project);
    const fit = Math.min(rect.width / box.w, rect.height / box.h);
    const wasFitted = camera.scale <= camera.minScale * 1.02;
    if (wasFitted) { fitToContent(); return; }
    camera.minScale = fit;
    camera.maxScale = Math.max(10, fit * 14);
    camera.scale = clampScale(camera.scale);
    applyViewBox();
  }

  function safeFitToContent() {
    const rect = svgRect();
    if (rect.width < 5 || rect.height < 5) {
      requestAnimationFrame(safeFitToContent);
      return;
    }
    fitToContent();
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  function setupCameraGestures() {
    const activePointers = new Map();
    let gesture = null;

    svgEl.addEventListener('pointerdown', (e) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { svgEl.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (activePointers.size === 1) {
        // an elbow under the finger drags itself instead of panning the map
        const handle = e.target && e.target.classList && e.target.classList.contains('bend-handle') ? e.target : null;
        if (handle && mode === 'bend' && isAdmin()) {
          gesture = {
            type: 'bend', connId: handle.dataset.connId, index: Number(handle.dataset.bendIndex),
            downX: e.clientX, downY: e.clientY, moved: false, downTarget: e.target,
          };
          return;
        }
        gesture = { type: 'pan', lastX: e.clientX, lastY: e.clientY, downX: e.clientX, downY: e.clientY, moved: false, downTarget: e.target };
      } else if (activePointers.size === 2) {
        const pts = [...activePointers.values()];
        const m = mid(pts[0], pts[1]);
        // anchor the world point under the pinch midpoint ONCE, while the
        // camera is still untouched — recomputing it against an already
        // mutated camera makes the anchor drift and the map "fly away"
        gesture = {
          type: 'pinch',
          startDist: dist(pts[0], pts[1]) || 1,
          startScale: camera.scale,
          anchorWorld: screenToWorld(m.x, m.y),
          moved: false,
        };
      }
    });

    svgEl.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!gesture) return;
      if (gesture.type === 'bend') {
        if (Math.hypot(e.clientX - gesture.downX, e.clientY - gesture.downY) > 4) gesture.moved = true;
        if (!gesture.moved) return;
        const project = getActiveProject();
        const conn = project && project.connections.find((c) => c.id === gesture.connId);
        const bend = conn && conn.bends && conn.bends[gesture.index];
        if (!bend) return;
        const w = clampToContent(screenToWorld(e.clientX, e.clientY));
        bend.x = Math.round(w.x);
        bend.y = Math.round(w.y);
        renderCanvas();
        return;
      }
      if (gesture.type === 'pan' && activePointers.size === 1) {
        const dx = e.clientX - gesture.lastX;
        const dy = e.clientY - gesture.lastY;
        if (gesture.startX === undefined) { gesture.startX = gesture.lastX; gesture.startY = gesture.lastY; }
        if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 6) gesture.moved = true;
        camera.x -= dx / camera.scale;
        camera.y -= dy / camera.scale;
        gesture.lastX = e.clientX;
        gesture.lastY = e.clientY;
        applyViewBox();
      } else if (gesture.type === 'pinch' && activePointers.size === 2) {
        const pts = [...activePointers.values()];
        const newDist = dist(pts[0], pts[1]) || 1;
        const newMid = mid(pts[0], pts[1]);
        camera.scale = clampScale(gesture.startScale * (newDist / gesture.startDist));
        const rect = svgRect();
        camera.x = gesture.anchorWorld.x - (newMid.x - rect.left - rect.width / 2) / camera.scale;
        camera.y = gesture.anchorWorld.y - (newMid.y - rect.top - rect.height / 2) / camera.scale;
        gesture.moved = true;
        applyViewBox();
      }
    });

    function endPointer(e, isTapCandidate) {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.delete(e.pointerId);
      try { svgEl.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (activePointers.size === 0) {
        if (isTapCandidate && gesture && gesture.type === 'pan' && !gesture.moved) {
          handleTap(gesture.downTarget, gesture.downX, gesture.downY);
        } else if (gesture && gesture.type === 'bend') {
          // moved = repositioned, not moved = a tap, which removes the elbow
          if (gesture.moved) { touchCables(); touchAndSave(); }
          else if (isTapCandidate) removeBend(gesture.connId, gesture.index);
        }
        gesture = null;
      } else if (activePointers.size === 1) {
        const remaining = [...activePointers.values()][0];
        gesture = { type: 'pan', lastX: remaining.x, lastY: remaining.y, moved: true };
      }
    }
    svgEl.addEventListener('pointerup', (e) => endPointer(e, true));
    svgEl.addEventListener('pointercancel', (e) => endPointer(e, false));

    svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    window.addEventListener('resize', refreshCameraBounds);
    window.addEventListener('orientationchange', () => setTimeout(refreshCameraBounds, 250));
    // the canvas box also moves when panels/toolbars reflow, not just the window
    if (window.ResizeObserver) {
      let firstObservation = true;
      const ro = new ResizeObserver(() => {
        if (firstObservation) { firstObservation = false; return; }
        refreshCameraBounds();
      });
      ro.observe(svgEl);
    }
    // web fonts land after first paint and can change the chrome's height
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => refreshCameraBounds());
    }
  }

  // ---------- node interaction ----------
  // Nodes and cables are fixed on the map: a tap (finger or mouse, without
  // movement) toggles/opens things, any movement pans the camera instead.
  function handleTap(target, screenX, screenY) {
    const project = getActiveProject();
    if (!project || !target) return;

    // placing a new map annotation
    if (placingText) {
      placingText = false;
      svgEl.classList.remove('placing');
      const world = screenToWorld(screenX, screenY);
      openTextEditor(null, world.x, world.y);
      return;
    }

    // tapping an existing annotation
    if (target.dataset && target.dataset.annotId) {
      if (canEdit()) openTextEditor(target.dataset.annotId);
      return;
    }

    // tapping an elbow removes it (dragging it is handled by the gesture code)
    if (target.classList && target.classList.contains('bend-handle')) {
      if (mode === 'bend' && isAdmin()) removeBend(target.dataset.connId, Number(target.dataset.bendIndex));
      return;
    }
    const lineEl = target.closest && target.closest('.connection-line');
    if (lineEl) {
      if (mode === 'delete' && isAdmin()) deleteConnection(lineEl.dataset.connId);
      else if (mode === 'bend' && isAdmin()) addBendToConnection(lineEl.dataset.connId, screenToWorld(screenX, screenY));
      // in normal mode a cable was inert, so there was nowhere to give a
      // hand-drawn one its string number
      else if (isAdmin()) openCableModal(lineEl.dataset.connId);
      return;
    }
    const groupEl = target.closest && target.closest('.node-group');
    if (groupEl) {
      const node = project.nodes.find((n) => n.id === groupEl.dataset.nodeId);
      if (node) handleNodeClick(node, (target.dataset && target.dataset.kind) || 'body');
      return;
    }
    if (mode === 'connect' && pendingConnectFrom) {
      pendingConnectFrom = null;
      renderCanvas();
    }
  }

  function handleNodeClick(node, kind) {
    if (mode === 'newstring' && newString) {
      const last = newString.picks[newString.picks.length - 1];
      if (last === node.id) { newString.picks.pop(); }        // tap again to undo
      else if (newString.picks.includes(node.id)) {
        showToast(`${node.label} is already on this string.`);
        return;
      } else newString.picks.push(node.id);
      renderCanvas();
      updateNewStringBar();
      return;
    }
    if (mode === 'delete' && isAdmin()) {
      deleteNode(node.id);
      return;
    }
    if (mode === 'connect' && isAdmin()) {
      if (!pendingConnectFrom) {
        pendingConnectFrom = node.id;
        renderCanvas();
      } else if (pendingConnectFrom === node.id) {
        pendingConnectFrom = null;
        renderCanvas();
      } else {
        addConnection(pendingConnectFrom, node.id);
        pendingConnectFrom = null;
        render();
      }
      return;
    }
    // select mode
    if (kind === 'hub' || kind === 'body' || !canEdit()) {
      openNodeModal(node.id);
    } else if (kind.startsWith('wedge-')) {
      const catId = kind.slice(6);
      node.status[catId] = node.status[catId] && !node.status[catId].partial ? null : checkStamp();
      touchAndSave();
      renderCanvas();
      renderProgress();
    } else if (kind.startsWith('micro-')) {
      const varId = kind.slice(6);
      node.micro[varId] = node.micro[varId] && !node.micro[varId].partial ? null : checkStamp();
      touchAndSave();
      renderCanvas();
      renderProgress();
    }
  }

  // ---------- rendering ----------
  function render() {
    renderProjectSelect();
    renderHeader();
    renderLogin(); // the crew list is synced data now: keep the login screen live
    renderCategories();
    renderMicroList();
    renderStrings();
    renderPermits();
    renderReportsEditor();
    renderCanvas();
    renderProgress();
    renderPunchList();
    updateProcBadge();
    applyPermissionClasses();
  }

  function renderHeader() {
    const project = getActiveProject();
    const el = document.getElementById('updated-at');
    el.textContent = project ? `Updated: ${formatDate(project.updatedAt)}` : '';
  }

  function renderProjectSelect() {
    const sel = document.getElementById('project-select');
    // with a single project the dropdown just repeats the title next to it —
    // one less thing to read on a strip that is already crowded
    sel.classList.toggle('hidden', Object.keys(state.projects).length <= 1);
    sel.innerHTML = '';
    Object.values(state.projects)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === state.activeProjectId) opt.selected = true;
        sel.appendChild(opt);
      });
  }

  function toHex(color) {
    if (color.startsWith('#')) return color;
    const m = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!m) return '#888888';
    const h = Number(m[1]) / 360; const s = Number(m[2]) / 100; const l = Number(m[3]) / 100;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r; let g; let b;
    if (s === 0) { r = g = b = l; } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toH = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toH(r)}${toH(g)}${toH(b)}`;
  }

  // Reading the method statement is the most frequent thing anyone does with
  // this list, so it hangs off the task itself. The lone icon in the top bar
  // was never found by someone who had not been shown it.
  function procOpenerButton(item) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost cat-proc';
    btn.innerHTML = iconMarkup('doc', 'ico ico--sm');
    const label = procL(`Method statement — ${item.name}`, `Mode opératoire — ${item.name}`);
    btn.title = label;
    btn.setAttribute('aria-label', label);
    if (isProcUnseen(item.id)) btn.classList.add('cat-proc--unread');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProcedures(item.id);
    });
    return btn;
  }

  // How far this one task has got across the farm, the same figure the right
  // panel shows — but on the row you are already looking at, so you do not have
  // to hold two lists side by side to answer "how far is the ScotchKoat?".
  function taskProgressBar(item, statusKey) {
    const project = getActiveProject();
    const foundations = project.nodes.filter((n) => !n.substation);
    const done = foundations.filter((n) => n[statusKey][item.id] && !n[statusKey][item.id].partial).length;
    const total = foundations.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const wrap = document.createElement('div');
    wrap.className = 'cat-progress';
    const label = document.createElement('span');
    label.className = 'cat-progress-pct';
    label.textContent = `${done}/${total} · ${pct}%`;
    const track = document.createElement('div');
    track.className = 'cat-progress-track';
    const fill = document.createElement('div');
    fill.className = 'cat-progress-fill';
    fill.style.width = `${pct}%`;
    fill.style.background = item.color;
    track.appendChild(fill);
    wrap.append(label, track);
    return wrap;
  }

  function buildCategoryRow(item, groupKey) {
    const project = getActiveProject();
    const admin = isAdmin();
    const statusKey = groupKey === 'categories' ? 'status' : 'micro';
    const li = document.createElement('li');
    li.className = `category-row${item.hidden ? ' archived' : ''}`;

    if (admin) {
      const color = document.createElement('input');
      color.type = 'color';
      color.value = toHex(item.color);
      color.addEventListener('input', () => {
        item.color = color.value;
        // stamped, or the other devices keep the old colour for ever
        item.updatedAt = stampAfter(item.updatedAt);
        touchAndSave();
        renderCanvas();
        renderProgress();
      });

      const name = document.createElement('input');
      name.type = 'text';
      name.value = item.name;
      name.addEventListener('change', () => {
        const was = item.name;
        item.name = name.value.trim() || item.name;
        if (was !== item.name) {
          item.updatedAt = stampAfter(item.updatedAt);
          logActivity('task-renamed', `"${was}" → "${item.name}"`);
        }
        touchAndSave();
        render();
      });

      // hide / show (archive) — non-destructive, keeps history
      const hide = document.createElement('button');
      hide.className = 'btn btn-ghost';
      hide.innerHTML = iconMarkup(item.hidden ? 'hide' : 'eye', 'ico ico--sm');
      hide.title = item.hidden ? 'Show on the map again' : 'Hide from the map (keep history)';
      hide.addEventListener('click', () => {
        item.hidden = !item.hidden;
        item.updatedAt = stampAfter(item.updatedAt);
        logActivity(item.hidden ? 'task-hidden' : 'task-shown', item.name);
        touchAndSave();
        render();
      });

      // bulk-validate this category on every foundation (discreet)
      const bulk = document.createElement('button');
      bulk.className = 'btn btn-ghost bulk-btn';
      bulk.textContent = '✓·all';
      bulk.title = 'Mark this task DONE on ALL foundations';
      bulk.addEventListener('click', () => {
        const done = project.nodes.filter((n) => !n.substation && n[statusKey][item.id] && !n[statusKey][item.id].partial).length;
        const total = project.nodes.filter((n) => !n.substation).length;
        const undo = done === total;
        if (!confirm(undo
          ? `Un-tick "${item.name}" on all ${total} foundations?`
          : `Tick "${item.name}" as DONE on all ${total} foundations?`)) return;
        project.nodes.forEach((n) => {
          if (n.substation) return;
          n[statusKey][item.id] = undo ? null : checkStamp();
        });
        logActivity('bulk', undo
          ? `${item.name} cleared on all ${total} foundations`
          : `${item.name} marked done on all ${total} foundations`);
        touchAndSave();
        render();
        showToast(undo ? 'Category cleared everywhere.' : 'Category validated on all foundations.');
      });

      const del = document.createElement('button');
      del.className = 'btn btn-ghost btn-danger';
      del.innerHTML = iconMarkup('trash', 'ico ico--sm');
      del.title = 'Delete task';
      del.addEventListener('click', () => {
        if (!confirm(`Delete task "${item.name}"? This erases its data. To keep history, hide it instead.`)) return;
        if (groupKey === 'categories') {
          project.categories = project.categories.filter((c) => c.id !== item.id);
          project.nodes.forEach((n) => { delete n.status[item.id]; });
        } else {
          project.microVars = project.microVars.filter((c) => c.id !== item.id);
          project.nodes.forEach((n) => { delete n.micro[item.id]; });
        }
        project.nodes.forEach((n) => { delete n.taskComments[item.id]; });
        if (project.procedures) delete project.procedures[item.id];
        // remembered, so the next device to sync does not bring it back
        tombstone(project, 'tasks', item.id);
        logActivity('task-deleted', item.name);
        touchAndSave();
        render();
      });

      const controls = document.createElement('span');
      controls.className = 'cat-controls';
      // the method statement comes first: it is read far more often than the
      // name is renamed or the task hidden
      controls.append(procOpenerButton(item), hide, bulk, del);
      li.append(color, name, controls, taskProgressBar(item, statusKey));
    } else {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;
      const name = document.createElement('span');
      name.className = 'category-name';
      name.textContent = item.name;
      li.append(dot, name);
      if (item.hidden) {
        const tag = document.createElement('span');
        tag.className = 'archived-tag';
        tag.textContent = 'archived';
        li.appendChild(tag);
      }
      // no rename field in the way here, so the whole row is the target —
      // a full-width strip is what you can hit with a glove on a moving boat
      const opener = procOpenerButton(item);
      // the row itself carries the focus and the announcement; the icon is
      // only the sign that says the row does something
      opener.tabIndex = -1;
      opener.setAttribute('aria-hidden', 'true');
      li.appendChild(opener);
      li.appendChild(taskProgressBar(item, statusKey));
      li.classList.add('category-row--proc');
      li.setAttribute('role', 'button');
      li.tabIndex = 0;
      li.title = opener.title;
      li.addEventListener('click', () => openProcedures(item.id));
      li.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        openProcedures(item.id);
      });
    }
    return li;
  }

  function renderCategoryGroup(listEl, items, groupKey) {
    listEl.innerHTML = '';
    const active = items.filter((it) => !it.hidden);
    const archived = items.filter((it) => it.hidden);

    active.forEach((item) => listEl.appendChild(buildCategoryRow(item, groupKey)));

    if (archived.length) {
      const details = document.createElement('details');
      details.className = 'archived-group';
      const summary = document.createElement('summary');
      summary.textContent = `Archived (${archived.length})`;
      details.appendChild(summary);
      const ul = document.createElement('ul');
      ul.className = 'category-list';
      archived.forEach((item) => ul.appendChild(buildCategoryRow(item, groupKey)));
      details.appendChild(ul);
      listEl.appendChild(details);
    }
  }

  // One list of tasks. Whether a task is drawn as a slice of the centre or a
  // cell of the outer ring is a drawing detail; nobody should have to choose it,
  // so the app fills the centre first and spills onto the ring after that.
  function taskCapacity() { return MAX_CATEGORIES + MAX_MICRO; }

  function taskCount(project) {
    return project.categories.length + project.microVars.length;
  }

  // where the next task goes, so "+ Add task" never asks the question
  function nextTaskGroup(project) {
    if (project.categories.length < MAX_CATEGORIES) return 'categories';
    if (project.microVars.length < MAX_MICRO) return 'microVars';
    return null;
  }

  function renderCategories() {
    const project = getActiveProject();
    if (!project) return;
    const badge = document.getElementById('cat-count-badge');
    badge.textContent = `${taskCount(project)}/${taskCapacity()}`;
    const addBtn = document.getElementById('btn-add-category');
    addBtn.disabled = !nextTaskGroup(project);
    renderCategoryGroup(document.getElementById('category-list'), project.categories, 'categories');
  }

  function renderMicroList() {
    const project = getActiveProject();
    if (!project) return;
    renderCategoryGroup(document.getElementById('micro-list'), project.microVars, 'microVars');
  }

  // ---------- strings (SRCC) ----------

  function setMode(next) {
    mode = next;
    pendingConnectFrom = null;
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === next));
    updateCanvasHint();
    renderCanvas();
  }

  // ---------- drawing a new string ----------
  function nextStringNumber(project) {
    const used = new Set((project.strings || []).map((s) => s.n));
    let n = 1;
    while (used.has(n)) n += 1;
    return n;
  }

  function startNewString() {
    const project = getActiveProject();
    if (!project || !isAdmin()) return;
    const suggested = nextStringNumber(project);
    const raw = prompt('Number for this string:', String(suggested));
    if (raw === null) return;
    const n = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(n) || n <= 0) { showToast('Give the string a whole number, like 9.'); return; }
    if ((project.strings || []).some((s) => s.n === n)) {
      showToast(`String ${n} already exists.`);
      return;
    }
    newString = { n, picks: [] };
    setMode('newstring');
    updateNewStringBar();
    renderCanvas();
  }

  function updateNewStringBar() {
    const bar = document.getElementById('new-string-bar');
    if (!bar) return;
    bar.classList.toggle('hidden', !newString);
    if (!newString) return;
    const count = newString.picks.length;
    document.getElementById('new-string-label').textContent =
      count ? `String S${newString.n} — ${count} foundation${count > 1 ? 's' : ''}, tap the next one`
            : `String S${newString.n} — tap the first foundation`;
    document.getElementById('new-string-done').disabled = count < 2;
  }

  function cancelNewString() {
    newString = null;
    updateNewStringBar();
    setMode('select');
    renderCanvas();
  }

  function finishNewString() {
    const project = getActiveProject();
    if (!project || !newString || newString.picks.length < 2) return;
    const index = project.strings.length;
    project.strings.push({ n: newString.n, srcc: false, srccAt: new Date().toISOString() });
    for (let i = 1; i < newString.picks.length; i += 1) {
      addConnection(newString.picks[i - 1], newString.picks[i], index);
    }
    const count = newString.picks.length;
    logActivity('string', `String S${newString.n} created across ${count} foundations`);
    newString = null;
    updateNewStringBar();
    setMode('select');
    touchAndSave();
    render();
    showToast(`String created across ${count} foundations.`);
  }

  function deleteString(index) {
    const project = getActiveProject();
    if (!project || !isAdmin()) return;
    project.connections = project.connections.filter((c) => c.string !== index);
    // indices above the removed one shift down, so the cables follow
    project.connections.forEach((c) => {
      if (typeof c.string === 'number' && c.string > index) c.string -= 1;
    });
    logActivity('string', `String S${stringNumber(project, index)} deleted`);
    project.strings.splice(index, 1);
    touchCables();
    touchAndSave();
    render();
  }

  function renderStrings() {
    const project = getActiveProject();
    const listEl = document.getElementById('string-list');
    if (!listEl || !project) return;
    // nothing more will be built at Tréport; a new site's project still can
    const addStr = document.getElementById('btn-add-string');
    if (addStr) addStr.classList.toggle('hidden', !!project.fixedLayout);
    const addNode = document.getElementById('btn-add-node');
    if (addNode) addNode.classList.toggle('hidden', !!project.fixedLayout);
    listEl.innerHTML = '';
    const editable = canEdit();
    const anySrcc = project.strings.some((s) => s.srcc);

    project.strings.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = `string-row${s.srcc ? ' srcc' : ''}`;

      const num = document.createElement('span');
      num.className = 'string-num';
      num.textContent = `S${stringNumber(project, i)}`;
      li.appendChild(num);

      const state = document.createElement('span');
      state.className = 'string-state';
      state.textContent = s.srcc ? '⚠ SRCC — restricted' : 'Normal access';
      li.appendChild(state);

      if (editable) {
        const btn = document.createElement('button');
        btn.className = `btn string-toggle${s.srcc ? ' on' : ''}`;
        btn.textContent = s.srcc ? 'SRCC' : 'Set SRCC';
        btn.title = 'Toggle SRCC restricted access for this string';
        btn.addEventListener('click', () => {
          s.srcc = !s.srcc;
          // stamped so the other devices can tell which way is the newer one —
          // and always past the stamp it replaces, whatever their clocks say
          s.srccAt = stampAfter(s.srccAt);
          logActivity('srcc', `String S${stringNumber(project, i)} → ${s.srcc ? 'SRCC restricted' : 'normal access'}`);
          touchAndSave();
          render();
          if (s.srcc) showAccessRules(i);
        });
        li.appendChild(btn);
      }

      // only strings an admin drew can be removed: the eight real ones are the
      // wind farm itself, deleting those would be a mistake, not a choice
      if (isAdmin() && i >= STRING_GROUPS.length) {
        const del = document.createElement('button');
        del.className = 'btn btn-ghost btn-danger';
        del.innerHTML = iconMarkup('trash', 'ico ico--sm');
        del.title = 'Delete this string and its cables';
        del.addEventListener('click', () => {
          if (!confirm(`Delete string S${stringNumber(project, i)} and its cables?`)) return;
          deleteString(i);
        });
        li.appendChild(del);
      }
      listEl.appendChild(li);
    });

    // access-rules reminder + editor
    const rulesWrap = document.getElementById('string-rules');
    if (rulesWrap) {
      rulesWrap.classList.toggle('hidden', !anySrcc && !isAdmin());
      const rulesBody = document.getElementById('string-rules-body');
      rulesBody.innerHTML = '';
      if (isAdmin()) {
        const ta = document.createElement('textarea');
        ta.rows = 5;
        ta.value = project.accessRules;
        ta.addEventListener('change', () => {
          project.accessRules = ta.value;
          touchAndSave();
        });
        rulesBody.appendChild(ta);
      } else {
        const p = document.createElement('p');
        p.className = 'access-rules-text';
        p.textContent = project.accessRules;
        rulesBody.appendChild(p);
      }
    }
  }

  function showAccessRules(stringIndex) {
    const project = getActiveProject();
    const label = stringIndex != null ? `String S${stringIndex + 1} is now SRCC.\n\n` : '';
    alert(`${label}${project.accessRules}`);
  }

  // ---------- reports / additional inspections editor ----------
  function renderReportsEditor() {
    const project = getActiveProject();
    const listEl = document.getElementById('reports-list');
    if (!listEl || !project) return;
    listEl.innerHTML = '';
    const admin = isAdmin();

    project.reportTypes.forEach((rt) => {
      const li = document.createElement('li');
      li.className = 'category-row';
      if (admin) {
        const name = document.createElement('input');
        name.type = 'text';
        name.value = rt.name;
        name.addEventListener('change', () => {
          const was = rt.name;
          rt.name = name.value.trim() || rt.name;
          if (was !== rt.name) {
            rt.updatedAt = stampAfter(rt.updatedAt);
            logActivity('task-renamed', `Inspection "${was}" → "${rt.name}"`);
          }
          touchAndSave();
          render();
        });
        const del = document.createElement('button');
        del.className = 'btn btn-ghost btn-danger';
        del.textContent = '✕';
        del.title = 'Delete inspection type';
        del.addEventListener('click', () => {
          if (!confirm(`Delete inspection "${rt.name}"? Its recorded occurrences will be removed.`)) return;
          project.reportTypes = project.reportTypes.filter((r) => r.id !== rt.id);
          project.nodes.forEach((n) => { delete n.reports[rt.id]; });
          tombstone(project, 'reports', rt.id);
          logActivity('task-deleted', `Inspection "${rt.name}"`);
          touchAndSave();
          render();
        });
        li.append(name, del);
      } else {
        const name = document.createElement('span');
        name.className = 'category-name';
        name.textContent = rt.name;
        li.appendChild(name);
      }
      listEl.appendChild(li);
    });
  }

  function statusFill(stamp, item) {
    if (!stamp) return 'var(--panel)';
    if (stamp.partial) return `url(#hatch-${item.id})`;
    return item.color;
  }

  function visibleItems(items) {
    return (items || []).filter((it) => !it.hidden);
  }

  function renderCanvas() {
    const project = getActiveProject();
    svgEl.innerHTML = '';
    if (!project) return;
    const cats = visibleItems(project.categories);
    const micros = visibleItems(project.microVars);
    const catCount = cats.length;
    const microCount = micros.length;

    // hatch patterns (one per category) for "partially done"
    const defs = document.createElementNS(SVGNS, 'defs');
    project.categories.concat(project.microVars).forEach((item) => {
      const pattern = document.createElementNS(SVGNS, 'pattern');
      pattern.setAttribute('id', `hatch-${item.id}`);
      pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      pattern.setAttribute('width', '7');
      pattern.setAttribute('height', '7');
      pattern.setAttribute('patternTransform', 'rotate(45)');
      const bgRect = document.createElementNS(SVGNS, 'rect');
      bgRect.setAttribute('width', '7');
      bgRect.setAttribute('height', '7');
      bgRect.setAttribute('fill', 'var(--panel)');
      const stripe = document.createElementNS(SVGNS, 'rect');
      stripe.setAttribute('width', '3.5');
      stripe.setAttribute('height', '7');
      stripe.setAttribute('fill', item.color);
      pattern.append(bgRect, stripe);
      defs.appendChild(pattern);
    });
    svgEl.appendChild(defs);

    const nodeById = {};
    project.nodes.forEach((n) => { nodeById[n.id] = n; });
    const srccByString = {};
    (project.strings || []).forEach((s, i) => { srccByString[i] = s.srcc; });

    project.connections.forEach((conn) => {
      const a = nodeById[conn.a];
      const b = nodeById[conn.b];
      if (!a || !b) return;
      const srcc = srccByString[conn.string];
      // a cable is a polyline now: with no elbow it is exactly the old straight
      // segment, with one or two it detours around whatever is in the way
      const pts = cablePoints(conn, a, b);
      // an invisible fat twin, drawn underneath, so a cable can be hit with a
      // gloved finger — the visible line is 1.9px and was practically untappable
      const hit = document.createElementNS(SVGNS, 'polyline');
      hit.setAttribute('data-conn-id', conn.id);
      hit.setAttribute('points', pts.map((pt) => `${pt.x},${pt.y}`).join(' '));
      hit.setAttribute('class', 'connection-line connection-hit');
      svgEl.appendChild(hit);

      const line = document.createElementNS(SVGNS, 'polyline');
      line.setAttribute('data-conn-id', conn.id);
      line.setAttribute('points', pts.map((pt) => `${pt.x},${pt.y}`).join(' '));
      line.setAttribute('class', `connection-line${srcc ? ' srcc' : ''}${mode === 'delete' ? ' deletable' : ''}${mode === 'bend' ? ' bendable' : ''}`);
      line.style.stroke = srcc ? 'var(--cable)' : 'var(--cable-line)';
      svgEl.appendChild(line);

      // string number written along every cable segment, like the small
      // figures beside the cables on the paper site map
      if (typeof conn.string === 'number') {
        const mid = pathMidpoint(pts);
        const num = document.createElementNS(SVGNS, 'text');
        num.setAttribute('x', String(mid.x));
        num.setAttribute('y', String(mid.y));
        num.setAttribute('text-anchor', 'middle');
        num.setAttribute('dominant-baseline', 'central');
        num.setAttribute('class', `cable-number${srcc ? ' srcc' : ''}`);
        num.textContent = String(stringNumber(project, conn.string));
        svgEl.appendChild(num);
      }

      // elbow handles: only while the elbow tool is selected, so they never
      // clutter the map you actually read on deck
      if (mode === 'bend' && isAdmin() && Array.isArray(conn.bends)) {
        conn.bends.forEach((bend, bi) => {
          const handle = document.createElementNS(SVGNS, 'rect');
          handle.setAttribute('x', String(bend.x - 9));
          handle.setAttribute('y', String(bend.y - 9));
          handle.setAttribute('width', '18');
          handle.setAttribute('height', '18');
          handle.setAttribute('rx', '3');
          handle.setAttribute('class', 'bend-handle');
          handle.setAttribute('data-conn-id', conn.id);
          handle.setAttribute('data-bend-index', String(bi));
          svgEl.appendChild(handle);
        });
      }
    });

    // the string being drawn, previewed as you tap foundation after foundation
    if (newString && newString.picks.length) {
      const pts = newString.picks.map((id) => nodeById[id]).filter(Boolean);
      if (pts.length > 1) {
        const preview = document.createElementNS(SVGNS, 'polyline');
        preview.setAttribute('points', pts.map((n) => `${n.x},${n.y}`).join(' '));
        preview.setAttribute('class', 'new-string-preview');
        svgEl.appendChild(preview);
      }
      pts.forEach((n, i) => {
        const t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', String(n.x));
        t.setAttribute('y', String(n.y - RING_OUT - 16));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'new-string-order');
        t.textContent = String(i + 1);
        svgEl.appendChild(t);
      });
    }

    // string number badges, placed on the first foundation of each string.
    // Derived from the strings list, not the seeded groups, so a string an
    // admin drew gets its badge exactly like the eight original ones.
    (project.strings || []).forEach((strDef, si) => {
      let feeder = null;
      const edges = STRING_GROUPS[si];
      const feederLabel = (edges && edges[0] && edges[0][1]) || null;
      if (feederLabel) feeder = project.nodes.find((n) => n.label === feederLabel);
      if (!feeder) {
        const first = project.connections.find((c) => c.string === si);
        if (first) feeder = nodeById[first.a] || nodeById[first.b];
      }
      if (!feeder) return;
      const srcc = srccByString[si];
      const gs = document.createElementNS(SVGNS, 'g');
      // sits clear of the SRCC ring when the string is restricted
      gs.setAttribute('transform', `translate(${feeder.x},${feeder.y - RING_OUT - (srcc ? 26 : 16)})`);
      gs.setAttribute('class', 'string-badge');
      const badge = document.createElementNS(SVGNS, 'rect');
      badge.setAttribute('x', '-15'); badge.setAttribute('y', '-12');
      badge.setAttribute('width', '30'); badge.setAttribute('height', '20');
      badge.setAttribute('rx', '6');
      badge.setAttribute('fill', srcc ? 'var(--cable)' : 'var(--panel)');
      badge.setAttribute('stroke', srcc ? 'var(--cable)' : 'var(--line-strong)');
      badge.setAttribute('stroke-width', '1.2');
      gs.appendChild(badge);
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', '0'); t.setAttribute('y', '3');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'string-badge-text');
      t.setAttribute('fill', srcc ? '#fff' : 'var(--text)');
      t.textContent = `S${stringNumber(project, si)}${srcc ? ' ⚠' : ''}`;
      gs.appendChild(t);
      svgEl.appendChild(gs);
    });

    // every foundation sitting on a restricted string, so it can be ringed
    const srccNodeIds = new Set();
    project.connections.forEach((conn) => {
      if (!srccByString[conn.string]) return;
      srccNodeIds.add(conn.a);
      srccNodeIds.add(conn.b);
    });

    project.nodes.forEach((node) => {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', `node-group${pendingConnectFrom === node.id ? ' selected' : ''}`);
      g.setAttribute('data-node-id', node.id);
      g.setAttribute('transform', `translate(${node.x},${node.y})`);

      // red ring around any foundation on a restricted (SRCC) string
      if (srccNodeIds.has(node.id) && !node.substation) {
        const ring = document.createElementNS(SVGNS, 'circle');
        ring.setAttribute('r', String(RING_OUT + 7));
        ring.setAttribute('class', 'srcc-ring');
        g.appendChild(ring);
      }

      if (node.substation) {
        const size = NODE_R * 1.5;
        const rect = document.createElementNS(SVGNS, 'rect');
        rect.setAttribute('x', String(-size / 2));
        rect.setAttribute('y', String(-size / 2));
        rect.setAttribute('width', String(size));
        rect.setAttribute('height', String(size));
        rect.setAttribute('rx', '5');
        rect.setAttribute('class', 'substation-marker');
        rect.setAttribute('data-kind', 'hub');
        g.appendChild(rect);

        // the platform itself, not a lightning bolt: same box, same proportions
        const oss = document.createElementNS(SVGNS, 'image');
        oss.setAttribute('href', 'assets/oss.svg');
        oss.setAttribute('x', String(-size * 0.22));
        oss.setAttribute('y', String(-size * 0.42));
        oss.setAttribute('width', String(size * 0.44));
        oss.setAttribute('height', String(size * 0.62));
        oss.setAttribute('class', 'substation-icon-img');
        oss.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        g.appendChild(oss);

        const ossLabel = document.createElementNS(SVGNS, 'text');
        ossLabel.setAttribute('x', '0');
        ossLabel.setAttribute('y', String(size / 2 - 5));
        ossLabel.setAttribute('text-anchor', 'middle');
        ossLabel.setAttribute('class', 'substation-label');
        ossLabel.textContent = node.label;
        g.appendChild(ossLabel);

        svgEl.appendChild(g);
        return;
      }

      if (catCount === 0) {
        const circle = document.createElementNS(SVGNS, 'circle');
        circle.setAttribute('r', String(NODE_R));
        circle.setAttribute('class', 'node-wedge');
        circle.setAttribute('data-kind', 'body');
        circle.style.fill = 'var(--panel)';
        g.appendChild(circle);
      } else if (catCount === 1) {
        const cat = cats[0];
        const circle = document.createElementNS(SVGNS, 'circle');
        circle.setAttribute('r', String(NODE_R));
        circle.setAttribute('class', 'node-wedge');
        circle.setAttribute('data-kind', `wedge-${cat.id}`);
        circle.style.fill = statusFill(node.status[cat.id], cat);
        g.appendChild(circle);
      } else {
        const slice = (2 * Math.PI) / catCount;
        cats.forEach((cat, i) => {
          const start = -Math.PI / 2 + i * slice;
          const end = start + slice;
          const path = document.createElementNS(SVGNS, 'path');
          path.setAttribute('d', wedgePath(0, 0, NODE_R, start, end));
          path.setAttribute('class', 'node-wedge');
          path.setAttribute('data-kind', `wedge-${cat.id}`);
          path.style.fill = statusFill(node.status[cat.id], cat);
          g.appendChild(path);
        });
      }

      if (microCount > 0) {
        const microSlice = (2 * Math.PI) / microCount;
        micros.forEach((mv, i) => {
          const spans = microCount === 1
            ? [[-Math.PI / 2, Math.PI / 2], [Math.PI / 2, (3 * Math.PI) / 2]]
            : [[-Math.PI / 2 + i * microSlice, -Math.PI / 2 + (i + 1) * microSlice]];
          spans.forEach(([a0, a1]) => {
            const cell = document.createElementNS(SVGNS, 'path');
            cell.setAttribute('d', ringSegmentPath(RING_IN, RING_OUT, a0, a1));
            cell.setAttribute('class', 'node-ring-cell');
            cell.setAttribute('data-kind', `micro-${mv.id}`);
            cell.style.fill = statusFill(node.micro[mv.id], mv);
            g.appendChild(cell);
          });
        });
      }

      const hub = document.createElementNS(SVGNS, 'circle');
      hub.setAttribute('r', String(HUB_R));
      hub.setAttribute('class', 'node-hub node-hub-ring');
      hub.setAttribute('data-kind', 'hub');
      g.appendChild(hub);

      if (node.issue) {
        const x = document.createElementNS(SVGNS, 'text');
        const xPos = polar(RING_OUT + 10, -Math.PI / 4);
        x.setAttribute('x', String(xPos.x));
        x.setAttribute('y', String(xPos.y));
        x.setAttribute('class', 'node-issue-x');
        x.setAttribute('font-size', '14');
        x.textContent = '✕';
        g.appendChild(x);
      }

      const label = document.createElementNS(SVGNS, 'text');
      label.setAttribute('x', '0');
      label.setAttribute('y', String(RING_OUT + 14));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'node-label');
      label.textContent = node.label;
      g.appendChild(label);

      svgEl.appendChild(g);
    });

    // free-text map annotations (world-space font size: small = only legible
    // zoomed in, big = readable when zoomed right out)
    (project.annotations || []).forEach((an) => {
      if (an.deleted) return;
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', String(an.x));
      t.setAttribute('y', String(an.y));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'map-annotation');
      t.setAttribute('font-size', String(an.size || 30));
      t.setAttribute('data-annot-id', an.id);
      t.textContent = an.text;
      svgEl.appendChild(t);
    });
  }

  // Only the farm-wide total lives here now. The per-task figures used to be
  // repeated in the right panel; they sit on the task rows themselves, and
  // reading the same twenty-four numbers in two places helped nobody.
  function renderProgress() {
    const project = getActiveProject();
    const overallEl = document.getElementById('progress-overall');
    if (!overallEl) return;
    overallEl.innerHTML = '';
    if (!project) return;
    const foundationNodes = project.nodes.filter((n) => !n.substation);
    const nodeCount = foundationNodes.length;
    let totalDone = 0;
    let totalSlots = 0;

    const countGroup = (items, statusKey) => {
      items.forEach((item) => {
        totalDone += foundationNodes.filter((n) => n[statusKey][item.id] && !n[statusKey][item.id].partial).length;
        totalSlots += nodeCount;
      });
    };
    // an archived task is not work anyone is being asked to do, so it must not
    // drag the farm-wide figure down for ever
    countGroup(visibleItems(project.categories), 'status');
    countGroup(visibleItems(project.microVars), 'micro');

    const overallPct = totalSlots ? Math.round((totalDone / totalSlots) * 100) : 0;
    overallEl.innerHTML = `
      <div class="progress-row-label"><span><strong>Overall</strong></span><span class="pct">${totalDone}/${totalSlots} · ${overallPct}%</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${overallPct}%; background:var(--accent)"></div></div>
    `;
  }

  function renderPunchList() {
    const project = getActiveProject();
    const ul = document.getElementById('punch-list');
    ul.innerHTML = '';
    if (!project) return;
    project.punchList.filter((item) => !item.deleted).forEach((item) => {
      const li = document.createElement('li');
      li.className = `punch-item${item.done ? ' done' : ''}`;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      cb.disabled = !canEdit();
      cb.addEventListener('change', () => {
        item.done = cb.checked;
        item.doneBy = cb.checked && user ? user.name : null;
        item.updatedAt = new Date().toISOString();
        touchAndSave();
        renderPunchList();
      });

      const span = document.createElement('span');
      span.textContent = item.text;
      li.append(cb, span);

      if (item.done && item.doneBy) {
        const by = document.createElement('span');
        by.className = 'check-meta';
        by.textContent = item.doneBy;
        li.appendChild(by);
      }

      if (canEdit()) {
        const del = document.createElement('button');
        del.className = 'btn btn-ghost';
        del.textContent = '✕';
        del.addEventListener('click', () => {
          // tombstone instead of removal so the deletion syncs to teammates
          item.deleted = true;
          item.updatedAt = new Date().toISOString();
          touchAndSave();
          renderPunchList();
        });
        li.appendChild(del);
      }

      ul.appendChild(li);
    });
  }

  // ---------- node modal ----------
  function currentModalNode() {
    const project = getActiveProject();
    return project && project.nodes.find((n) => n.id === openNodeId);
  }

  function stampState(stamp) {
    if (!stamp) return 'none';
    return stamp.partial ? 'partial' : 'done';
  }

  // The three status marks, drawn as vectors rather than emoji so they stay
  // crisp at any size and, above all, so CSS can colour the selected one and
  // keep the other two grey (emoji always render in their own fixed colours).
  //   not done  = a cross
  //   done      = a tick
  //   partial   = both, superimposed either side of a diagonal slash
  function segIcon(key) {
    // All three share one 34x24 canvas so every button stays the same width,
    // even though only "partial" uses the full span.
    const open = '<svg class="seg-icon" viewBox="0 0 34 24" fill="none"'
      + ' stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"'
      + ' focusable="false" aria-hidden="true">';
    if (key === 'none') {
      return `${open}<path d="M11 6 23 18"/><path d="M23 6 11 18"/></svg>`;
    }
    if (key === 'done') {
      return `${open}<path d="M9.5 12.6 14.6 17.6 24.5 6.6"/></svg>`;
    }
    // half-done: tick and cross flanking a slash — "some yes, some no"
    return `${open}<path d="M1.8 12.4 5.4 16 11 8.2" stroke-width="2.5"/>`
      + '<path d="M19.2 3.6 14.8 20.4" stroke-width="1.9" opacity="0.75"/>'
      + '<path d="M23 8.6 31 17.4" stroke-width="2.5"/>'
      + '<path d="M31 8.6 23 17.4" stroke-width="2.5"/></svg>';
  }


  // Check all / Uncheck all covers EVERY task on the foundation. There used to
  // be one button per list, which only ever ticked half the foundation.
  function modalTaskGroups(project) {
    return [
      { items: visibleItems(project.categories), key: 'status' },
      { items: visibleItems(project.microVars), key: 'micro' },
    ];
  }

  function allModalTasks(project) {
    return modalTaskGroups(project).flatMap((g) => g.items.map((item) => ({ item, key: g.key })));
  }

  function refreshModalTasks(node) {
    const project = getActiveProject();
    if (!project || !node) return;
    renderModalChecklist(document.getElementById('modal-categories'), visibleItems(project.categories), node, 'status');
    renderModalChecklist(document.getElementById('modal-micro'), visibleItems(project.microVars), node, 'micro');
    renderModalCheckAll(node);
  }

  function renderModalCheckAll(node) {
    const btn = document.getElementById('modal-check-all');
    const project = getActiveProject();
    if (!btn || !project || !node) return;
    const all = allModalTasks(project);
    btn.classList.toggle('hidden', !canEdit() || node.substation || all.length < 2);
    if (btn.classList.contains('hidden')) return;
    const allDone = all.every(({ item, key }) => stampState(node[key][item.id]) === 'done');
    btn.textContent = allDone ? 'Uncheck all' : 'Check all';
    btn.onclick = () => {
      all.forEach(({ item, key }) => {
        if (allDone) node[key][item.id] = null;
        else if (stampState(node[key][item.id]) !== 'done') node[key][item.id] = checkStamp();
      });
      logActivity('bulk', allDone
        ? `${node.label} · all ${all.length} tasks cleared`
        : `${node.label} · all ${all.length} tasks marked done`);
      touchAndSave();
      renderCanvas();
      renderProgress();
      refreshModalTasks(node);
    };
  }

  function renderModalChecklist(listEl, items, node, statusKey) {
    listEl.innerHTML = '';
    const editable = canEdit();

    items.forEach((item) => {
      const li = document.createElement('li');
      // a grid with named zones, not a wrapping flex row: the name, the state
      // buttons, the date and the comment each own a cell, so no length of
      // task name or comment can ever make two of them land on top of another
      li.className = 'modal-category-row task-row';

      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;

      const label = document.createElement('span');
      label.textContent = item.name;
      label.className = 'modal-category-name';

      const controls = document.createElement('span');
      controls.className = 'row-controls';

      li.append(dot, label, controls);

      const stamp = node[statusKey][item.id];
      const stateNow = stampState(stamp);

      if (editable) {
        const seg = document.createElement('span');
        seg.className = 'segmented';
        [
          { key: 'none', title: 'Not done' },
          { key: 'partial', title: 'Partially done' },
          { key: 'done', title: 'Done' },
        ].forEach((opt) => {
          const b = document.createElement('button');
          b.className = `seg-btn${stateNow === opt.key ? ' active' : ''}`;
          b.dataset.state = opt.key; // lets CSS colour-code: red / amber / green
          b.innerHTML = segIcon(opt.key);
          b.title = opt.title;
          b.setAttribute('aria-label', opt.title);
          b.setAttribute('aria-pressed', String(stateNow === opt.key));
          b.addEventListener('click', () => {
            if (opt.key === 'none') node[statusKey][item.id] = null;
            else node[statusKey][item.id] = checkStamp(opt.key === 'partial');
            logActivity('task', `${node.label} · ${item.name} → ${stateWord(opt.key)}`);
            touchAndSave();
            renderCanvas();
            renderProgress();
            refreshModalTasks(node);
          });
          seg.appendChild(b);
        });
        controls.appendChild(seg);

        const commentBtn = document.createElement('button');
        commentBtn.className = 'btn btn-ghost btn-comment';
        commentBtn.innerHTML = iconMarkup('note', 'ico ico--sm');
        commentBtn.title = 'Task comment';
        commentBtn.addEventListener('click', () => {
          const current = node.taskComments[item.id] || '';
          const next = prompt(`Comment for "${item.name}" on ${node.label}:`, current);
          if (next === null) return;
          if (next.trim()) node.taskComments[item.id] = next.trim();
          else delete node.taskComments[item.id];
          logActivity('comment', next.trim()
            ? `${node.label} · ${item.name}: "${next.trim()}"`
            : `${node.label} · ${item.name}: comment removed`);
          touchAndSave();
          refreshModalTasks(node);
        });
        controls.appendChild(commentBtn);
      } else if (stateNow !== 'none') {
        // read-only view: same marks as the buttons, same colour coding
        const badge = document.createElement('span');
        badge.className = `state-badge state-badge--${stateNow}`;
        badge.innerHTML = `${segIcon(stateNow)}<span>${stateNow === 'done' ? 'done' : 'partial'}</span>`;
        controls.appendChild(badge);
      }

      const metaText = formatStamp(stamp);
      if (metaText) {
        const meta = document.createElement('span');
        meta.className = 'check-meta';
        meta.textContent = stateNow === 'partial' ? `partial · ${metaText}` : metaText;
        li.appendChild(meta);
      }

      const comment = node.taskComments[item.id];
      if (comment) {
        const c = document.createElement('div');
        c.className = 'task-comment';
        // icon and text are separate boxes so wrapped lines stay aligned
        // under the text instead of sliding back under the icon
        const icon = document.createElement('span');
        icon.className = 'task-comment-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = iconMarkup('note', 'ico ico--sm');
        const body = document.createElement('span');
        body.className = 'task-comment-text';
        body.textContent = comment;
        c.append(icon, body);
        li.appendChild(c);
      }

      listEl.appendChild(li);
    });
  }

  function renderModalReports(node) {
    const project = getActiveProject();
    const listEl = document.getElementById('modal-reports');
    listEl.innerHTML = '';
    const editable = canEdit();

    project.reportTypes.forEach((rt) => {
      const entries = node.reports[rt.id] || [];
      const li = document.createElement('li');
      li.className = 'modal-category-row report-row';

      const label = document.createElement('span');
      label.className = 'modal-category-name';
      label.textContent = rt.name;
      li.appendChild(label);

      const count = document.createElement('span');
      count.className = 'report-count';
      count.textContent = `×${entries.length}`;
      li.appendChild(count);

      if (editable) {
        const add = document.createElement('button');
        add.className = 'btn btn-ghost';
        add.textContent = '+1';
        add.title = 'Add one occurrence (now)';
        add.addEventListener('click', () => {
          node.reports[rt.id] = entries.concat([checkStamp()]);
          touchAndSave();
          renderModalReports(node);
        });
        li.appendChild(add);

        if (entries.length) {
          const undo = document.createElement('button');
          undo.className = 'btn btn-ghost';
          undo.textContent = '↺';
          undo.title = 'Remove last occurrence';
          undo.addEventListener('click', () => {
            node.reports[rt.id] = entries.slice(0, -1);
            touchAndSave();
            renderModalReports(node);
          });
          li.appendChild(undo);
        }
      }

      if (entries.length) {
        const details = document.createElement('details');
        details.className = 'report-dates';
        const summary = document.createElement('summary');
        summary.textContent = `last: ${formatStamp(entries[entries.length - 1])}`;
        details.appendChild(summary);
        const ul = document.createElement('ul');
        entries.slice().reverse().forEach((e) => {
          const d = document.createElement('li');
          d.textContent = formatStamp(e);
          ul.appendChild(d);
        });
        details.appendChild(ul);
        li.appendChild(details);
      }

      listEl.appendChild(li);
    });
  }

  function openNodeModal(nodeId) {
    openNodeId = nodeId;
    const node = currentModalNode();
    if (!node) return;
    const project = getActiveProject();

    const labelInput = document.getElementById('modal-label');
    labelInput.value = node.label;
    labelInput.disabled = !isAdmin();

    // discreet geographic coordinates + Google Maps link
    const geoEl = document.getElementById('modal-geo');
    const coords = COORDS[node.label];
    if (coords) {
      geoEl.innerHTML = `<span>${escapeHtml(coords[2])}</span>`
        + ` · <a href="https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}" target="_blank" rel="noopener">Google Maps</a>`;
      geoEl.classList.remove('hidden');
    } else {
      geoEl.classList.add('hidden');
    }
    document.getElementById('modal-issue').checked = !!node.issue;
    const noteEl = document.getElementById('modal-note');
    noteEl.value = node.note || '';
    noteEl.disabled = !canEdit();
    document.getElementById('modal-title').textContent = node.substation ? 'Substation details' : `Foundation ${node.label}`;

    // SRCC access-rules reminder for foundations on a restricted string
    const srccEl = document.getElementById('modal-srcc');
    const strings = nodeStringIndices(project, node.id).filter((si) => project.strings[si] && project.strings[si].srcc);
    if (strings.length) {
      const names = strings.map((si) => `S${si + 1}`).join(', ');
      srccEl.innerHTML = `<strong>⚠ SRCC — ${escapeHtml(names)} — restricted access</strong>`
        + `<div class="srcc-rules">${escapeHtml(project.accessRules)}</div>`;
      srccEl.classList.remove('hidden');
    } else {
      srccEl.classList.add('hidden');
    }

    const catListEl = document.getElementById('modal-categories');
    const microListEl = document.getElementById('modal-micro');
    const reportsEl = document.getElementById('modal-reports');
    if (node.substation) {
      catListEl.innerHTML = '<li class="hint">Not applicable to the substation.</li>';
      microListEl.innerHTML = '';
      reportsEl.innerHTML = '';
      renderModalCheckAll(node);
    } else {
      refreshModalTasks(node);
      renderModalReports(node);
    }

    document.getElementById('node-modal').classList.remove('hidden');
  }

  function closeModalAndRender() {
    document.getElementById('node-modal').classList.add('hidden');
    openNodeId = null;
    render();
  }

  // ---------- 12h recap & CSV backup ----------
  function recapLinesForNode(node, project, sinceMs) {
    const lines = [];
    const isRecent = (stamp) => stamp && stamp.at && (Date.now() - new Date(stamp.at).getTime()) <= sinceMs;

    project.categories.forEach((cat) => {
      const st = node.status[cat.id];
      if (isRecent(st)) lines.push(`- ${cat.name} → ${st.partial ? '◧ partial' : '✅'}`);
    });
    project.microVars.forEach((mv) => {
      const st = node.micro[mv.id];
      if (isRecent(st)) lines.push(`- ${mv.name} → ${st.partial ? '◧ partial' : '✅'}`);
    });
    project.reportTypes.forEach((rt) => {
      const recent = (node.reports[rt.id] || []).filter(isRecent);
      if (recent.length) lines.push(`- ${rt.name} ×${recent.length} → ✅`);
    });
    return lines;
  }

  // A shift, not a day. Twenty-four hours reached back over yesterday's work
  // and the recap pasted in the channel repeated what was already there.
  const RECAP_MS = 12 * 3600 * 1000;

  function copyRecap(nodesToScan) {
    const project = getActiveProject();
    const dayMs = RECAP_MS;
    const blocks = [];
    nodesToScan.filter((n) => !n.substation).forEach((node) => {
      const lines = recapLinesForNode(node, project, dayMs);
      if (lines.length) blocks.push([`■ FOU → ${node.label}`, ...lines].join('\n'));
    });
    if (!blocks.length) {
      showToast('No completed task in the last 12 hours.');
      return;
    }
    copyText(blocks.join('\n\n'), 'Recap copied — paste it in WhatsApp.');
  }

  function exportCsv() {
    const project = getActiveProject();
    const sep = ';';
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = [['Foundation', 'Group', 'Task', 'State', 'Date', 'By', 'Comment'].join(sep)];

    project.nodes.filter((n) => !n.substation).forEach((node) => {
      const pushRow = (group, name, stamp, comment) => {
        const stateTxt = stamp ? (stamp.partial ? 'Partial' : 'Done') : 'Not done';
        rows.push([
          q(node.label), q(group), q(name), q(stateTxt),
          q(stamp && stamp.at ? formatDate(stamp.at) : ''),
          q(stamp && stamp.by ? stamp.by : ''),
          q(comment || ''),
        ].join(sep));
      };
      project.categories.forEach((cat) => pushRow('Task', cat.name, node.status[cat.id], node.taskComments[cat.id]));
      project.microVars.forEach((mv) => pushRow('Task', mv.name, node.micro[mv.id], node.taskComments[mv.id]));
      project.reportTypes.forEach((rt) => {
        (node.reports[rt.id] || []).forEach((entry) => {
          rows.push([q(node.label), q('Report'), q(rt.name), q('Occurrence'), q(formatDate(entry.at)), q(entry.by || ''), q('')].join(sep));
        });
      });
      if (node.note) rows.push([q(node.label), q('Note'), q('Free note'), q(''), q(''), q(''), q(node.note)].join(sep));
    });

    const dateTag = new Date().toISOString().slice(0, 10);
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Op-BOP-tre-FOU_backup_${dateTag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    markExported();
    showToast('CSV backup downloaded.');
  }

  // ---------- method statements ----------
  function getProcedure(project, itemId) {
    if (!project.procedures[itemId]) {
      project.procedures[itemId] = { en: '', fr: '', tools_en: '', tools_fr: '', ppe_en: '', ppe_fr: '' };
    }
    const proc = project.procedures[itemId];
    if (!proc.sectionUpdated || typeof proc.sectionUpdated !== 'object') proc.sectionUpdated = {};
    return proc;
  }

  // ---------- "instruction changed" flags ----------
  // Each part of a method statement carries its own timestamp, so a tech can
  // see exactly what an admin touched (the wording, the tools, the PPE…)
  // rather than just "something changed somewhere".
  const PROC_HIGHLIGHT_MS = 24 * 60 * 60 * 1000; // stays flagged for 24h
  const PROC_SEEN_KEY = 'worksite-tracker:procSeen';

  function markProcedureChanged(proc, key, itemId) {
    proc.sectionUpdated = proc.sectionUpdated || {};
    proc.sectionUpdated[key] = new Date().toISOString();
    proc.updatedBy = (user && user.name) || null;
    // the author already knows what they just wrote — don't notify them
    if (itemId) markProcSeen(itemId);
  }

  function procSectionAge(proc, key) {
    const at = proc.sectionUpdated && proc.sectionUpdated[key];
    if (!at) return null;
    const ms = Date.now() - new Date(at).getTime();
    return Number.isFinite(ms) ? { at, ms } : null;
  }

  function procLastChange(proc) {
    const stamps = Object.values((proc && proc.sectionUpdated) || {})
      .map((s) => new Date(s).getTime())
      .filter((t) => Number.isFinite(t));
    return stamps.length ? Math.max(...stamps) : 0;
  }

  // "Seen" is per person, and it now lives in the project so it travels with
  // them. It used to sit in this device's localStorage, which meant the same
  // technician was told again on their phone about an instruction they had
  // already read on the laptop — the red dot came back for no reason.
  function procSeenKey() {
    return (user && user.name) || 'visitor';
  }

  function loadProcSeen() {
    const project = getActiveProject();
    const synced = (project && project.procSeen && project.procSeen[procSeenKey()]) || {};
    // whatever this device already knew still counts, so nobody gets a wall of
    // red dots for instructions they read before this shipped
    let local = {};
    try { local = (JSON.parse(localStorage.getItem(PROC_SEEN_KEY) || '{}'))[procSeenKey()] || {}; } catch (e) { local = {}; }
    const merged = Object.assign({}, local);
    Object.entries(synced).forEach(([id, at]) => {
      if (new Date(at || 0).getTime() > new Date(merged[id] || 0).getTime()) merged[id] = at;
    });
    return merged;
  }

  function markProcSeen(itemId) {
    const project = getActiveProject();
    if (!project) return;
    project.procSeen = project.procSeen || {};
    const mine = project.procSeen[procSeenKey()] || {};
    mine[itemId] = new Date().toISOString();
    project.procSeen[procSeenKey()] = mine;
    // still written locally as well: a visitor, or a device that never syncs,
    // keeps its own record
    try {
      const all = JSON.parse(localStorage.getItem(PROC_SEEN_KEY) || '{}');
      all[procSeenKey()] = Object.assign(all[procSeenKey()] || {}, { [itemId]: mine[itemId] });
      localStorage.setItem(PROC_SEEN_KEY, JSON.stringify(all));
    } catch (e) { /* the synced copy is the one that matters */ }
    touchAndSave();
  }

  // procedures changed since this person last opened them
  function unseenProcedureIds() {
    const project = getActiveProject();
    if (!project) return [];
    const seen = loadProcSeen();
    return project.categories.concat(project.microVars)
      .filter((item) => {
        const proc = project.procedures[item.id];
        const changed = procLastChange(proc);
        if (!changed) return false;
        const seenAt = seen[item.id] ? new Date(seen[item.id]).getTime() : 0;
        return changed > seenAt;
      })
      .map((item) => item.id);
  }

  function isProcUnseen(itemId) {
    return unseenProcedureIds().indexOf(itemId) !== -1;
  }

  // Open the method statements. With an id, that one instruction is expanded
  // and scrolled to; without one, whatever was last read stays open.
  function openProcedures(itemId) {
    if (itemId) openProcId = itemId;
    renderProcedures();
    // unhide before the <details> toggle fires, otherwise the "scroll it under
    // the header" step measures a hidden box and lands nowhere
    document.getElementById('proc-modal').classList.remove('hidden');
  }

  // The counter used to hang off a method-statement button in the top bar.
  // That button is gone — instructions are reached from the task itself now —
  // so the counter moved onto the button that opens the task list. On a wide
  // screen that panel is already open and each row carries its own red dot.
  function updateProcBadge() {
    const btn = document.getElementById('btn-drawer-left');
    if (!btn) return;
    const n = unseenProcedureIds().length;
    let dot = btn.querySelector('.proc-badge');
    const base = procL('Tasks & settings', 'Tâches & réglages');
    // the tooltip has to go back to normal once everything has been read,
    // otherwise it keeps announcing updates that are no longer there
    if (!n) { if (dot) dot.remove(); btn.classList.remove('has-updates'); btn.title = base; return; }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'proc-badge';
      btn.appendChild(dot);
    }
    dot.textContent = n > 9 ? '9+' : String(n);
    btn.classList.add('has-updates');
    btn.title = procL(
      `${base} — ${n} method statement${n > 1 ? 's' : ''} updated, tap a task to read`,
      `${base} — ${n} mode${n > 1 ? 's' : ''} opératoire${n > 1 ? 's' : ''} modifié${n > 1 ? 's' : ''}, appuie sur la tâche`,
    );
  }

  function renderProcedures() {
    const project = getActiveProject();
    const body = document.getElementById('proc-body');
    // hold the reading position across the re-render, so switching language
    // swaps the text in place instead of jumping back to the top
    const scroller = document.querySelector('#proc-modal .modal-card');
    const keepScroll = scroller ? scroller.scrollTop : 0;
    body.innerHTML = '';
    const admin = isAdmin();
    const items = project.categories.concat(project.microVars);

    const langBtn = document.getElementById('proc-lang');
    langBtn.textContent = procL('🇫🇷 FR', '🇬🇧 EN');
    langBtn.title = procL('Read in French', 'Lire en anglais');
    const title = document.getElementById('proc-title-text');
    if (title) title.textContent = procL('Method statements', 'Modes opératoires');

    const unseen = new Set(unseenProcedureIds());

    items.forEach((item) => {
      const proc = getProcedure(project, item.id);
      const details = document.createElement('details');
      details.className = 'proc-item';
      // keep whatever the reader had open: switching FR/EN, adding a
      // consumable or saving an edit re-renders this list, and collapsing
      // everything would lose their place mid-read
      details.open = openProcId === item.id;

      const summary = document.createElement('summary');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;
      summary.append(dot, document.createTextNode(` ${item.name}`));

      // unread flag for this person + "changed in the last 24h" flag
      const isUnseen = unseen.has(item.id);
      const recent = procLastChange(proc) && (Date.now() - procLastChange(proc)) < PROC_HIGHLIGHT_MS;
      if (isUnseen || recent) {
        const chip = document.createElement('span');
        chip.className = `proc-chip${isUnseen ? ' proc-chip--unread' : ''}`;
        chip.textContent = isUnseen ? procL('NEW', 'NOUVEAU') : procL('UPDATED', 'MODIFIÉ');
        summary.appendChild(chip);
        details.classList.add('proc-item--updated');
      }
      if (proc.updatedBy && (isUnseen || recent)) {
        const who = document.createElement('span');
        who.className = 'proc-updated-by';
        who.textContent = procL(`by ${proc.updatedBy}`, `par ${proc.updatedBy}`);
        summary.appendChild(who);
      }

      // reading it is the acknowledgement: opening clears this person's flag
      details.addEventListener('toggle', () => {
        if (syncingProcOpen) return; // we are the ones collapsing the others
        if (!details.open) {
          if (openProcId === item.id) openProcId = null;
          return;
        }
        openProcId = item.id;
        // close whatever was open, then bring this one to the top: collapsing
        // an instruction placed above would otherwise yank the text upwards
        syncingProcOpen = true;
        body.querySelectorAll('details.proc-item').forEach((d) => { if (d !== details) d.open = false; });
        syncingProcOpen = false;
        // park it just under the sticky header — scrollIntoView ignores the
        // header and hides the title of what you just opened behind it
        requestAnimationFrame(() => {
          const scr = document.querySelector('#proc-modal .modal-card');
          if (!scr) return;
          const head = scr.querySelector('.modal-header');
          const pad = head ? head.getBoundingClientRect().height : 0;
          scr.scrollTop += summary.getBoundingClientRect().top - scr.getBoundingClientRect().top - pad;
        });
        if (!unseen.has(item.id)) return;
        markProcSeen(item.id);
        unseen.delete(item.id);
        const chip = summary.querySelector('.proc-chip--unread');
        if (chip) { chip.classList.remove('proc-chip--unread'); chip.textContent = procL('UPDATED', 'MODIFIÉ'); }
        updateProcBadge();
        // the task list behind the modal carries the same unread mark
        renderCategories();
        renderMicroList();
      });

      details.appendChild(summary);

      // every section is written per language: FR and EN never share a field
      const alt = otherLang(procLang);
      const L = procL;
      const sections = [
        { key: procLang, twin: alt, label: L('Method statement (EN)', 'Mode opératoire (FR)') },
        { key: `tools_${procLang}`, twin: `tools_${alt}`, label: L('Tools & consumables', 'Outils & consommables') },
        { key: `ppe_${procLang}`, twin: `ppe_${alt}`, label: L('PPE & required trainings', 'EPI & formations requises') },
      ];

      sections.forEach((section) => {
        const wrap = document.createElement('div');
        wrap.className = 'proc-section';
        const h = document.createElement('h4');
        h.textContent = section.label;
        wrap.appendChild(h);
        // flag the exact part that changed, for 24h after the edit
        const age = procSectionAge(proc, section.key);
        if (age && age.ms < PROC_HIGHLIGHT_MS) {
          wrap.classList.add('proc-section--changed');
          const tag = document.createElement('span');
          tag.className = 'proc-changed-tag';
          tag.textContent = procL(`changed ${formatStamp({ at: age.at }) || ''}`, `modifié ${formatStamp({ at: age.at }) || ''}`).trim();
          h.appendChild(tag);
        }
        // each section exists in two languages; flag when one side is missing
        // or older than the other so nobody reads a stale translation
        const otherKey = section.twin;
        const otherText = otherKey ? (proc[otherKey] || '').trim() : '';
        const thisText = (proc[section.key] || '').trim();
        if (otherKey && otherText) {
          const thisAt = new Date((proc.sectionUpdated || {})[section.key] || 0).getTime();
          const otherAt = new Date((proc.sectionUpdated || {})[otherKey] || 0).getTime();
          let warn = '';
          if (!thisText) warn = L(`Not written in EN yet — the FR version exists.`, `Pas encore écrit en FR — la version EN existe.`);
          else if (otherAt && otherAt > thisAt) warn = L(`The ${alt.toUpperCase()} version was edited more recently — this one may be out of date.`, `La version ${alt.toUpperCase()} a été modifiée plus récemment — celle-ci est peut-être dépassée.`);
          if (warn) {
            const note = document.createElement('p');
            note.className = 'proc-lang-warning';
            note.textContent = `⚠ ${warn}`;
            // "not written yet" must not keep nagging while it is being written
            note.dataset.missing = thisText ? '' : '1';
            wrap.appendChild(note);
          }
        }

        if (admin) {
          const ta = document.createElement('textarea');
          ta.rows = 4;
          ta.value = proc[section.key] || '';
          ta.placeholder = L('To be completed…', 'À compléter…');
          const missingNote = wrap.querySelector('.proc-lang-warning[data-missing="1"]');
          if (missingNote) {
            ta.addEventListener('input', () => { missingNote.hidden = !!ta.value.trim(); });
          }
          ta.addEventListener('change', () => {
            if (ta.value === (proc[section.key] || '')) return; // no real change
            proc[section.key] = ta.value;
            logActivity('procedure', `${item.name} · ${section.label}`);
            markProcedureChanged(proc, section.key, item.id);
            touchAndSave();
            updateProcBadge();
          });
          wrap.appendChild(ta);
        } else {
          const p = document.createElement('p');
          p.className = proc[section.key] ? 'proc-text' : 'proc-text proc-empty';
          p.textContent = proc[section.key] || L('To be completed…', 'À compléter…');
          wrap.appendChild(p);
        }
        details.appendChild(wrap);
      });

      // structured consumables (feed the day planner; flag recurring restock)
      proc.consumables = proc.consumables || [];
      const consWrap = document.createElement('div');
      consWrap.className = 'proc-section';
      const consH = document.createElement('h4');
      // deliberately shared by both languages: this is the picking list the day
      // plan adds up, and one item must not be counted twice under two names
      consH.textContent = L('Consumables (day plan)', 'Consommables (préparation)');
      consWrap.appendChild(consH);
      const consAge = procSectionAge(proc, 'consumables');
      if (consAge && consAge.ms < PROC_HIGHLIGHT_MS) {
        consWrap.classList.add('proc-section--changed');
        const tag = document.createElement('span');
        tag.className = 'proc-changed-tag';
        tag.textContent = procL(`changed ${formatStamp({ at: consAge.at }) || ''}`, `modifié ${formatStamp({ at: consAge.at }) || ''}`).trim();
        consH.appendChild(tag);
      }

      if (admin) {
        const ul = document.createElement('ul');
        ul.className = 'consumable-edit';
        proc.consumables.forEach((c, ci) => {
          const li = document.createElement('li');
          const nameIn = document.createElement('input');
          nameIn.type = 'text';
          nameIn.value = c.name || '';
          nameIn.placeholder = L('Consumable name', 'Nom du consommable');
          nameIn.addEventListener('change', () => {
            if (c.name === nameIn.value.trim()) return;
            c.name = nameIn.value.trim();
            markProcedureChanged(proc, 'consumables', item.id);
            touchAndSave();
            updateProcBadge();
          });
          const restockLbl = document.createElement('label');
          restockLbl.className = 'restock-toggle';
          const restockCb = document.createElement('input');
          restockCb.type = 'checkbox';
          restockCb.checked = !!c.restock;
          restockCb.addEventListener('change', () => {
            c.restock = restockCb.checked;
            markProcedureChanged(proc, 'consumables', item.id);
            touchAndSave();
            updateProcBadge();
          });
          restockLbl.append(restockCb, document.createTextNode(L(' ↻ restock often', ' ↻ à réapprovisionner souvent')));
          const del = document.createElement('button');
          del.className = 'btn btn-ghost btn-danger';
          del.textContent = '✕';
          del.addEventListener('click', () => {
            proc.consumables.splice(ci, 1);
            markProcedureChanged(proc, 'consumables', item.id);
            touchAndSave();
            renderProcedures();
          });
          li.append(nameIn, restockLbl, del);
          ul.appendChild(li);
        });
        consWrap.appendChild(ul);
        const add = document.createElement('button');
        add.className = 'btn btn-ghost';
        add.textContent = L('+ Add consumable', '+ Ajouter un consommable');
        add.addEventListener('click', () => {
          proc.consumables.push({ name: '', restock: false });
          markProcedureChanged(proc, 'consumables', item.id);
          touchAndSave();
          renderProcedures();
        });
        consWrap.appendChild(add);
      } else if (proc.consumables.length) {
        const ul = document.createElement('ul');
        ul.className = 'consumable-list';
        proc.consumables.forEach((c) => {
          if (!c.name) return;
          const li = document.createElement('li');
          li.className = c.restock ? 'restock' : '';
          li.textContent = c.name;
          if (c.restock) {
            const badge = document.createElement('span');
            badge.className = 'restock-badge';
            badge.textContent = L('↻ restock often', '↻ à réapprovisionner souvent');
            li.appendChild(badge);
          }
          ul.appendChild(li);
        });
        consWrap.appendChild(ul);
      } else {
        const p = document.createElement('p');
        p.className = 'proc-text proc-empty';
        p.textContent = L('None listed.', 'Aucun renseigné.');
        consWrap.appendChild(p);
      }
      details.appendChild(consWrap);

      body.appendChild(details);
    });

    if (scroller && keepScroll) scroller.scrollTop = keepScroll;
  }

  // ---------- clear the site for a new campaign ----------
  // Everything a foundation carries, gone. Deliberately NOT: the task list, the
  // method statements, the crew, the cables or the log — those are how the site
  // is set up, not what was done on it.
  function resetAllFoundations() {
    const project = getActiveProject();
    if (!project || !isAdmin()) return;
    const foundations = project.nodes.filter((n) => !n.substation);
    if (!confirm(
      `Clear every foundation?\n\n`
      + `All ticks, task comments, inspections, notes and blocking points on `
      + `${foundations.length} foundations will be erased.\n\n`
      + `Method statements, the task list, the crew and the cables are kept.\n\n`
      + `This cannot be undone. Export a backup first if you have not.`,
    )) return;
    // asked again, with the password, because a mis-tap here costs a season
    const pw = prompt('Type the crew password to confirm:');
    if (pw === null) return;
    if (String(pw).trim().toUpperCase() !== 'BOP') {
      showToast('Wrong password — nothing was cleared.');
      return;
    }
    project.nodes.forEach((n) => {
      n.status = {};
      n.micro = {};
      n.taskComments = {};
      n.reports = {};
      n.note = '';
      n.issue = false;
    });
    logActivity('bulk', `Every foundation cleared (${foundations.length} points wiped)`);
    touchAndSave();
    render();
    renderProgress();
    showToast(`${foundations.length} foundations cleared.`);
  }

  // ---------- permits to work ----------
  // A permit is the paper that lets you on the structure at all, so it is the
  // first thing anyone checks in the morning and it changes every day. Kept in
  // the project (so it syncs), with tombstones so closing one sticks.
  function livePermits(project) {
    return (project && project.permits ? project.permits : []).filter((p) => p && !p.deleted);
  }

  function normalizePermitNumber(raw) {
    const t = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!t) return '';
    return /^[A-Z]/.test(t) ? t : `A${t}`;
  }

  function addPermit() {
    const project = getActiveProject();
    const err = document.getElementById('ptw-error');
    const showErr = (msg) => { err.textContent = msg; err.classList.remove('hidden'); };
    err.classList.add('hidden');
    if (!project || !canEdit()) return;
    const kind = document.getElementById('ptw-kind').value;
    const number = normalizePermitNumber(document.getElementById('ptw-number').value);
    const srcc = document.getElementById('ptw-srcc').checked;
    if (!number) { showErr('Type the permit number, e.g. A32408.'); return; }
    if (!/^A\d{4,6}$/.test(number)) { showErr(`"${number}" does not look like a permit number (A32408).`); return; }
    project.permits = project.permits || [];
    if (livePermits(project).some((p) => p.number === number)) {
      showErr(`${number} is already open.`);
      return;
    }
    project.permits.push({
      id: uid(), kind, number, srcc,
      at: new Date().toISOString(),
      by: (user && user.name) || 'Unknown',
      updatedAt: new Date().toISOString(),
    });
    logActivity('permit', `${kind} → ${number}${srcc ? ' srcc' : ''} opened`);
    document.getElementById('ptw-number').value = '';
    document.getElementById('ptw-srcc').checked = false;
    touchAndSave();
    renderPermits();
  }

  function closePermit(id) {
    const project = getActiveProject();
    const permit = (project.permits || []).find((p) => p.id === id);
    if (!permit || !canEdit()) return;
    if (!confirm(`Close permit ${permit.kind} → ${permit.number}?`)) return;
    permit.deleted = true;
    permit.deletedAt = new Date().toISOString();
    permit.updatedAt = permit.deletedAt;
    logActivity('permit', `${permit.kind} → ${permit.number} closed`);
    touchAndSave();
    renderPermits();
  }

  function renderPermits() {
    const project = getActiveProject();
    const listEl = document.getElementById('ptw-list');
    if (!listEl || !project) return;
    const permits = livePermits(project).slice().sort((a, b) => {
      const order = { BOP: 0, SAP: 1, CTV: 2 };
      const d = (order[a.kind] ?? 9) - (order[b.kind] ?? 9);
      return d || a.number.localeCompare(b.number);
    });
    const badge = document.getElementById('ptw-count-badge');
    if (badge) badge.textContent = String(permits.length);
    listEl.innerHTML = '';
    if (!permits.length) {
      const li = document.createElement('li');
      li.className = 'ptw-empty hint';
      li.textContent = 'No permit open.';
      listEl.appendChild(li);
      return;
    }
    permits.forEach((p) => {
      const li = document.createElement('li');
      li.className = `ptw-row${p.srcc ? ' srcc' : ''}`;
      const kind = document.createElement('span');
      kind.className = `ptw-kind ptw-kind--${p.kind.toLowerCase()}`;
      kind.textContent = p.kind;
      const num = document.createElement('span');
      num.className = 'ptw-number';
      num.textContent = p.number;
      li.append(kind, num);
      if (p.srcc) {
        const tag = document.createElement('span');
        tag.className = 'ptw-srcc-tag';
        tag.textContent = 'SRCC';
        li.appendChild(tag);
      }
      const meta = document.createElement('span');
      meta.className = 'ptw-meta';
      meta.textContent = p.by || '';
      li.appendChild(meta);
      if (canEdit()) {
        const close = document.createElement('button');
        close.className = 'btn btn-ghost btn-danger';
        close.innerHTML = iconMarkup('close', 'ico ico--sm');
        close.title = `Close permit ${p.number}`;
        close.addEventListener('click', () => closePermit(p.id));
        li.appendChild(close);
      }
      listEl.appendChild(li);
    });
  }

  // ---------- one cable ----------
  let editingConnId = null;

  function openCableModal(connId) {
    const project = getActiveProject();
    const conn = project && project.connections.find((c) => c.id === connId);
    if (!conn || !isAdmin()) return;
    editingConnId = connId;
    document.getElementById('cable-title').textContent = `Cable ${cableName(project, conn)}`;

    const select = document.getElementById('cable-string');
    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'No string (no number, no SRCC)';
    select.appendChild(none);
    project.strings.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `S${stringNumber(project, i)}${s.srcc ? ' — SRCC restricted' : ''}`;
      select.appendChild(opt);
    });
    select.value = typeof conn.string === 'number' ? String(conn.string) : '';

    const note = document.getElementById('cable-srcc');
    const onSrcc = typeof conn.string === 'number' && project.strings[conn.string] && project.strings[conn.string].srcc;
    note.classList.toggle('hidden', !onSrcc);
    if (onSrcc) note.textContent = `⚠ This cable is on S${stringNumber(project, conn.string)}, a restricted string — it is drawn in red.`;

    document.getElementById('cable-modal').classList.remove('hidden');
  }

  function closeCableModal() {
    editingConnId = null;
    document.getElementById('cable-modal').classList.add('hidden');
  }

  // ---------- string helpers ----------
  function nodeStringIndices(project, nodeId) {
    const set = new Set();
    project.connections.forEach((c) => {
      if ((c.a === nodeId || c.b === nodeId) && typeof c.string === 'number') set.add(c.string);
    });
    return [...set];
  }

  // ---------- map text annotations ----------
  function openTextEditor(annotId, x, y) {
    const project = getActiveProject();
    if (!project || !canEdit()) return;
    editingAnnotId = annotId;
    const existing = annotId ? (project.annotations || []).find((a) => a.id === annotId && !a.deleted) : null;
    if (!existing && annotId) return;

    document.getElementById('text-input').value = existing ? existing.text : '';
    const curSize = existing ? existing.size : ANNOT_SIZES[1].size;
    const sel = document.getElementById('text-size');
    sel.innerHTML = '';
    ANNOT_SIZES.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(s.size);
      opt.textContent = `${s.label} (${s.key})`;
      if (s.size === curSize) opt.selected = true;
      sel.appendChild(opt);
    });
    // stash target world position for a new annotation
    editorAnnotPos = existing ? { x: existing.x, y: existing.y } : { x, y };
    document.getElementById('text-delete').classList.toggle('hidden', !existing);
    document.getElementById('text-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('text-input').focus(), 30);
  }

  let editorAnnotPos = null;

  function saveTextEditor() {
    const project = getActiveProject();
    if (!project || !canEdit()) return;
    const text = document.getElementById('text-input').value.trim();
    const size = Number(document.getElementById('text-size').value) || 30;
    if (!text) { closeTextEditor(); return; }
    project.annotations = project.annotations || [];
    if (editingAnnotId) {
      const a = project.annotations.find((an) => an.id === editingAnnotId);
      if (a) { a.text = text; a.size = size; }
    } else if (editorAnnotPos) {
      project.annotations.push({ id: uid(), x: editorAnnotPos.x, y: editorAnnotPos.y, text, size });
    }
    touchAndSave();
    closeTextEditor();
    renderCanvas();
  }

  function deleteTextEditor() {
    const project = getActiveProject();
    if (!project || !editingAnnotId) return;
    // Tombstone, not a hard delete: dropping the note from the array only
    // removes it locally, and the next sync pull would treat the copy still
    // on the server as "a note this device has not seen yet" and bring it
    // straight back. Marking it deleted lets that decision travel.
    const a = (project.annotations || []).find((an) => an.id === editingAnnotId);
    if (a) {
      a.deleted = true;
      a.deletedAt = new Date().toISOString();
    }
    touchAndSave();
    closeTextEditor();
    renderCanvas();
  }

  function closeTextEditor() {
    editingAnnotId = null;
    editorAnnotPos = null;
    document.getElementById('text-modal').classList.add('hidden');
  }

  // ---------- day planner ----------
  const DAYPLAN_KEY = 'worksite-tracker:dayplan';

  function loadDayPlan() {
    try { return JSON.parse(localStorage.getItem(DAYPLAN_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveDayPlan(plan) {
    localStorage.setItem(DAYPLAN_KEY, JSON.stringify(plan));
  }

  function openDayPlan() {
    renderDayPlan();
    document.getElementById('dayplan-modal').classList.remove('hidden');
  }

  function renderDayPlan() {
    const project = getActiveProject();
    const plan = loadDayPlan();
    const selEl = document.getElementById('dayplan-select');
    selEl.innerHTML = '';

    // one list, like everywhere else: whether a task is drawn in the centre or
    // on the ring is a drawing detail nobody picking a day's work cares about
    const items = visibleItems(project.categories).concat(visibleItems(project.microVars));
    items.forEach((item) => {
      const row = document.createElement('label');
      row.className = 'dayplan-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!plan[item.id];
      cb.addEventListener('change', () => {
        const p = loadDayPlan();
        if (cb.checked) p[item.id] = true; else delete p[item.id];
        saveDayPlan(p);
        renderDayPlan();
      });
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;
      const name = document.createElement('span');
      name.textContent = item.name;
      row.append(cb, dot, name);
      selEl.appendChild(row);
    });

    // aggregate tools & consumables from selected tasks
    const selectedIds = items.filter((it) => plan[it.id]).map((it) => it.id);
    const outEl = document.getElementById('dayplan-output');
    outEl.innerHTML = '';
    if (!selectedIds.length) {
      outEl.innerHTML = '<p class="hint">Select today\'s tasks above to build your tools & consumables list.</p>';
      return;
    }

    const toolsTexts = [];
    const ppeTexts = [];
    const consumables = [];
    selectedIds.forEach((id) => {
      const proc = project.procedures[id];
      if (!proc) return;
      const tools = procText(proc, 'tools', procLang);
      const ppe = procText(proc, 'ppe', procLang);
      if (tools) toolsTexts.push(tools);
      if (ppe) ppeTexts.push(ppe);
      (proc.consumables || []).forEach((c) => {
        if (c && c.name) consumables.push(c);
      });
    });

    // consumables: restock ones first & highlighted
    const seen = new Map();
    consumables.forEach((c) => {
      const key = c.name.trim().toLowerCase();
      const cur = seen.get(key) || { name: c.name.trim(), restock: false };
      cur.restock = cur.restock || !!c.restock;
      seen.set(key, cur);
    });
    const consList = [...seen.values()].sort((a, b) => (b.restock - a.restock) || a.name.localeCompare(b.name));

    if (consList.length) {
      const h = document.createElement('h4');
      h.textContent = 'Consumables to prepare';
      outEl.appendChild(h);
      const ul = document.createElement('ul');
      ul.className = 'consumable-list';
      consList.forEach((c) => {
        const li = document.createElement('li');
        li.className = c.restock ? 'restock' : '';
        li.textContent = c.name;
        if (c.restock) {
          const badge = document.createElement('span');
          badge.className = 'restock-badge';
          badge.textContent = '↻ restock often';
          li.appendChild(badge);
        }
        ul.appendChild(li);
      });
      outEl.appendChild(ul);
    }

    if (toolsTexts.length) {
      const h = document.createElement('h4');
      h.textContent = 'Tools & notes';
      outEl.appendChild(h);
      const p = document.createElement('p');
      p.className = 'proc-text';
      p.textContent = toolsTexts.join('\n');
      outEl.appendChild(p);
    }
    if (ppeTexts.length) {
      const h = document.createElement('h4');
      h.textContent = 'PPE & trainings';
      outEl.appendChild(h);
      const p = document.createElement('p');
      p.className = 'proc-text';
      p.textContent = ppeTexts.join('\n');
      outEl.appendChild(p);
    }
    if (!consList.length && !toolsTexts.length && !ppeTexts.length) {
      outEl.innerHTML = '<p class="hint">No tools/consumables recorded yet for these tasks. An admin can fill them in the Method statements.</p>';
    }
  }

  // Anonymous improvement suggestions: anyone can write one (no name is ever
  // attached); the collected list is only rendered for admins.
  // ---------- crew list (login screen) ----------
  function teamError(msg) {
    const el = document.getElementById('team-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function stampMember(m) {
    m.updatedAt = new Date().toISOString();
  }

  function afterTeamChange() {
    touchAndSave();
    renderTeam();
    renderLogin();
    applyPermissionClasses();
  }

  function renderTeam() {
    const project = getActiveProject();
    const listEl = document.getElementById('team-list');
    if (!listEl || !project) return;
    listEl.innerHTML = '';
    const team = liveTeam(project);
    const admins = team.filter((m) => m.admin).length;

    team.forEach((m) => {
      const li = document.createElement('li');

      const swatch = document.createElement('button');
      swatch.className = `team-swatch team-swatch--${m.style === 'orange' ? 'orange' : 'sky'}`;
      swatch.title = 'Change the colour of this button on the login screen';
      swatch.setAttribute('aria-label', 'Change colour');
      swatch.addEventListener('click', () => {
        m.style = m.style === 'orange' ? 'sky' : 'orange';
        stampMember(m);
        afterTeamChange();
      });

      const name = document.createElement('input');
      name.type = 'text';
      name.value = m.name;
      name.className = 'team-name';
      name.addEventListener('change', () => {
        const v = name.value.trim();
        if (!v) { name.value = m.name; return; }
        if (team.some((o) => o !== m && o.name.toLowerCase() === v.toLowerCase())) {
          name.value = m.name;
          teamError(`${v} is already on the list.`);
          return;
        }
        teamError('');
        const previous = m.name;
        m.name = v;
        stampMember(m);
        // whoever is signed in under the old name keeps working under the new one
        if (user && user.name === previous) { user.name = v; saveUser(); }
        afterTeamChange();
      });

      const adminLbl = document.createElement('label');
      adminLbl.className = 'team-admin-toggle';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!m.admin;
      cb.addEventListener('change', () => {
        // the last admin must stay one, otherwise nobody can ever edit again
        if (!cb.checked && admins <= 1) {
          cb.checked = true;
          teamError('Keep at least one admin — otherwise nobody could edit the app any more.');
          return;
        }
        teamError('');
        m.admin = cb.checked;
        stampMember(m);
        afterTeamChange();
      });
      adminLbl.append(cb, document.createTextNode(' Admin'));

      const del = document.createElement('button');
      del.className = 'btn btn-ghost btn-danger';
      del.textContent = '✕';
      del.title = `Remove ${m.name} from the login screen`;
      del.addEventListener('click', () => {
        if (user && user.name === m.name) {
          teamError('You are signed in as this person — ask another admin to remove you.');
          return;
        }
        if (m.admin && admins <= 1) {
          teamError('This is the last admin. Make someone else an admin first.');
          return;
        }
        if (!window.confirm(`Remove ${m.name} from the login screen?`)) return;
        teamError('');
        // tombstone, not a hard delete: a plain removal comes straight back
        // from the other devices at the next sync
        m.deleted = true;
        m.deletedAt = new Date().toISOString();
        stampMember(m);
        logActivity('crew', `${m.name} removed from the crew`);
        afterTeamChange();
      });

      li.append(swatch, name, adminLbl, del);
      listEl.appendChild(li);
    });
  }

  function addTeamMember() {
    const project = getActiveProject();
    if (!project || !isAdmin()) return;
    const input = document.getElementById('team-new-name');
    const adminCb = document.getElementById('team-new-admin');
    const v = input.value.trim();
    if (!v) { teamError('Type a name first.'); return; }
    if (liveTeam(project).some((m) => m.name.toLowerCase() === v.toLowerCase())) {
      teamError(`${v} is already on the list.`);
      return;
    }
    teamError('');
    project.team.push({
      id: uid(),
      name: v,
      admin: !!adminCb.checked,
      style: 'sky',
      updatedAt: new Date().toISOString(),
    });
    logActivity('crew', `${v} added to the crew${adminCb.checked ? ' as an admin' : ''}`);
    input.value = '';
    adminCb.checked = false;
    afterTeamChange();
    input.focus();
  }

  function openSuggest() {
    document.getElementById('suggest-input').value = '';
    document.getElementById('suggest-result').textContent = '';
    renderSuggestions();
    document.getElementById('suggest-modal').classList.remove('hidden');
    document.getElementById('suggest-input').focus();
  }

  function renderSuggestions() {
    const project = getActiveProject();
    const list = project ? (project.suggestions || []).filter((s) => !s.deleted) : [];
    const countEl = document.getElementById('suggest-count');
    if (countEl) countEl.textContent = String(list.length);
    const ul = document.getElementById('suggest-list');
    if (!ul) return;
    ul.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'suggest-empty';
      li.textContent = 'No suggestions yet.';
      ul.appendChild(li);
      return;
    }
    // newest first for readers
    [...list].reverse().forEach((s) => {
      const li = document.createElement('li');
      li.className = 'suggest-item';
      const when = s.at ? new Date(s.at).toLocaleDateString() : '';
      li.innerHTML = `<span class="suggest-text">${escapeHtml(s.text)}</span>` +
        (when ? `<span class="suggest-date">${escapeHtml(when)}</span>` : '') +
        (isAdmin() ? `<button class="btn btn-ghost btn-danger suggest-del" title="Delete">${iconMarkup('trash', 'ico ico--sm')}</button>` : '');
      if (isAdmin()) {
        li.querySelector('.suggest-del').addEventListener('click', () => {
          // tombstone for the same reason as map notes: a hard delete would
          // be undone by the next sync pull
          s.deleted = true;
          s.deletedAt = new Date().toISOString();
          touchAndSave();
          renderSuggestions();
        });
      }
      ul.appendChild(li);
    });
  }

  function submitSuggestion() {
    const project = getActiveProject();
    if (!project) return;
    const input = document.getElementById('suggest-input');
    const text = (input.value || '').trim();
    const resultEl = document.getElementById('suggest-result');
    if (!text) {
      resultEl.textContent = 'Please write something first.';
      return;
    }
    project.suggestions = project.suggestions || [];
    project.suggestions.push({ id: uid(), text, at: new Date().toISOString() });
    touchAndSave();
    input.value = '';
    resultEl.textContent = '✓ Thank you! Your anonymous suggestion has been sent.';
    showToast('Suggestion sent anonymously.');
    renderSuggestions();
  }

  function normalizeName(s) {
    return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // ---------- drawers (mobile) ----------
  function closeDrawers() {
    document.getElementById('panel-left').classList.remove('open');
    document.getElementById('panel-right').classList.remove('open');
    document.getElementById('drawer-backdrop').classList.remove('visible');
  }

  function toggleDrawer(side) {
    const el = document.getElementById(`panel-${side}`);
    const isOpen = el.classList.contains('open');
    closeDrawers();
    if (!isOpen) {
      el.classList.add('open');
      document.getElementById('drawer-backdrop').classList.add('visible');
    }
  }

  // ---------- static listeners ----------
  function attachStaticListeners() {
    // login
    document.getElementById('login-visitor').addEventListener('click', () => loginAs('Visitor', 'visitor'));
    document.getElementById('login-cancel').addEventListener('click', () => {
      pendingLoginName = null;
      document.getElementById('login-password').classList.add('hidden');
    });
    document.getElementById('login-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = document.getElementById('login-password-input').value.trim();
      const errEl = document.getElementById('login-error');
      const form = e.currentTarget;
      if (!pendingLoginName) return;

      // Legacy behaviour when no team account is configured: the password is
      // compared here, in code everyone can read.
      if (!authConfigured()) {
        if (value.toUpperCase() === PASSWORD) loginAs(pendingLoginName, 'tech');
        else errEl.classList.remove('hidden');
        return;
      }

      errEl.classList.add('hidden');
      form.classList.add('checking');
      const result = await signInTeam(value);
      form.classList.remove('checking');

      if (result === 'ok') { loginAs(pendingLoginName, 'tech'); return; }
      if (result === 'wrong-password') {
        errEl.textContent = 'Wrong password.';
        errEl.classList.remove('hidden');
        return;
      }
      // Offline. Never strand the crew at sea: a device that has signed in
      // before keeps working locally and syncs once the connection is back.
      if (deviceTrusted()) {
        loginAs(pendingLoginName, 'tech');
        showToast('No connection — working offline, will sync later.');
        return;
      }
      errEl.textContent = 'No connection, and this device has never signed in. Connect once to unlock it, or continue as Visitor.';
      errEl.classList.remove('hidden');
    });
    document.getElementById('btn-logout').addEventListener('click', logout);

    document.getElementById('btn-admin-toggle').addEventListener('click', () => {
      if (!isAdminName()) return;
      user.admin = !user.admin;
      saveUser();
      render();
    });

    document.getElementById('project-select').addEventListener('change', (e) => {
      state.activeProjectId = e.target.value;
      pendingConnectFrom = null;
      saveState();
      render();
      safeFitToContent();
      startSync();
    });

    document.getElementById('btn-new-project').addEventListener('click', () => {
      if (!isAdmin()) return;
      const name = prompt('New project name', 'New project');
      if (name === null) return;
      const project = createEmptyProject(name.trim() || 'New project');
      project.reportTypes = defaultReportTypes();
      state.projects[project.id] = project;
      state.activeProjectId = project.id;
      saveState();
      render();
      safeFitToContent();
    });

    document.getElementById('btn-rename-project').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project) return;
      const name = prompt('Rename project', project.name);
      if (name === null) return;
      project.name = name.trim() || project.name;
      touchAndSave();
      render();
      startSync(); // the sync path follows the project name
    });

    document.getElementById('btn-delete-project').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project) return;
      if (Object.keys(state.projects).length <= 1) {
        alert('Cannot delete the last project.');
        return;
      }
      if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
      delete state.projects[project.id];
      state.activeProjectId = Object.keys(state.projects)[0];
      saveState();
      render();
      safeFitToContent();
    });

    document.getElementById('btn-add-category').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project) return;
      const group = nextTaskGroup(project);
      if (!group) { showToast(`The map holds ${taskCapacity()} tasks and they are all taken.`); return; }
      const name = prompt('Task name', 'New task');
      if (name === null) return;
      const label = name.trim() || 'Task';
      if (group === 'categories') {
        const cat = { id: uid(), name: label, color: microPaletteColor(project.categories.length * 2), updatedAt: new Date().toISOString() };
        project.categories.push(cat);
        project.nodes.forEach((n) => { n.status[cat.id] = null; });
      } else {
        const mv = { id: uid(), name: label, color: microPaletteColor(project.microVars.length), updatedAt: new Date().toISOString() };
        project.microVars.push(mv);
        project.nodes.forEach((n) => { n.micro[mv.id] = null; });
      }
      logActivity('task-added', label);
      touchAndSave();
      render();
    });

    document.getElementById('btn-add-node').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      if (!project) return;
      const world = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
      const node = {
        id: uid(),
        label: `P${project.nodes.length + 1}`,
        x: world.x,
        y: world.y,
        status: {},
        micro: {},
        taskComments: {},
        reports: {},
        issue: false,
        note: '',
      };
      project.categories.forEach((cat) => { node.status[cat.id] = null; });
      project.microVars.forEach((mv) => { node.micro[mv.id] = null; });
      project.nodes.push(node);
      touchAndSave();
      render();
    });

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        // leaving the map while drawing a string would strand a half-made one
        if (newString) cancelNewString();
        setMode(btn.dataset.mode);
      });
    });

    document.getElementById('btn-theme').addEventListener('click', cycleTheme);
    document.getElementById('btn-add-string').addEventListener('click', startNewString);
    document.getElementById('btn-reset-site').addEventListener('click', resetAllFoundations);
    document.getElementById('ptw-form').addEventListener('submit', (e) => {
      e.preventDefault();
      addPermit();
    });
    document.getElementById('new-string-done').addEventListener('click', finishNewString);
    document.getElementById('new-string-cancel').addEventListener('click', cancelNewString);
    document.getElementById('new-string-undo').addEventListener('click', () => {
      if (!newString || !newString.picks.length) return;
      newString.picks.pop();
      updateNewStringBar();
      renderCanvas();
    });

    document.getElementById('btn-drawer-left').addEventListener('click', () => toggleDrawer('left'));
    document.getElementById('btn-drawer-right').addEventListener('click', () => toggleDrawer('right'));
    document.getElementById('drawer-backdrop').addEventListener('click', closeDrawers);

    document.getElementById('punch-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!canEdit()) return;
      const project = getActiveProject();
      if (!project) return;
      const input = document.getElementById('punch-input');
      const text = input.value.trim();
      if (!text) return;
      project.punchList.unshift({ id: uid(), text, done: false, by: user.name, at: new Date().toISOString() });
      input.value = '';
      touchAndSave();
      renderPunchList();
    });

    document.getElementById('modal-close').addEventListener('click', closeModalAndRender);
    document.getElementById('modal-save').addEventListener('click', closeModalAndRender);

    document.getElementById('modal-label').addEventListener('input', (e) => {
      if (!isAdmin()) return;
      const node = currentModalNode();
      if (!node) return;
      node.label = e.target.value;
      touchAndSave();
    });

    document.getElementById('modal-issue').addEventListener('change', (e) => {
      if (!canEdit()) { e.target.checked = !e.target.checked; return; }
      const node = currentModalNode();
      if (!node) return;
      node.issue = e.target.checked;
      touchAndSave();
    });

    document.getElementById('modal-note').addEventListener('input', (e) => {
      if (!canEdit()) return;
      const node = currentModalNode();
      if (!node) return;
      node.note = e.target.value;
      touchAndSave();
    });

    document.getElementById('modal-recap').addEventListener('click', () => {
      const node = currentModalNode();
      if (node) copyRecap([node]);
    });

    document.getElementById('modal-add-punch').addEventListener('click', () => {
      if (!canEdit()) return;
      const node = currentModalNode();
      const project = getActiveProject();
      if (!node || !project) return;
      const value = prompt('Punch list entry', `${node.label} — `);
      if (value === null) return;
      project.punchList.unshift({ id: uid(), text: value, done: false, by: user.name, at: new Date().toISOString() });
      touchAndSave();
      renderPunchList();
    });

    document.getElementById('modal-delete').addEventListener('click', () => {
      if (!isAdmin() || !openNodeId) return;
      if (!confirm('Delete this point and its cables?')) return;
      const idToDelete = openNodeId;
      document.getElementById('node-modal').classList.add('hidden');
      openNodeId = null;
      deleteNode(idToDelete);
    });

    document.getElementById('btn-recap-all').addEventListener('click', () => {
      const project = getActiveProject();
      if (project) copyRecap(project.nodes);
    });

    document.getElementById('btn-export-csv').addEventListener('click', exportCsv);

    // add map text annotation (editor)
    document.getElementById('btn-add-text').addEventListener('click', () => {
      if (!canEdit()) return;
      placingText = !placingText;
      svgEl.classList.toggle('placing', placingText);
      document.getElementById('btn-add-text').classList.toggle('active', placingText);
      if (placingText) showToast('Tap the map where you want the note.');
    });
    document.getElementById('text-save').addEventListener('click', saveTextEditor);
    document.getElementById('text-cancel').addEventListener('click', closeTextEditor);
    document.getElementById('text-delete').addEventListener('click', deleteTextEditor);

    // day planner
    document.getElementById('btn-dayplan').addEventListener('click', openDayPlan);
    document.getElementById('dayplan-close').addEventListener('click', () => {
      document.getElementById('dayplan-modal').classList.add('hidden');
    });
    document.getElementById('dayplan-clear').addEventListener('click', () => {
      saveDayPlan({});
      renderDayPlan();
    });

    // add report type (admin)
    document.getElementById('btn-add-report').addEventListener('click', () => {
      if (!isAdmin()) return;
      const project = getActiveProject();
      const name = prompt('New inspection / report name', '');
      if (name === null || !name.trim()) return;
      project.reportTypes.push({ id: uid(), name: name.trim(), updatedAt: new Date().toISOString() });
      touchAndSave();
      render();
    });

    // anonymous suggestions box (open to everyone; list is admin-only via CSS)
    document.getElementById('btn-suggest').addEventListener('click', openSuggest);
    document.getElementById('suggest-close').addEventListener('click', () => {
      document.getElementById('suggest-modal').classList.add('hidden');
    });
    document.getElementById('suggest-send').addEventListener('click', submitSuggestion);

    // crew list (admin only)
    document.getElementById('btn-log').addEventListener('click', () => {
      renderLog();
      document.getElementById('log-modal').classList.remove('hidden');
    });
    document.getElementById('log-close').addEventListener('click', () => {
      document.getElementById('log-modal').classList.add('hidden');
    });
    document.getElementById('log-copy').addEventListener('click', () => {
      copyText(logAsText());
      showToast('Log copied.');
    });

    document.getElementById('btn-team').addEventListener('click', () => {
      teamError('');
      document.getElementById('team-new-name').value = '';
      document.getElementById('team-new-admin').checked = false;
      renderTeam();
      document.getElementById('team-modal').classList.remove('hidden');
    });
    document.getElementById('team-close').addEventListener('click', () => {
      document.getElementById('team-modal').classList.add('hidden');
    });
    document.getElementById('team-add').addEventListener('click', addTeamMember);
    document.getElementById('team-new-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addTeamMember(); }
    });

    document.getElementById('btn-publish-cables').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project || !isAdmin()) return;
      const n = (project.connections || []).length;
      if (!confirm(`Send this device's cable layout (${n} cables) to every other device, replacing what they show?`)) return;
      touchCables();
      logActivity('string', `Cable layout published from this device (${n} cables)`);
      touchAndSave();
      showToast('Cable layout published — the other devices will follow on their next sync.');
    });

    document.getElementById('cable-string').addEventListener('change', (e) => {
      if (!editingConnId) return;
      const v = e.target.value;
      setConnectionString(editingConnId, v === '' ? null : Number(v));
      openCableModal(editingConnId); // refresh the SRCC note under the picker
    });
    document.getElementById('cable-delete').addEventListener('click', () => {
      if (!editingConnId) return;
      const project = getActiveProject();
      const conn = project.connections.find((c) => c.id === editingConnId);
      if (conn && !confirm(`Delete the cable ${cableName(project, conn)}?`)) return;
      deleteConnection(editingConnId);
      closeCableModal();
    });
    document.getElementById('cable-done').addEventListener('click', closeCableModal);
    document.getElementById('cable-close').addEventListener('click', closeCableModal);

    document.getElementById('proc-close').addEventListener('click', () => {
      document.getElementById('proc-modal').classList.add('hidden');
    });
    document.getElementById('proc-lang').addEventListener('click', () => {
      procLang = procLang === 'en' ? 'fr' : 'en';
      renderProcedures();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) return;
      // human-readable export: a legend (id → name) + a readme are added on
      // top of the raw project so the JSON can be read/edited by hand or by a
      // future version of the app. Extra keys are ignored on import.
      const legend = {};
      project.categories.concat(project.microVars).forEach((c) => { legend[c.id] = c.name; });
      const reportLegend = {};
      project.reportTypes.forEach((r) => { reportLegend[r.id] = r.name; });
      const readable = {
        _readme: 'Op BOP tre FOU project export. Tasks are referenced by id inside nodes.status / nodes.micro / nodes.reports; use _legend and _reportLegend below to read the ids. Each task value is null (not done) or {at,by,partial?}. Re-import this file to merge it back (most recent state per task wins).',
        _exportedAt: new Date().toISOString(),
        _legend: legend,
        _reportLegend: reportLegend,
        ...project,
      };
      const blob = new Blob([JSON.stringify(readable, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateTag = new Date().toISOString().slice(0, 10);
      a.download = `${project.name.replace(/[^a-z0-9]+/gi, '_')}_${dateTag}.json`;
      a.click();
      URL.revokeObjectURL(url);
      markExported();
      showToast('Project exported — share the file to sync another phone.');
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      if (!canEdit()) return;
      document.getElementById('file-import').click();
    });

    document.getElementById('file-import').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!imported || !Array.isArray(imported.categories) || !Array.isArray(imported.nodes)) {
            throw new Error('invalid project format');
          }
          normalizeProject(imported);
          const targetProject = Object.values(state.projects).find((p) => p.name === imported.name);
          if (targetProject && confirm(
            `A project named "${imported.name}" already exists.\n\n`
            + 'OK = MERGE the imported data into it (most recent state per task wins, nothing is deleted).\n'
            + 'Cancel = keep it as a separate copy.',
          )) {
            mergeProjects(targetProject, imported);
            state.activeProjectId = targetProject.id;
            touchAndSave();
            render();
            safeFitToContent();
            showToast('Merged — most recent state kept for every task.');
          } else {
            imported.id = uid();
            if (targetProject) imported.name = `${imported.name} (imported)`;
            imported.updatedAt = new Date().toISOString();
            state.projects[imported.id] = imported;
            state.activeProjectId = imported.id;
            saveState();
            render();
            safeFitToContent();
          }
        } catch (err) {
          alert(`Invalid file: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Tapping the dimmed area around a window closes it — the gesture everyone
    // tries first on a phone, and the same result as Escape. The foundation
    // card is deliberately left out: you work in it for minutes at a time and a
    // stray tap next to a checkbox must not throw you out of it.
    OVERLAY_IDS.forEach((id) => {
      const overlay = document.getElementById(id);
      if (!overlay) return;
      overlay.addEventListener('click', (e) => {
        if (e.target !== overlay) return; // a tap inside the card, not on the dim
        closeOverlay(id);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openOverlay = OVERLAY_IDS.find((id) => !document.getElementById(id).classList.contains('hidden'));
      if (openOverlay) {
        closeOverlay(openOverlay);
      } else if (!document.getElementById('node-modal').classList.contains('hidden')) {
        closeModalAndRender();
      } else if (placingText) {
        placingText = false;
        svgEl.classList.remove('placing');
        document.getElementById('btn-add-text').classList.remove('active');
      } else if (document.getElementById('panel-left').classList.contains('open')
        || document.getElementById('panel-right').classList.contains('open')) {
        closeDrawers();
      } else if (pendingConnectFrom) {
        pendingConnectFrom = null;
        renderCanvas();
      }
    });
  }

  // Every secondary window. The foundation card is not one of them on purpose
  // (see the backdrop handler).
  const OVERLAY_IDS = ['text-modal', 'cable-modal', 'dayplan-modal', 'proc-modal', 'team-modal', 'suggest-modal', 'log-modal'];

  function closeOverlay(id) {
    if (id === 'text-modal') closeTextEditor();
    else if (id === 'cable-modal') closeCableModal();
    else document.getElementById(id).classList.add('hidden');
  }

  function updateCanvasHint() {
    const hints = {
      select: 'Tap a slice or ring cell to check it. Centre = details. Drag to navigate.',
      connect: 'Tap a first point then a second one to add a cable.',
      delete: 'Tap a point or a cable to delete it.',
      bend: 'Tap a cable to bend it around an obstacle. Drag an elbow to move it, tap it to remove it.',
      newstring: 'Tap the foundations in cable order. Tap the last one again to undo it.',
    };
    // Nothing at all in normal use: the hint used to occupy a full band across
    // the top of the map to explain a screen you already understand. It earns
    // its line only while a drawing tool is selected.
    let text = mode === 'select' ? '' : (hints[mode] || '');
    if (mode === 'connect') text += ' It joins their string on its own when they share one.';
    document.getElementById('canvas-hint').textContent = text;
  }

  // ---------- init ----------
  function init() {
    state = loadState();
    saveState();
    dailySnapshot();
    loadAuth();
    user = loadUser();
    svgEl = document.getElementById('canvas');
    loadTheme();
    renderLogin();
    attachStaticListeners();
    setupCameraGestures();
    updateCanvasHint();
    applyPermissionClasses();
    render();
    safeFitToContent();
    startSync();
    if (!user) showLogin();
    else maybeRemindBackup();
  }

  init();
})();
