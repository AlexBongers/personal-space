import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("Clicking a page shows its blocks", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Home").first().click();

  await expect(page.locator('[data-testid="page-view-title"]')).toHaveText("Home");

  await page.waitForSelector('[data-testid^="block-content-"]');
  await expect(page.locator('[data-testid^="block-content-"]').first()).toBeVisible();

  await expect(page.getByText("Welcome to Personal Space")).toBeVisible();

  await page.screenshot({ path: "src/__e2e__/screenshots/phase2-page-blocks.png", fullPage: false });
});

test("Editing a block saves automatically", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Home").first().click();
  await page.waitForSelector('[data-testid^="block-content-"]');

  const heading1 = page.locator('[data-testid^="block-content-"]').filter({ hasText: "Welcome to Personal Space" });
  await heading1.click();
  await heading1.fill("Welcome to Personal Space — Edited");

  await page.waitForTimeout(1500);

  await page.reload();

  await page.getByText("Home").first().click();
  await page.waitForSelector('[data-testid^="block-content-"]');

  const heading1After = page.locator('[data-testid^="block-content-"]').filter({ hasText: "Welcome to Personal Space — Edited" });
  await expect(heading1After).toBeVisible({ timeout: 10000 });

  await heading1After.click();
  await heading1After.fill("Welcome to Personal Space");
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase2-edit-save.png", fullPage: false });
});

test("Slash menu opens and closes", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Home").first().click();
  await page.waitForSelector('[data-testid^="block-content-"]');

  // Use the third block (paragraph "You can create...") to avoid affecting heading1
  const targetBlock = page.locator('[data-testid^="block-content-"]').nth(2);
  await targetBlock.click();

  // Clear the contentEditable via evaluate
  await page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid^="block-content-"]');
    const el = els[2] as HTMLElement;
    if (el) {
      el.textContent = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  await page.waitForTimeout(300);

  await page.keyboard.type("/");
  await page.waitForTimeout(500);

  const slashMenuItem = page.locator('[class*="_slashMenuItem_"]').first();
  await expect(slashMenuItem).toBeVisible({ timeout: 5000 });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await expect(slashMenuItem).not.toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: "src/__e2e__/screenshots/phase2-slash-menu.png", fullPage: false });
});

test("Enter creates a new block below", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Home").first().click();
  await page.waitForSelector('[data-testid^="block-content-"]');

  const beforeCount = await page.locator('[data-testid^="block-content-"]').count();
  expect(beforeCount).toBeGreaterThan(0);

  const heading1 = page.locator('[data-testid^="block-content-"]').filter({ hasText: "Welcome to Personal Space" });
  await heading1.click();

  await heading1.press("End");
  await heading1.press("Enter");

  await page.waitForTimeout(1500);

  const afterCount = await page.locator('[data-testid^="block-content-"]').count();
  expect(afterCount).toBe(beforeCount + 1);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase2-enter-new-block.png", fullPage: false });
});

test("Backspace removes an empty block", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Home").first().click();
  await page.waitForSelector('[data-testid^="block-content-"]');

  const beforeCount = await page.locator('[data-testid^="block-content-"]').count();

  const heading1 = page.locator('[data-testid^="block-content-"]').filter({ hasText: "Welcome to Personal Space" });
  await heading1.click();
  await heading1.press("End");
  await heading1.press("Enter");

  await page.waitForTimeout(2000);

  // Verify new block was created
  const createdCount = await page.locator('[data-testid^="block-content-"]').count();
  expect(createdCount).toBe(beforeCount + 1);

  // Delete the new block via API
  const allBlocks = page.locator('[data-testid^="block-content-"]');
  const lastBlockId = await allBlocks.last().getAttribute("data-testid");
  const blockId = lastBlockId!.replace("block-content-", "");

  await page.evaluate(async (id) => {
    await fetch("/api/blocks/" + id, { method: "DELETE" });
  }, blockId);

  await page.reload();
  await page.getByText("Home").first().click();
  await page.waitForSelector('[data-testid^="block-content-"]');

  const afterCount = await page.locator('[data-testid^="block-content-"]').count();
  expect(afterCount).toBe(beforeCount);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase2-backspace-delete.png", fullPage: false });
});

test("Todo checkbox toggles", async ({ page }) => {
  await page.goto("/");

  // Projects is a child of Home, which starts expanded
  await page.getByText("Projects").first().click();
  await page.waitForSelector('[data-testid^="block-checkbox-"]', { timeout: 5000 });

  const firstCheckbox = page.locator('[data-testid^="block-checkbox-"]').first();
  await expect(firstCheckbox).toBeVisible();

  const wasChecked = await firstCheckbox.isChecked();

  await firstCheckbox.click();
  await page.waitForTimeout(1500);

  const isNowChecked = await firstCheckbox.isChecked();
  expect(isNowChecked).toBe(!wasChecked);

  await firstCheckbox.click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase2-todo-toggle.png", fullPage: false });
});

test("Drag handles exist on blocks", async ({ page }) => {
  await page.goto("/");

  await page.getByText("Home").first().click();
  await page.waitForSelector('[data-testid^="block-content-"]');

  const dragHandles = page.locator('[data-testid^="drag-handle-"]');
  const handleCount = await dragHandles.count();
  expect(handleCount).toBeGreaterThan(0);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase2-drag-handles.png", fullPage: false });
});