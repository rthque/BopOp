// The wiring of Dieppe Le Tréport, read off the reference site map. This is the
// farm itself, not a preference: it does not change unless the sea does.
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
export const STRING_GROUPS = [
  [['OSS', 'K04'], ['K04', 'J04'], ['J04', 'J05'], ['J05', 'H05'], ['H05', 'G05'], ['G05', 'F05'], ['F05', 'E05'], ['E05', 'D05']],
  [['OSS', 'L04'], ['L04', 'L05'], ['L05', 'L06'], ['L06', 'L07'], ['L07', 'M07'], ['M07', 'M06'], ['M06', 'M05'], ['M05', 'M04']],
  [['OSS', 'K07'], ['K07', 'J07'], ['J07', 'H07'], ['H07', 'G07'], ['G07', 'F07'], ['F07', 'E07'], ['E07', 'D07']],
  [['OSS', 'K05'], ['K05', 'K06'], ['K06', 'J06'], ['J06', 'H06'], ['H06', 'G06'], ['G06', 'F06'], ['F06', 'E06'], ['E06', 'D06']],
  [['OSS', 'L03'], ['L03', 'L02'], ['L02', 'L01'], ['L01', 'K01'], ['L01', 'M01'], ['M01', 'M02'], ['M02', 'M03']],
  [['OSS', 'G04'], ['G04', 'E04'], ['E04', 'D04'], ['D04', 'C04'], ['C04', 'B04'], ['B04', 'A04'], ['A04', 'A03'], ['A03', 'A02']],
  [['OSS', 'H04'], ['H04', 'E03'], ['E03', 'E02'], ['E03', 'D03'], ['D03', 'C03'], ['C03', 'C02'], ['C03', 'B03'], ['B03', 'B02']],
  [['OSS', 'J01'], ['J01', 'H01'], ['H01', 'H02'], ['H02', 'G02'], ['G02', 'F02'], ['G02', 'G01'], ['G01', 'F01'], ['F01', 'E01']],
];
