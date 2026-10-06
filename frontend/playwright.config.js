import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.js",
  // The backend rate-limits sign-in/signup to 5 requests/min per IP (see
  // backend/server.js). Most tests avoid that entirely by reusing the
  // shared storageState users global-setup creates, but the few that must
  // sign up their own throwaway account (auth.spec.js, account.spec.js)
  // would collide under real parallelism, so this suite runs serially.
  fullyParallel: false,
  workers: 1,
  // A handful of tests call signupViaApi, which retries with a real ~61s
  // wait if it gets rate-limited (see fixtures/auth.js). The default 30s
  // per-test timeout can't survive even one such wait, so give every test
  // enough room for one retry cycle rather than failing on a false negative.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
