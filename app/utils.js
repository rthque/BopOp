// Small, dependency-free helpers. Nothing here knows about the screen, so they
// can be used from anywhere — including from a test running in a terminal.

// Unique enough for a farm and a crew: random noise plus the clock, so two
// phones offline at the same second still produce different ids.
export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
