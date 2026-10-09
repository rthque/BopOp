// The farm itself, as it was built: which cable runs between which two
// foundations, which string it belongs to, and what equipment stands on each
// foundation. None of this is a preference and none of it is edited in the app.
// It changes when the sea does — and then it changes here, in one reviewed
// commit, not from a phone.
//
// Source: the reference string drawing (Siemens Gamesa / Éoliennes en mer
// Dieppe Le Tréport), transcribed on 2026-10-08 from the copy pinned in the
// briefing room. "Z01" on the drawing is the substation, "OSS" here.

// 8 inter-array strings, numbered as on the drawing (index 0 = STRING 1). Each
// segment names its two ends; the first one is always the end nearer the
// substation. Membership — all 62 foundations, each exactly once:
//   S1: K04 J04 J05 H05 G05 F05 E05 D05       a chain
//   S2: L04 M04 L05 M05 L06 M06 L07 M07       a comb: each L feeds its M
//   S3: K07 J07 H07 G07 F07 E07 D07           a chain, row 7
//   S4: K05 K06 J06 H06 G06 F06 E06 D06       a chain, row 6
//   S5: L03 M03 L02 M02 L01 M01 K01           a comb: each L feeds its M, then K01
//   S6: G04 E04 D04 C04 B04 A04 A03 A02       a chain to the A column
//   S7: H04 E03 E02 D03 C03 C02 B03 B02       branches at E03 and C03
//   S8: J01 H01 H02 G02 F02 G01 F01 E01       branches at H01
// Until 2026-10-08 the app drew S2 and S5 as single chains and joined G01 to
// G02 instead of H01 — read off an older, smaller map. The drawing is right.
export const STRING_GROUPS = [
  [['OSS', 'K04'], ['K04', 'J04'], ['J04', 'J05'], ['J05', 'H05'], ['H05', 'G05'], ['G05', 'F05'], ['F05', 'E05'], ['E05', 'D05']],
  [['OSS', 'L04'], ['L04', 'M04'], ['L04', 'L05'], ['L05', 'M05'], ['L05', 'L06'], ['L06', 'M06'], ['L06', 'L07'], ['L07', 'M07']],
  [['OSS', 'K07'], ['K07', 'J07'], ['J07', 'H07'], ['H07', 'G07'], ['G07', 'F07'], ['F07', 'E07'], ['E07', 'D07']],
  [['OSS', 'K05'], ['K05', 'K06'], ['K06', 'J06'], ['J06', 'H06'], ['H06', 'G06'], ['G06', 'F06'], ['F06', 'E06'], ['E06', 'D06']],
  [['OSS', 'L03'], ['L03', 'M03'], ['L03', 'L02'], ['L02', 'M02'], ['L02', 'L01'], ['L01', 'M01'], ['L01', 'K01']],
  [['OSS', 'G04'], ['G04', 'E04'], ['E04', 'D04'], ['D04', 'C04'], ['C04', 'B04'], ['B04', 'A04'], ['A04', 'A03'], ['A03', 'A02']],
  [['OSS', 'H04'], ['H04', 'E03'], ['E03', 'E02'], ['E03', 'D03'], ['D03', 'C03'], ['C03', 'C02'], ['C03', 'B03'], ['B03', 'B02']],
  [['OSS', 'J01'], ['J01', 'H01'], ['H01', 'H02'], ['H02', 'G02'], ['G02', 'F02'], ['H01', 'G01'], ['G01', 'F01'], ['F01', 'E01']],
];

// Where a cable does not run straight, its elbows, in map units and in order
// from the first end to the second. These are the detours of the drawing: S3
// leaves K07 eastward before turning down to the substation; S6 and S7 leave
// the substation side by side, turn west, S6 in the lane between J04 and H04
// and S7 one lane lower into H04; S7 kinks again on its way to E03.
//
// They follow the drawing's shape, not its exact pixels. On the paper a
// foundation is a small circle; in the app it is a dial nearly twice as large
// for the same spacing, so the drawing's straight runs would have passed under
// K04, J04 and H04. S6 and S7 therefore drop straight down past K04 first, and
// S6 takes one extra elbow to stay under J04's name and over H04. Checked by
// tests/strings-from-the-drawing.spec.js: no cable passes under a foundation it
// does not serve, crosses a foundation's name, or crosses another cable.
export const CABLE_BENDS = {
  'OSS|K07': [{ x: 288, y: -1005 }],
  'OSS|G04': [{ x: 712, y: -320 }, { x: 530, y: -215 }, { x: 200, y: -300 }],
  'OSS|H04': [{ x: 732, y: -292 }, { x: 566, y: -188 }],
  'H04|E03': [{ x: 77, y: 245 }],
};

// The date the drawing above was adopted. The layout no longer travels between
// phones — every device draws it from this file — but older devices, still
// running the version where it did, take the most recently dated layout they
// are offered. Dating it here hands them this one.
export const CABLES_DRAWN_AT = '2026-10-08T00:00:00.000Z';

// What stands on the foundations, in the drawing's own legend order.
export const EQUIPMENT_TYPES = [
  { id: '5g', en: '5G', fr: '5G' },
  { id: 'ais', en: 'AIS + VHF', fr: 'AIS + VHF' },
  { id: 'horn', en: '2 NM fog horn + visibility meter', fr: 'Corne de brume 2 NM + visibilimètre' },
  { id: 'birdcam', en: 'Bird camera & bat recorder', fr: 'Caméra oiseaux & enregistreur chauves-souris' },
  { id: 'searadar', en: 'Maritime radar', fr: 'Radar maritime' },
  { id: 'birdradar', en: 'Bird radar', fr: 'Radar oiseaux' },
  { id: 'cctv', en: 'Wind farm CCTV', fr: 'Vidéosurveillance du parc' },
  { id: '24sea', en: '24SEA sensors & gauges', fr: 'Capteurs et jauges 24SEA' },
];

// 34 of the 62 foundations carry something. The fog horns ring the edge of the
// farm, as navigation marks do; the radars and the AIS sit at the corners.
export const EQUIPMENT = {
  M07: ['ais', 'horn', 'birdcam', 'cctv'],
  L07: ['24sea'],
  M06: ['5g'],
  L05: ['cctv'],
  M04: ['horn'],
  M03: ['cctv'],
  L02: ['24sea'],
  M01: ['5g', 'horn', 'birdradar', 'cctv'],
  K01: ['horn'],
  K07: ['horn'],
  H07: ['horn'],
  G07: ['cctv'],
  F07: ['horn'],
  E07: ['5g'],
  D07: ['horn', 'searadar', 'cctv'],
  J06: ['cctv'],
  G06: ['24sea'],
  E06: ['cctv'],
  J04: ['cctv'],
  G05: ['cctv'],
  E05: ['24sea'],
  D05: ['cctv'],
  G04: ['birdcam'],
  D04: ['horn'],
  B04: ['cctv'],
  A04: ['horn'],
  A02: ['ais', 'horn', 'birdcam', 'cctv'],
  D03: ['cctv'],
  B03: ['24sea'],
  C02: ['horn'],
  J01: ['cctv'],
  H01: ['horn'],
  F02: ['cctv'],
  E01: ['5g', 'horn', '24sea'],
};
