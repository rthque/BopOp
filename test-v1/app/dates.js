// Every decision in BopOp travels as a date, and the most recent one wins.
// These three lines are what makes that rule safe.

// A deletion is remembered for a month. Longer and the record grows for ever;
// shorter and a phone left in a drawer brings back what the crew removed.
export const TOMBSTONE_MS = 30 * 24 * 3600 * 1000;

// "Newer wins" only works if a new stamp really is newer. Phone clocks drift,
// and a stamp that arrived from a device running ten minutes fast would sit in
// the future: every later edit here would look older and be thrown away. So a
// stamp is always at least one millisecond past whatever it replaces.
export function stampAfter(previous) {
  const prev = new Date(previous || 0).getTime();
  const now = Date.now();
  return new Date(Number.isFinite(prev) && prev >= now ? prev + 1 : now).toISOString();
}

// Clearing the farm is a date, not an absence: anything stamped before it stops
// being data, on every device. Work done after it is untouched.
export const survives = (stamp, cutoff) => !cutoff
  || new Date(stamp || 0).getTime() > cutoff;
