const STAGGER_MS = 40;
const QUICK_STAGGER_MS = 25;
const MAX_STAGGER_MS = 700;

// Only the delay - the caller adds "reveal" to its own className string
// (never spread this over an existing className, it'll clobber it) and
// spreads/merges this into its own style. `quick: true` uses the faster
// 25ms stagger meant for filtered/re-ordered result rows rather than a
// full screen transition.
export function revealDelay(index = 0, { quick = false } = {}) {
  const step = quick ? QUICK_STAGGER_MS : STAGGER_MS;
  return { animationDelay: `${Math.min(MAX_STAGGER_MS, index * step)}ms` };
}
