// The accent-pair palette (tile background / icon foreground) cycled across
// app icons and category tiles, per the hommer visual system. Colors are the
// CSS custom properties defined in index.css, referenced here by var() so a
// palette edit only ever happens in one place.
const PAIRS = [
  ["var(--cobalt)", "var(--cream)"],
  ["var(--mint)", "var(--olive)"],
  ["var(--pink)", "var(--magenta)"],
  ["var(--yellow)", "var(--olive)"],
  ["var(--plum)", "var(--pink)"],
  ["var(--pink-hot)", "var(--cream)"],
  ["var(--olive)", "var(--yellow)"],
  ["var(--cream-deep)", "var(--cobalt)"],
];

// A small string hash (not cryptographic - just needs to be stable and
// evenly distributed enough to cycle through 8 accent pairs without an
// obvious pattern for adjacent ids).
export function hashString(value) {
  let hash = 0;
  const str = String(value ?? "");
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function accentFor(seed) {
  const [bg, fg] = PAIRS[hashString(seed) % PAIRS.length];
  return { background: bg, color: fg };
}
