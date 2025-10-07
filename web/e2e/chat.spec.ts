import { expect, test } from "@playwright/test";

test("chat streaming flow", async ({ page }) => {
  await page.goto("/chat");

  const textarea = page.getByRole("textbox", { name: /chat message/i });
  await expect(textarea).toBeVisible();

  await textarea.fill("Hello");
  await page.getByRole("button", { name: /send/i }).click();

  await expect(page.getByRole("button", { name: /stop/i })).toBeDisabled({ timeout: 10_000 });

  await expect(page.locator("li").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /clear/i })).toBeVisible();
});
