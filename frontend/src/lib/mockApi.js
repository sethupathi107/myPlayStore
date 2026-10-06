// Stand-ins for backend endpoints that don't exist yet (reviews/ratings,
// per-app catalog fields like tagline/version/size, and account settings).
// Same async-function shape as api.js so a real endpoint can replace one of
// these later by changing the call site, not the caller's contract.
//
// Deterministic, not random: every mocked value is derived from the app's
// own id/name via a small string hash, so it's stable across reloads and
// re-renders instead of reshuffling every time a component mounts.
import { hashString } from "./accents";

const STORE_KEY = "hommer-mock-v1";

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(seed) {
  return mulberry32(hashString(seed));
}

const TAGLINE_WORDS = [
  "Simple, fast, and always on hand",
  "Everything you need, nothing you don't",
  "Built for the way you actually work",
  "Small footprint, big difference",
  "The tool you'll open every day",
  "Made for quick, focused sessions",
];
const DEV_NAMES = ["North Loop Labs", "Sable & Co", "Fieldstone Apps", "Basalt Software", "Harbor Nine Studio"];

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Deterministic catalog fields the real Application model doesn't store
// yet (tagline, version, size, developerName, whatsNew, rating/reviewCount).
// Real fields (name/description/category/icon) always pass through
// untouched from the caller.
export function withMockCatalogFields(app) {
  if (!app) return app;
  const rng = rngFor(app.id || app.name);
  const major = 1 + Math.floor(rng() * 4);
  const minor = Math.floor(rng() * 10);
  const patch = Math.floor(rng() * 10);
  const sizeMb = 8 + Math.floor(rng() * 180);
  const rating = Math.round((3.4 + rng() * 1.5) * 10) / 10;
  const reviewCount = 6 + Math.floor(rng() * 480);

  return {
    ...app,
    tagline: app.tagline || pick(rng, TAGLINE_WORDS),
    version: app.version || `${major}.${minor}.${patch}`,
    size: app.size || sizeMb * 1024 * 1024,
    developerName: app.developerName || pick(rng, DEV_NAMES),
    whatsNew: app.whatsNew || "Fixed a handful of small bugs and improved overall stability.",
    rating: app.rating ?? Math.min(5, rating),
    reviewCount: app.reviewCount ?? reviewCount,
  };
}

export function formatBytes(bytes) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

const SAMPLE_NAMES = ["Priya", "Arjun", "Wren", "Kavya", "Devon", "Ishaan", "Maya", "Noah"];
const SAMPLE_TEXTS = [
  "Does exactly what it says, no clutter.",
  "Solid app, been using it for weeks now.",
  "Great once you get past the setup.",
  "My go-to for this — recommend it.",
  "Works well, could use a few more options.",
  "Clean interface, quick to load every time.",
];

function seedReviews(appId) {
  const rng = rngFor(appId + ":seed");
  const count = 3;
  const reviews = [];
  for (let i = 0; i < count; i++) {
    reviews.push({
      id: `${appId}-seed-${i}`,
      appId,
      name: pick(rng, SAMPLE_NAMES),
      stars: 3 + Math.floor(rng() * 3),
      text: pick(rng, SAMPLE_TEXTS),
      createdAt: new Date(Date.now() - i * 86400000 * (2 + i)).toISOString(),
      seeded: true,
    });
  }
  return reviews;
}

function getAppReviews(appId) {
  const store = readStore();
  if (!store.reviews) store.reviews = {};
  if (!store.reviews[appId]) {
    store.reviews[appId] = seedReviews(appId);
    writeStore(store);
  }
  return store.reviews[appId];
}

// GET /v1/app/:id/reviews (mocked)
export function listReviews(appId) {
  return Promise.resolve([...getAppReviews(appId)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}

// GET /v1/app/:id/rating-summary (mocked)
export function ratingSummary(appId) {
  const reviews = getAppReviews(appId);
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const review of reviews) breakdown[review.stars] = (breakdown[review.stars] || 0) + 1;
  const total = reviews.reduce((sum, r) => sum + r.stars, 0);
  const average = reviews.length ? total / reviews.length : 0;
  return Promise.resolve({ average, count: reviews.length, breakdown });
}

// POST /v1/app/:id/reviews (mocked, one review per user per app - upserts)
export function submitReview(appId, { rating, text, name }) {
  const store = readStore();
  if (!store.reviews) store.reviews = {};
  if (!store.reviews[appId]) store.reviews[appId] = seedReviews(appId);

  const mine = { id: `${appId}-mine`, appId, name, stars: rating, text, createdAt: new Date().toISOString(), mine: true };
  store.reviews[appId] = [mine, ...store.reviews[appId].filter((r) => !r.mine)];
  writeStore(store);
  return Promise.resolve(mine);
}

export function hasWrittenReview(appId) {
  const store = readStore();
  return Boolean(store.reviews?.[appId]?.some((r) => r.mine));
}

export function countReviewsWritten() {
  const store = readStore();
  if (!store.reviews) return 0;
  return Object.values(store.reviews).filter((list) => list.some((r) => r.mine)).length;
}
