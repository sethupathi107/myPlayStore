import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_APK = path.join(__dirname, "fixtures", "files", "sample.apk");

test.describe("Publishing an app", () => {
  test("a user can publish a new app and see it under My apps", async ({ authedPage }) => {
    await authedPage.goto("/apps/new");

    const categorySelect = authedPage.locator("#app-category");
    const optionCount = await categorySelect.locator("option").count();
    test.skip(optionCount < 2, "no categories seeded yet - run npm run seed:categories in backend/");

    const appName = `E2E App ${Date.now()}`;
    await authedPage.locator("#app-name").fill(appName);
    await categorySelect.selectOption({ index: 1 });
    await authedPage.locator("#app-description").fill("Published by an automated Playwright test.");
    await authedPage.locator('input[type="file"][accept*="apk"]').setInputFiles(SAMPLE_APK);
    await authedPage.getByRole("button", { name: /submit for review/i }).click();

    await expect(authedPage.getByText(/it's live/i)).toBeVisible({ timeout: 15_000 });

    await authedPage.getByRole("link", { name: /see my apps/i }).click();
    await expect(authedPage).toHaveURL("/my-apps");
    await expect(authedPage.getByText(appName)).toBeVisible();
  });

  test("the browser blocks submission when a required field is left blank", async ({ authedPage }) => {
    await authedPage.goto("/apps/new");

    await authedPage.locator("#app-name").fill("Missing bits app");
    await authedPage.locator("#app-description").fill("This should not submit successfully.");
    await authedPage.getByRole("button", { name: /submit for review/i }).click();

    // Category is a required <select> with no file chosen either - native
    // HTML5 validation stops the submit before our own JS handler runs.
    await expect(authedPage).toHaveURL("/apps/new");
    const categoryValid = await authedPage.locator("#app-category").evaluate((el) => el.checkValidity());
    expect(categoryValid).toBe(false);
  });

  test("shows an error when every required field is filled but no file is chosen", async ({ authedPage }) => {
    await authedPage.goto("/apps/new");

    const categorySelect = authedPage.locator("#app-category");
    const optionCount = await categorySelect.locator("option").count();
    test.skip(optionCount < 2, "no categories seeded yet - run npm run seed:categories in backend/");

    await authedPage.locator("#app-name").fill("Missing file app");
    await categorySelect.selectOption({ index: 1 });
    await authedPage.locator("#app-description").fill("This should not submit successfully.");
    await authedPage.getByRole("button", { name: /submit for review/i }).click();

    await expect(authedPage).toHaveURL("/apps/new");
    await expect(authedPage.getByText(/drop an apk or aab to publish/i)).toBeVisible();
  });
});

test.describe("Managing an owned app", () => {
  async function publishApp(page, name) {
    await page.goto("/apps/new");
    const categorySelect = page.locator("#app-category");
    const optionCount = await categorySelect.locator("option").count();
    test.skip(optionCount < 2, "no categories seeded yet - run npm run seed:categories in backend/");

    await page.locator("#app-name").fill(name);
    await categorySelect.selectOption({ index: 1 });
    await page.locator("#app-description").fill("App created for an ownership test.");
    await page.locator('input[type="file"][accept*="apk"]').setInputFiles(SAMPLE_APK);
    await page.getByRole("button", { name: /submit for review/i }).click();
    await expect(page.getByText(/it's live/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /see my apps/i }).click();
    await page.getByText(name).click();
  }

  test("the owner sees Edit and Delete controls and can edit the app", async ({ authedPage }) => {
    const name = `Editable App ${Date.now()}`;
    await publishApp(authedPage, name);

    await authedPage.getByRole("link", { name: /^edit$/i }).click();
    await expect(authedPage).toHaveURL(/\/edit$/);

    const newDescription = "Updated description from an automated test.";
    await authedPage.locator("#app-description").fill(newDescription);
    await authedPage.getByRole("button", { name: /save changes/i }).click();

    await expect(authedPage.getByText(newDescription)).toBeVisible();
  });

  test("the owner can delete the app after confirming", async ({ authedPage }) => {
    const name = `Deletable App ${Date.now()}`;
    await publishApp(authedPage, name);

    await authedPage.getByRole("button", { name: /^delete$/i }).click();
    await authedPage.getByRole("alertdialog").getByRole("button", { name: /^delete$/i }).click();

    await expect(authedPage).toHaveURL("/");
  });

  test("another user cannot see Edit/Delete on someone else's app", async ({ authedPage, viewerPage }) => {
    const name = `Owned By Another ${Date.now()}`;
    await publishApp(authedPage, name);
    await expect(authedPage).toHaveURL(/\/apps\/[^/]+$/);
    const appUrl = authedPage.url();

    await viewerPage.goto(appUrl);
    await expect(viewerPage.getByRole("link", { name: /^edit$/i })).toHaveCount(0);
    await expect(viewerPage.getByRole("button", { name: /^delete$/i })).toHaveCount(0);
  });
});
