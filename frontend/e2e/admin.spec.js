import { test, expect } from "./fixtures/auth";

// There is no signup flow that grants the admin role (see backend/CONTEXT.md) -
// an account only becomes admin by hand-editing its row in the database. So
// the positive "admin can see the dashboard" path can only run against an
// account you promoted yourself, provided via env vars; everything else here
// verifies the negative case with a fresh, always-available regular user.
const ADMIN_EMAIL = "sese@gmail.com";
const ADMIN_PASSWORD = "sesese";

test.describe("Admin access - regular user", () => {
  test("a non-admin is redirected away from /admin instead of seeing the dashboard", async ({ authedPage }) => {
    await authedPage.goto("/admin");
    await expect(authedPage).toHaveURL("/");
  });

  test("a non-admin never sees the Admin link in the nav", async ({ authedPage }) => {
    await expect(authedPage.getByRole("link", { name: /admin/i })).toHaveCount(0);
  });
});

test.describe("Admin access - admin user", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run admin-only checks");

  test("an admin sees the Admin nav link and can open the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.locator("form").getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/");

    await page.getByRole("link", { name: /admin/i }).click();
    await expect(page).toHaveURL("/admin");
  });

  test("an admin can reach the categories and exports pages", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.locator("form").getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/admin/categories");
    await expect(page).toHaveURL("/admin/categories");

    await page.goto("/admin/exports");
    await expect(page).toHaveURL("/admin/exports");
  });
});
