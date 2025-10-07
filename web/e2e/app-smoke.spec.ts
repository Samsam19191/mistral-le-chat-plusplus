import { expect, test } from "@playwright/test";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Le Chat++";

test.describe("app smoke", () => {
  test("home to chat flow", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("banner")).toContainText(APP_NAME);

    await page.getByRole("link", { name: "Open the chat preview →" }).click();

    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByPlaceholder("Type your message…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  });
});
