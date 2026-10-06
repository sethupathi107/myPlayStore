import { chromium, request as playwrightRequest } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_DIR = path.join(__dirname, ".auth");

async function signupWithRetry(api, user, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await api.post("/v1/sign/signup", { data: user });
    if (response.ok()) return response.json();

    if (response.status() === 429 && attempt < retries) {
      const body = await response.json().catch(() => ({}));
      const waitMs = ((body.retryAfter || 60) + 1) * 1000;
      console.log(`[global-setup] rate-limited signing up ${user.email}, waiting ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    throw new Error(`signup failed for ${user.email}: ${response.status()} ${await response.text()}`);
  }
  throw new Error(`signup never succeeded for ${user.email}`);
}

async function saveStorageState(browser, baseURL, user, tokens, filePath) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ([accessToken, refreshToken]) => {
      window.localStorage.setItem("accessToken", accessToken);
      window.localStorage.setItem("refreshToken", refreshToken);
    },
    [tokens.accessToken, tokens.refreshToken]
  );
  await context.storageState({ path: filePath });
  await context.close();
}

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL || "http://localhost:5173";
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const stamp = Date.now();
  const users = {
    shared: { name: "E2E Shared", email: `e2e-shared-${stamp}@example.com`, password: "Password123!" },
    viewer: { name: "E2E Viewer", email: `e2e-viewer-${stamp}@example.com`, password: "Password123!" },
  };

  const api = await playwrightRequest.newContext({ baseURL });
  const browser = await chromium.launch();

  for (const [key, user] of Object.entries(users)) {
    const tokens = await signupWithRetry(api, user);
    await saveStorageState(browser, baseURL, user, tokens, path.join(AUTH_DIR, `${key}.json`));
  }

  await browser.close();
  await api.dispose();

  fs.writeFileSync(path.join(AUTH_DIR, "users.json"), JSON.stringify(users, null, 2));
}
