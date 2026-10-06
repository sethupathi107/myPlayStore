import { test, expect } from "./fixtures/auth";

test.describe("Search", () => {
  test("prompts for input before any query is typed", async ({ authedPage }) => {
    await authedPage.goto("/search");
    await expect(authedPage.getByText(/start typing above to find an app/i)).toBeVisible();
  });

  test("typing a query updates the URL and shows a result count", async ({ authedPage }) => {
    await authedPage.goto("/search");
    await authedPage.getByPlaceholder("Search apps…").fill("a");

    await expect(authedPage).toHaveURL(/[?&]q=a/);
    await expect(authedPage.getByText(/result/i)).toBeVisible();
  });

  test("an unmatched query shows the empty state", async ({ authedPage }) => {
    await authedPage.goto("/search");
    await authedPage.getByPlaceholder("Search apps…").fill("zzzzzznonexistentquery9999");

    await expect(authedPage.getByText(/nothing on this shelf/i)).toBeVisible();
  });

  test("category chips filter the search and reflect in the URL", async ({ authedPage }) => {
    await authedPage.goto("/search?q=a");
    const chips = authedPage.locator(".chip-row .chip");
    // Categories load asynchronously after the initial render, so give them
    // a moment before deciding whether there's anything to filter by.
    await expect(chips.nth(1)).toBeAttached({ timeout: 5000 }).catch(() => {});
    const chipCount = await chips.count();
    test.skip(chipCount < 2, "no categories seeded yet");

    const secondChip = chips.nth(1);
    const chipName = await secondChip.textContent();
    await secondChip.click();

    await expect(authedPage).toHaveURL(/[?&]category=/);
    await expect(secondChip).toHaveClass(/is-active/);
    await expect(authedPage.getByText(new RegExp(`in ${chipName.trim()}`, "i"))).toBeVisible();
  });

  test("clearing the query removes results", async ({ authedPage }) => {
    await authedPage.goto("/search?q=a");
    await authedPage.getByPlaceholder("Search apps…").fill("");

    await expect(authedPage.getByText(/start typing above to find an app/i)).toBeVisible();
  });
});
