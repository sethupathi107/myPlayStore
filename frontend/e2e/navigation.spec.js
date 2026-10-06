import { test, expect } from "./fixtures/auth";

test.describe("Primary navigation", () => {
  test("all nav items move between the main sections", async ({ authedPage }) => {
    await authedPage.getByRole("link", { name: /search/i }).click();
    await expect(authedPage).toHaveURL("/search");

    await authedPage.getByRole("link", { name: /publish/i }).click();
    await expect(authedPage).toHaveURL("/apps/new");

    await authedPage.getByRole("link", { name: /profile/i }).click();
    await expect(authedPage).toHaveURL("/account");

    await authedPage.getByRole("link", { name: /discover/i }).click();
    await expect(authedPage).toHaveURL("/");
  });

  test("a regular user does not see the Admin nav item", async ({ authedPage }) => {
    await expect(authedPage.getByRole("link", { name: /admin/i })).toHaveCount(0);
  });

  test("the brand link always returns home", async ({ authedPage }) => {
    await authedPage.goto("/account");
    await authedPage.getByRole("link", { name: "hommer" }).click();
    await expect(authedPage).toHaveURL("/");
  });
});

test.describe("Home / Discover", () => {
  test("the discover page renders without error", async ({ authedPage }) => {
    await authedPage.goto("/");
    await expect(authedPage.locator(".status-error")).toHaveCount(0);
  });
});
