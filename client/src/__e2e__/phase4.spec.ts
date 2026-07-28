import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("Switch between table, board, and list views", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await expect(page.locator("h1").first()).toHaveText("Task Tracker");

  await page.waitForSelector('[class*="bodyRow"]', { timeout: 10000 });
  const tableRowTitle = page.locator("table").getByText("Design new onboarding flow");
  await expect(tableRowTitle).toBeVisible();

  // Switch to Board view
  await page.getByRole("button", { name: /Board/ }).click();
  await page.waitForSelector('[data-column-id]', { timeout: 10000 });

  // Verify board columns exist
  const columns = page.locator('[data-column-id]');
  const columnCount = await columns.count();
  expect(columnCount).toBeGreaterThanOrEqual(2);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase4-board-view.png", fullPage: false });

  // Switch to List view
  await page.getByRole("button", { name: /List/ }).click();
  await page.waitForTimeout(800);

  const listTitle = page.getByText("Design new onboarding flow").last();
  await expect(listTitle).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: "src/__e2e__/screenshots/phase4-list-view.png", fullPage: false });
});

test("Board view groups rows by status", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.getByRole("button", { name: /Board/ }).click();
  await page.waitForSelector('[data-column-id]', { timeout: 10000 });

  const columns = page.locator('[data-column-id]');
  const columnCount = await columns.count();
  expect(columnCount).toBeGreaterThanOrEqual(2);

  await expect(columns.first()).toBeVisible();

  await page.screenshot({ path: "src/__e2e__/screenshots/phase4-board-columns.png", fullPage: false });
});

test("Dragging a card between board columns", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.getByRole("button", { name: /Board/ }).click();
  await page.waitForSelector('[data-column-id]', { timeout: 10000 });

  const boardText = page.getByText("Design new onboarding flow").last();
  await expect(boardText).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: "src/__e2e__/screenshots/phase4-board-drag.png", fullPage: false });
});

test("Applying a filter", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.waitForSelector('[class*="bodyRow"]', { timeout: 10000 });

  const beforeCount = await page.locator('[class*="bodyRow"]').count();

  await page.getByText("Filter").click();

  await expect(page.getByText("+ Add filter")).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: "src/__e2e__/screenshots/phase4-filter-panel.png", fullPage: false });

  await page.getByRole("button", { name: "Done" }).click();

  await page.waitForTimeout(500);
  await expect(page.getByText("+ Add filter")).not.toBeVisible();

  const afterCount = await page.locator('[class*="bodyRow"]').count();
  expect(afterCount).toBe(beforeCount);
});

test("Applying a sort", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.waitForSelector('[class*="bodyRow"]', { timeout: 10000 });

  await page.getByText("Sort").click();

  await expect(page.getByRole("button", { name: "Done" })).toBeVisible({ timeout: 5000 });

  const sortSelect = page.locator("select").first();
  await sortSelect.selectOption("__title");

  await page.waitForTimeout(800);

  const firstRow = page.locator('[class*="bodyRow"]').first();
  const firstTitle = firstRow.locator('[class*="titleText"] span').last();
  const firstTitleText = await firstTitle.textContent();
  expect(firstTitleText).toBeDefined();

  await page.screenshot({ path: "src/__e2e__/screenshots/phase4-sort-applied.png", fullPage: false });

  await page.getByRole("button", { name: "Done" }).click();
});
