import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_APK = path.join(__dirname, "fixtures", "files", "sample.apk");

async function publishApp(page, name) {
  await page.goto("/apps/new");
  const categorySelect = page.locator("#app-category");
  const optionCount = await categorySelect.locator("option").count();
  test.skip(optionCount < 2, "no categories seeded yet - run npm run seed:categories in backend/");

  await page.locator("#app-name").fill(name);
  await categorySelect.selectOption({ index: 1 });
  await page.locator("#app-description").fill("App created for a detail-page test.");
  await page.locator('input[type="file"][accept*="apk"]').setInputFiles(SAMPLE_APK);
  await page.getByRole("button", { name: /submit for review/i }).click();
  await expect(page.getByText(/it's live/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: /see my apps/i }).click();
  await page.getByText(name).click();
  await expect(page).toHaveURL(/\/apps\/[^/]+$/);
}

test.describe("App detail page", () => {
  test("installing an app flips the button to Open", async ({ authedPage }) => {
    await publishApp(authedPage, `Installable App ${Date.now()}`);

    // Scoped to the hero action row - the "Similar apps" section below also
    // renders its own install buttons for other apps on the same page.
    const heroActions = authedPage.locator(".app-detail-actions");
    await heroActions.getByRole("button", { name: /get/i }).click();
    await expect(heroActions.getByRole("button", { name: /open/i })).toBeVisible({ timeout: 15_000 });
  });

  test("a user can post a star rating and review", async ({ authedPage }) => {
    await publishApp(authedPage, `Reviewable App ${Date.now()}`);

    const reviewForm = authedPage.locator("form", { has: authedPage.getByPlaceholder(/what did you think/i) });
    const stars = reviewForm.locator('span[style*="cursor: pointer"]');
    await stars.nth(4).click(); // 5th star = a 5-star rating

    await authedPage.getByPlaceholder(/what did you think/i).fill("Solid little app, works great.");
    await authedPage.getByRole("button", { name: /post review/i }).click();

    await expect(authedPage.getByText("Solid little app, works great.")).toBeVisible();
  });

  test("visiting an app that does not exist shows an error instead of crashing", async ({ authedPage }) => {
    await authedPage.goto("/apps/00000000-0000-0000-0000-000000000000");
    await expect(authedPage.locator(".status-error").first()).toBeVisible();
  });
});
