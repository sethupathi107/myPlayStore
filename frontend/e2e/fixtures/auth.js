import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { AUTH_DIR } from "../global-setup";

// Generates a unique, valid signup payload so any test that must create
// its own fresh account never collides with another run's data.
export function uniqueUser(prefix = "e2e") {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    name: `E2E ${prefix}`,
    email: `${prefix}-${stamp}@example.com`,
    password: "Password123!",
  };
}

// Signs a user up through the real API, retrying with the backend's own
// requested delay if we hit its 5-requests/min sign-in/signup rate limit
// (see backend/server.js). Used only by the handful of tests that truly
// need an isolated account instead of the shared storageState users below.
export async function signupViaApi(request, baseURL, user, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await request.post(`${baseURL}/v1/sign/signup`, { data: user });
    if (response.ok()) return response.json();

    if (response.status() === 429 && attempt < retries) {
      const body = await response.json().catch(() => ({}));
      await new Promise((resolve) => setTimeout(resolve, ((body.retryAfter || 60) + 1) * 1000));
      continue;
    }

    throw new Error(`signup failed: ${response.status()} ${await response.text()}`);
  }
  throw new Error("signup never succeeded");
}

// Deliberately NOT page.addInitScript: that re-runs on every future
// navigation in this page, including ones after a test signs itself out
// (e.g. account deletion), silently reviving a session the test just
// asserted was gone. A one-time page.evaluate after an initial goto sets
// localStorage exactly once, like a real login would.
async function injectSession(page, tokens) {
  await page.goto("/");
  await page.evaluate(
    ([accessToken, refreshToken]) => {
      window.localStorage.setItem("accessToken", accessToken);
      window.localStorage.setItem("refreshToken", refreshToken);
    },
    [tokens.accessToken, tokens.refreshToken]
  );
}

export const test = base.extend({
  // A page already signed in as the shared read/write user created once in
  // global-setup.js. Use this for anything that just needs "someone logged
  // in" and doesn't rename, delete, or otherwise permanently mutate the
  // account - it's reused by every test in the run.
  authedPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ storageState: path.join(AUTH_DIR, "shared.json") });
    const page = await context.newPage();
    await page.goto("/");
    await use(page);
    await context.close();
  },

  // A second, distinct persistent account - for tests that need to prove
  // one user cannot manage another user's data.
  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: path.join(AUTH_DIR, "viewer.json") });
    const page = await context.newPage();
    await page.goto("/");
    await use(page);
    await context.close();
  },

  // The credentials behind the shared/viewer storageState users, in case a
  // test needs to know the email (e.g. asserting it's shown on screen).
  sharedUsers: async ({}, use) => {
    const raw = fs.readFileSync(path.join(AUTH_DIR, "users.json"), "utf-8");
    await use(JSON.parse(raw));
  },

  // A brand-new, throwaway user + an already-logged-in page for it. Only
  // use this for tests that mutate the account (password change, delete)
  // or otherwise can't share the common user - it costs a real signup
  // request against the backend's rate limiter.
  freshUser: async ({}, use) => {
    await use(uniqueUser("fresh"));
  },

  freshPage: async ({ page, request, baseURL, freshUser }, use) => {
    const tokens = await signupViaApi(request, baseURL, freshUser);
    await injectSession(page, tokens);
    await page.reload();
    await use(page);
  },
});

export { expect };
