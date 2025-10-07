import { expect, test } from "@playwright/test";

test("lab prompt A/B testing flow", async ({ page }) => {
  await page.goto("/lab");

  await expect(page.getByText("Prompt Lab")).toBeVisible();

  const systemPromptA = page.getByPlaceholder("Describe system prompt A here...");
  await systemPromptA.fill("You are assistant alpha. Always include the word 'alpha' in your responses.");

  const systemPromptB = page.getByPlaceholder("Describe system prompt B here...");
  await systemPromptB.fill("You are assistant beta. Always include the word 'beta' in your responses.");

  const userInput = page.getByPlaceholder("User message to test with both prompts...");
  await userInput.fill("Hello, how are you today?");

  await page.getByRole("button", { name: "Run Both" }).click();

  await expect(page.getByText("alpha")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("beta")).toBeVisible({ timeout: 10_000 });

  await expect(page.getByRole("button", { name: "Export JSONL" })).toBeEnabled({ timeout: 5_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole("button", { name: "Export JSONL" }).click();
  
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.jsonl$/);
});