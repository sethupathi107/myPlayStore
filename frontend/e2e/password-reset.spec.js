import { test, expect, uniqueUser, signupViaApi } from "./fixtures/auth";
import { latestResetTokenFor } from "./fixtures/db";

// The backend emails the reset token instead of returning it in the API
// response (see backend/src/controller/auth.js forgotPassword) - there's no
// inbox to read here, so these tests pull the token straight out of the
// Sessions table it was written to. See fixtures/db.js.

test.describe("Forgot password", () => {
  test("requesting a reset for a known email shows a success message", async ({ page, request, baseURL }) => {
    const user = uniqueUser("forgot");
    await signupViaApi(request, baseURL, user);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: /send reset token/i }).click();

    await expect(page.locator(".status-success")).toBeVisible();
    await expect(page.locator(".status-error")).toHaveCount(0);
  });

  test("requesting a reset for an unknown email shows an error", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /send reset token/i }).click();

    await expect(page.locator(".status-error")).toBeVisible();
  });

  test("links to the reset-password page for someone who already has a token", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("link", { name: /reset password/i }).click();
    await expect(page).toHaveURL("/reset-password");
  });
});

test.describe("Reset password", () => {
  test("an invalid token is rejected with an error", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByLabel("Reset token").fill("not-a-real-token");
    await page.getByLabel("New password").fill("SomeNewPassword123!");
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page.locator(".status-error")).toBeVisible();
    await expect(page).toHaveURL("/reset-password");
  });

  test("a valid token lets the user set a new password and log in with it", async ({ page, request, baseURL }) => {
    const user = uniqueUser("reset");
    await signupViaApi(request, baseURL, user);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: /send reset token/i }).click();
    await expect(page.locator(".status-success")).toBeVisible();

    const resetToken = await latestResetTokenFor(user.email);

    const newPassword = "BrandNewPassword789!";
    await page.goto("/reset-password");
    await page.getByLabel("Reset token").fill(resetToken);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page).toHaveURL("/login");

    // The old password must no longer work...
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.locator("form").getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator(".status-error")).toBeVisible();
    await expect(page).toHaveURL("/login");

    // ...but the new one does.
    await page.getByLabel("Password").fill(newPassword);
    await page.locator("form").getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("a used token cannot be replayed", async ({ page, request, baseURL }) => {
    const user = uniqueUser("replay");
    await signupViaApi(request, baseURL, user);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: /send reset token/i }).click();
    await expect(page.locator(".status-success")).toBeVisible();

    const resetToken = await latestResetTokenFor(user.email);

    await page.goto("/reset-password");
    await page.getByLabel("Reset token").fill(resetToken);
    await page.getByLabel("New password").fill("FirstReset123!");
    await page.getByRole("button", { name: /reset password/i }).click();
    await expect(page).toHaveURL("/login");

    await page.goto("/reset-password");
    await page.getByLabel("Reset token").fill(resetToken);
    await page.getByLabel("New password").fill("SecondReset123!");
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page.locator(".status-error")).toBeVisible();
    await expect(page).toHaveURL("/reset-password");
  });
});
