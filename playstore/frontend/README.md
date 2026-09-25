# Storefront — frontend

A React + Vite (plain JavaScript, no TypeScript) client for the `playstore`
backend, built in the **Midnight Atelier** visual language: an editorial,
cinematic, dark-first UI — not a Material/Play-Store-style layout.

## Getting started

```bash
npm install
npm run dev
```

This expects the backend to be running via Docker Compose on
`http://localhost:9000` (compose.yaml maps host 9000 -> container 4000) --
that's the current `target` in `vite.config.js`. Requests under `/v1` are
proxied there automatically. If you instead run the backend bare
(`npm run dev` in `backend/`, port 4000), change that one line in
`vite.config.js`.

The backend now has CORS configured (see `backend/server.js` and
`CORS_ORIGIN` in `backend/.env`), so the proxy isn't strictly required
anymore -- but it's one less moving part, so it stays on by default.

## Known backend gaps this app was built around

- **No CORS** — solved locally via the Vite proxy above; a production
  deploy needs the backend to add `cors` for this app's real origin.
- **GET-with-body** — `/v1/app/id`, `/v1/app/download`, `/v1/images/`,
  `/v1/images/appImage` read params from a JSON body on a GET request.
  Handled once, centrally, in `src/lib/api/client.js` (`getWithBody`).
- **No admin signup path** — there is currently no way to create an admin
  account through the API. The `/admin` screens are fully built, but you
  need an admin JWT (e.g. via a manual DB update) to actually open them.
- **Ownership on app edit/delete** — the backend now enforces this
  server-side; the UI also hides Edit/Delete for non-owners as a courtesy
  (see `AppDetail.jsx`).

## Project layout

See the comments at the top of `src/app/routes.jsx`, `src/lib/api/client.js`
and `src/store/authStore.js` for the shape of the app; every non-trivial
file has a comment block explaining *why*, not just *what*.

```
src/
  app/            routing, layouts, auth/admin route guards
  components/ui/  the design-system primitives (Button, GlassPanel, …)
  components/cards/  content-card shapes (FeatureBlock, ImageCard, …)
  features/       one folder per domain: auth, apps, categories, admin
  lib/            typed-ish API client + hooks shared across features
  store/          the one piece of client-only state: the auth session
  styles/         design tokens + global resets
```

## Design system

All color / type / spacing / radius / motion tokens live in
`src/styles/tokens.css`. Nothing else in the app should hardcode a hex
value or a magic pixel size — reach for a token instead.
