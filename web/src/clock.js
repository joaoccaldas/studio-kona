// One game clock: every "day" in Kona runs on Hawaiʻi time (HST, UTC−10, no daylight saving), wherever the player is.
// Daily check-in, streak, shells, the daily challenge seed, race-week openings and "next day" all use it,
// so a player in Lisbon and one in Kailua see the same day at the same moment.
const HST_MS = 10 * 3600e3;

export function hstDay(now = Date.now()) {
  return new Date(now - HST_MS).toISOString().slice(0, 10);
}
// The moment the next Hawaiʻi day begins (midnight HST = 10:00 UTC).
export function nextHstMidnight(now = Date.now()) {
  const d = new Date(now - HST_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) + HST_MS);
}
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);
}
