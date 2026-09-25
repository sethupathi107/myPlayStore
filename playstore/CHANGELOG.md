# Playstore — session changelog

A record of everything done in this working session, grouped by theme rather
than strict chronological order. Both `frontend/` and `backend/` were touched.

## 1. Frontend rewrite

The existing frontend was rebuilt from scratch in plain, beginner-style React
(function components, `useState`/`useEffect`, no Redux/React Query/Zustand) —
a deliberate choice, not a limitation. Every page and component listed below
is new or fully rewritten:

- **Auth**: `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `AuthLayout`,
  `AuthContext` (JWT decode client-side, access/refresh token handling with
  automatic 401-retry-once in `api.js`).
- **Core app**: `Home` (Discover), `MyApps`, `CategoryApps`, `Search`,
  `AppDetail`, `AppForm` (create/edit), `Account`.
- **Admin**: `AdminLayout`, `AdminOverview` (stats + charts), `AdminLogs`,
  `AdminExports`, `AdminCategories` (new — see §5).
- **Shared components**: `Navbar`, `ProfileMenu`, `AppCard`, `AppIcon`,
  `Dropdown`, `RangePicker`, `PieChart`, `ConfirmDialog`, `ThemeToggle`,
  `Loading`/`LoadingMore`/`ErrorMessage`.
- **`api.js`**: one central axios wrapper covering every backend endpoint —
  auth, apps, categories, images, admin analytics/logs/exports.

## 2. Pagination → infinite scroll

- Backend: `GET /v1/app/` was unbounded (returned every app in one response).
  Added `page`/`limit` pagination, then later `categoryId`/`mine`/`excludeId`
  filters for category pages, "my apps", and "similar apps".
- Frontend: started with Prev/Next pagination, then replaced entirely with
  infinite scroll (`useInfiniteApps` hook, `IntersectionObserver`-based),
  per your later request. Batch size tuned to 50–100 apps/load with a
  guaranteed 1.5s minimum "loading more" spinner so the load doesn't feel
  instant/jarring.

## 3. Hot apps feature

- Backend: `GET /v1/app/hot` (most-downloaded overall) and
  `GET /v1/app/hot-by-category` (top N per category, via a windowed SQL
  query), both Redis-cached.
- Frontend: Discover page rebuilt around this — a "🔥 Hot apps" tile grid at
  the top, then one boxed, icon-grid section per category (each with a
  "See all" link into the full category page). Category order is shuffled
  client-side on every load so the page doesn't look identical every visit.

## 4. Design pass

- Installed Anthropic's official `frontend-design` skill and used it to
  self-critique and revise the first pass (which had drifted into generic
  "AI-app" tells: uniform card shadows everywhere, ALL-CAPS labels, middle-dot
  metadata, hover-only interactions, stock blue). Revised palette, type
  (Fraunces for display headings + Inter for everything else), and removed
  the generic patterns.
- **Glassmorphism + dark/light theme system**, added per your request:
  - Two elevation levels (`--color-surface`, `--color-surface-2`) used
    consistently for navbar, cards, forms, dropdowns.
  - Light mode: cool gray canvas, more-opaque white cards (Stripe/Linear
    style) — elevation reads via presence + shadow, not raw brightness.
  - Dark mode: the literal Material Design dark-theme model — higher
    elevation mixes in more white the higher it sits, since there's no light
    source to cast a shadow on black.
  - A soft, fixed, blurred wash of the app's own indigo/warm accent colors
    behind every page, so the frosted/translucent panels have something to
    visibly blur — without it, "glass" is indistinguishable from a flat tint.
  - A sun/moon toggle in the navbar (`ThemeToggle` + `useTheme` hook); the
    default on first visit reads the OS `prefers-color-scheme`, and a manual
    choice is persisted to `localStorage` and wins from then on.

## 5. Wireframe-driven features

Built directly from a hand-drawn wireframe and reference screenshots you
provided:
- Category browse pages, "My apps" page, `ProfileMenu` dropdown (role-aware —
  admins don't see "My apps"/"Upload app", since that's not their job).
- **Admin → Categories** page: add a new category by name + a table of all
  existing categories. No backend changes needed — `POST /v1/category/`
  already allowed any authenticated user.
- Removed the redundant inline "add category" mini-form from the app upload
  page now that admin has a dedicated place for it.

## 6. Accessibility pass

Installed the `AccessLint` plugin (WCAG 2.2 audit/fix skills) and used it to
find and fix real issues:
- Auth pages (`AuthLayout`) had no `<main>` landmark.
- Inline links ("Sign up", "Forgot your password?", etc.) relied on color
  alone to read as links (WCAG 1.4.1) — later explicitly reverted per your
  preference (you didn't want the underline styling), so this is now a
  known, deliberate trade-off rather than an oversight.
- A native `<select>`'s dropdown popup is browser-drawn and ignores most
  styling — fixed the option list to force readable dark-on-white text
  regardless of the app's own theme.

## 7. Real bugs found and fixed

- **GET-with-body**: several endpoints read filters from `req.body` on GET
  requests — impossible from a real browser (fetch/XHR can't send a GET body).
  Fixed with a `queryToBody` middleware merging `req.query` into `req.body`.
- **Sequelize v7 `sequelize.models` is a `Set`**, not `{Name: Model}` like v6 —
  code destructuring it directly silently broke `afterDestroy` hooks on
  account/app deletion, crashing both. Fixed by building a lookup map.
- **CORS `methods` allowlist** was missing `PATCH`, which would have silently
  blocked the change-password endpoint from the browser.
- **`AppDetail` screenshot loading** used `Promise.all` — one missing/broken
  image file took down the whole page. Switched to `Promise.allSettled`.
- **Description field validation crash**: the `description` column was
  `VARCHAR(255)` with a model-level cap of 50 characters, while the frontend
  allowed up to 2000 — any longer description threw an uncaught
  `SequelizeValidationError` → raw 500. Fixed with a migration
  (`description` → `TEXT`), raised the validator to `len: [2, 2000]` (and
  `name` to `[2, 150]` to match its own frontend limit), and added a proper
  400-with-message handler for validation errors generally (defense in depth
  for any future mismatch). Verified live: a 500-char description now
  succeeds; over 2000 now returns a clean 400 instead of crashing.
- **Layout/CSS bugs**, all the same root cause (a flex item's default
  `min-width: auto` overriding an explicit `max-width` when content is long):
  the horizontally-scrolling category chip row pushing the whole page
  sideways and hiding the page title; Login and Signup rendering at two
  different card sizes (traced to the unstyled `<main>` landmark wrapper
  shrinking to fit each page's own content, not the auth card itself).
- **Admin pages missing spacing**: `AdminOverview`, `AdminLogs`, and
  `AdminExports` all rendered their sections flush against each other — they
  were wrapped in a bare `<div>` instead of the `.page` class every other
  page uses for its 20px section gap.
- **`.inline-form` on a `<form>` element** stacked its children vertically
  instead of side-by-side, because it never set `flex-direction`, so the
  generic `form { flex-direction: column }` rule won by default. Now fixed
  at the shared CSS level, not just patched per-instance.
- **Native `window.confirm()`** for delete actions (delete app, delete
  account) looked like a jarring unstyled browser popup. Replaced with a
  themed `ConfirmDialog` component (dim/blur backdrop, app's own card
  styling, Escape-to-cancel).
- **Hardcoded colors that ignored the theme**: the profile dropdown menu, the
  admin pie-chart's center value/label, the dropdown caret, and the pie-chart
  legend's hover highlight were all fixed hex/rgba values that looked wrong
  (or in one case, unreadable) once dark mode existed. All now derive from
  the theme's own CSS custom properties.

## 8. Bar chart (admin "Downloads over time")

Iterated a few times based on your feedback: bars now keep a fixed width
(don't stretch to fill the card) while the row uses `justify-content:
space-evenly` so leftover width becomes gutter space instead of empty
space to one side — for a short range (7 days) this fills the whole card
evenly; for a long range (30 days) there's no leftover space to distribute,
so it packs tight and the existing horizontal scroll takes over. Every bar
also now sits on a full-height "track" so a zero-download day reads as an
empty bar in a chart, not a stray floating dash, and the tallest bar stops
short of 100% height so there's always visible headroom above it.

## 9. Cleanup

- Removed dead CSS (`.btn-link`, an old hot-rail/category-chip block left
  over from earlier redesigns).
- Removed `backend/src/sequelize/models/App2.js` — a stray, entirely unused
  draft file (predates this session) that actually defined a `User` model,
  not an `App`, and was never imported anywhere.
- Confirmed via a full sweep (every CSS class checked against JSX usage,
  every JS import checked for use, every component file checked for being
  referenced somewhere) that nothing else in the frontend is dead code.

## Modularity check

Went through every frontend and backend file looking for anything that
would make a future change harder than it needs to be. Summary:

- **Frontend**: one component/page per file, `api.js` is the single place
  all HTTP calls live (no page talks to axios directly), shared logic is
  pulled into hooks (`useInfiniteApps`, `useTheme`) rather than copy-pasted.
  File sizes are all reasonable (under ~230 lines) except `index.css`
  (~1,435 lines) and `api.js` (~340 lines) — both large only because they're
  the single, intentional home for "all styles" and "all API calls"
  respectively (a deliberate beginner-style choice made earlier in this
  session, not an accident). If `index.css` ever gets hard to navigate, it's
  already organized into clearly commented sections (`/* --- navbar --- */`
  etc.) and could be split by page/component at that point without touching
  the design.
- **Backend**: controllers are one file per REST resource (`app.js`,
  `auth.js`, `category.js`, `image.js`, `admin.js`, `export.js`). `app.js`
  (577 lines) and `auth.js` (531 lines) are the biggest, but each is a single
  cohesive resource, not several unrelated things bolted together — no
  action taken, just noting where a future split (e.g. splitting
  hot/hot-by-category/search into their own file) would naturally go if
  either file keeps growing.
- One thing **not** done: `backend/CONTEXT.md` (the onboarding doc other
  Claude sessions are told to read first) describes an old, pre-Postgres
  version of this backend (flat JSON files, no admin-promotion path, etc.)
  and is now significantly out of date relative to the current
  Sequelize/Postgres/Redis/OpenSearch stack. Regenerating it is worth doing
  as its own task, since it's a bigger job than a quick edit — flagging it
  here rather than rewriting it silently.
