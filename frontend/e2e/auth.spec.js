import { test, expect, uniqueUser } from "./fixtures/auth";

test.describe("Signup", () => {
  test("a new user can create an account and lands on Discover", async ({ page }) => {
    const user = uniqueUser("signup");

    await page.goto("/signup");
    await page.getByLabel("Name").fill(user.name);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.locator("form").getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "hommer" })).toBeVisible();
  });

  test("rejects a duplicate email", async ({ page }) => {
    const user = uniqueUser("dupe");

    await page.goto("/signup");
    await page.getByLabel("Name").fill(user.name);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.locator("form").getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL("/");

    await page.evaluate(() => window.localStorage.clear());
    await page.goto("/signup");
    await page.getByLabel("Name").fill(user.name);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.locator("form").getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL("/signup");
    await expect(page.locator(".status-error").first()).toBeVisible();
  });

  test("navigates between sign in and create account", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL("/signup");

    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Login", () => {
  test("an existing user can log in", async ({ page, request, baseURL }) => {
    const user = uniqueUser("login");
    const res = await request.post(`${baseURL}/v1/sign/signup`, { data: user });
    expect(res.ok()).toBeTruthy();

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.locator("form").getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL("/");
  });

  test("shows an error for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("wrong-password");
    await page.locator("form").getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.locator(".status-error").first()).toBeVisible();
  });
});

test.describe("Route protection", () => {
  test("an anonymous visitor is redirected away from a protected page", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an unknown path lands on the 404 page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page).toHaveURL("/404");
  });
});

test.describe("Logout", () => {
  test("signing out returns to the login page and re-protects the app", async ({ authedPage }) => {
    await authedPage.goto("/account");
    await authedPage.getByRole("button", { name: /sign out/i }).click();

    await expect(authedPage).toHaveURL(/\/login/);
    await authedPage.goto("/account");
    await expect(authedPage).toHaveURL(/\/login/);
  });
});
