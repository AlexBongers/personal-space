import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("Database page shows table view", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();

  await page.getByText("Task Tracker").first().click();

  await expect(page.locator("h1").first()).toHaveText("Task Tracker");

  await page.waitForSelector('[class*="bodyRow"]', { timeout: 10000 });
  const firstRow = page.locator('[class*="bodyRow"]').first();
  await expect(firstRow).toBeVisible();

  const tableRowTitle = page.locator("table").getByText("Design new onboarding flow");
  await expect(tableRowTitle).toBeVisible();

  await page.screenshot({ path: "src/__e2e__/screenshots/phase3-db-table-view.png", fullPage: false });
});

test("Creating a new row", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.waitForSelector('[class*="bodyRow"]', { timeout: 10000 });

  const beforeCount = await page.locator('[class*="bodyRow"]').count();

  await page.getByText("New Row").click();
  await page.waitForTimeout(1000);

  const afterCount = await page.locator('[class*="bodyRow"]').count();
  expect(afterCount).toBe(beforeCount + 1);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase3-new-row.png", fullPage: false });
});

test("Editing a cell in the table", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.waitForSelector('[class*="bodyRow"]', { timeout: 10000 });
  await page.waitForSelector('[class*="cellContent"]', { timeout: 5000 });

  // Find a date cell that has a value and click it to edit
  const dateCell = page.locator('[class*="cellContent"]').filter({ hasText: "2025" }).first();
  await expect(dateCell).toBeVisible({ timeout: 5000 });
  await dateCell.click();

  // A date input should appear (for date type) or text input
  const input = page.locator('input[type="date"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill("2025-06-01");
  await input.press("Enter");

  await page.waitForTimeout(1000);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase3-edit-cell.png", fullPage: false });
});

test("Adding a property", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.waitForSelector('[class*="headerCell"]', { timeout: 10000 });

  const headerCells = page.locator('[class*="headerCell"]');
  const beforeCount = await headerCells.count();

  await page.locator('[title="Add property"]').click();

  await expect(page.getByRole("button", { name: "Add Property" })).toBeVisible({ timeout: 5000 });

  const nameInput = page.locator('input[placeholder="Property name..."]');
  await nameInput.fill("Test Text");

  const textBtn = page.getByRole("button", { name: "Text" });
  await textBtn.click();

  await page.getByRole("button", { name: "Add Property" }).click();

  await page.waitForTimeout(1000);

  const afterCount = await headerCells.count();
  expect(afterCount).toBe(beforeCount + 1);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase3-add-property.png", fullPage: false });
});

test("Opening a row as a page", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Projects").first().click();
  await page.getByText("Task Tracker").first().click();

  await page.waitForSelector('[class*="bodyRow"]', { timeout: 10000 });

  // Click on the first row's title text to open RowPage (use title icon or text)
  const firstRow = page.locator('[class*="bodyRow"]').first();
  const titleSpan = firstRow.locator('[class*="titleText"] span').last();
  await titleSpan.click();

  await page.waitForTimeout(2000);

  // Verify RowPage appears with the row title (h1 heading)
  await expect(page.locator("h1").filter({ hasText: "Design new onboarding flow" })).toBeVisible({ timeout: 5000 });

  // Verify Properties section is visible
  await expect(page.getByText("Properties")).toBeVisible({ timeout: 5000 });

  // Verify back button is visible
  const backBtn = page.getByText("Back to Task Tracker");
  await expect(backBtn).toBeVisible();

  await page.screenshot({ path: "src/__e2e__/screenshots/phase3-row-page.png", fullPage: false });

  // Click back button
  await backBtn.click();

  await page.waitForTimeout(1000);

  // Verify we're back in the table view
  await expect(page.locator('[class*="bodyRow"]').first()).toBeVisible();
  await expect(page.locator("h1").first()).toHaveText("Task Tracker");

  await page.screenshot({ path: "src/__e2e__/screenshots/phase3-back-to-table.png", fullPage: false });
});