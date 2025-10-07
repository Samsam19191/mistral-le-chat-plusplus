import { expect, test } from "@playwright/test";

test("chat streaming flow", async ({ page }) => {
  await page.goto("/chat");

  const textarea = page.getByRole("textbox", { name: /chat message/i });
  await expect(textarea).toBeVisible();

  await textarea.fill("Hello");
  await page.getByRole("button", { name: /send/i }).click();

  const assistantMessage = page.locator("li", { hasText: /mock response/i });
  await expect(assistantMessage).toContainText(/mock response/i, { timeout: 10_000 });

  await expect(page.getByRole("button", { name: /stop/i })).toBeDisabled();

  await page.getByRole("button", { name: /clear/i }).click();
  await expect(page.locator("li")).toHaveCount(1);
  await expect(page.locator("li")).toContainText(/welcome to le chat\+\+/i);
});
