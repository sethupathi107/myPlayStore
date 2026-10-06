import { test, expect } from "./fixtures/auth";

// Every test here mutates the account itself (password, deletion), so each
// one needs its own throwaway user rather than the shared storageState
// account other spec files reuse - see fixtures/auth.js's freshPage.

test.describe("Account settings", () => {
  test("shows the signed-in user's email and stats", async ({ freshPage, freshUser }) => {
    await freshPage.goto("/account");
    await expect(freshPage.getByRole("heading", { name: freshUser.email })).toBeVisible();
    await expect(freshPage.getByText(/installed/i)).toBeVisible();
    await expect(freshPage.getByRole("heading", { name: "My published apps" })).toBeVisible();
  });

  test("changing the password with the wrong current password shows an error", async ({ freshPage }) => {
    await freshPage.goto("/account");
    await freshPage.getByLabel("Current password").fill("definitely-wrong");
    await freshPage.getByLabel("New password").fill("BrandNewPassword123!");
    await freshPage.getByRole("button", { name: /^change password$/i }).click();

    await expect(freshPage.locator(".status-error").first()).toBeVisible();
  });

  test("changing the password succeeds and the new password can log in", async ({ freshPage, freshUser }) => {
    await freshPage.goto("/account");
    const newPassword = "BrandNewPassword456!";
    await freshPage.getByLabel("Current password").fill(freshUser.password);
    await freshPage.getByLabel("New password").fill(newPassword);
    await freshPage.getByRole("button", { name: /^change password$/i }).click();

    await expect(freshPage.getByText(/password changed successfully/i)).toBeVisible();

    await freshPage.getByRole("button", { name: /sign out/i }).click();
    await expect(freshPage).toHaveURL(/\/login/);

    await freshPage.getByLabel("Email").fill(freshUser.email);
    await freshPage.getByLabel("Password").fill(newPassword);
    await freshPage.locator("form").getByRole("button", { name: /sign in/i }).click();
    await expect(freshPage).toHaveURL("/");
  });

  test("deleting the account requires confirmation and then logs the user out", async ({ freshPage, freshUser }) => {
    await freshPage.goto("/account");
    await freshPage.locator("#delete-password").fill(freshUser.password);
    await freshPage.getByRole("button", { name: /delete my account/i }).click();

    await freshPage.getByRole("alertdialog").getByRole("button", { name: /delete account/i }).click();

    await expect(freshPage).toHaveURL(/\/signup/);
    await freshPage.goto("/account");
    await expect(freshPage).toHaveURL(/\/login/);
  });
});
