import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("App loads and shows sidebar with seed pages", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Personal Space")).toBeVisible();
  await expect(page.getByText("Home")).toBeVisible();
  await expect(page.getByText("Projects")).toBeVisible();
  await expect(page.getByText("Reading List")).toBeVisible();
  await expect(page.getByText("Travel Plans")).toBeVisible();

  await page.screenshot({ path: "src/__e2e__/screenshots/app-loaded.png", fullPage: false });
});

test("Creating a new page", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  const beforeCount = await page.locator('[data-testid^="page-title-"]').count();

  await page.locator('[data-testid="new-page-btn"]').click();
  await page.waitForTimeout(500);

  const afterCount = await page.locator('[data-testid^="page-title-"]').count();
  expect(afterCount).toBe(beforeCount + 1);

  await page.screenshot({ path: "src/__e2e__/screenshots/new-page.png", fullPage: false });
});

test("Renaming a page", async ({ page }) => {
  await page.goto("/");

  const homeRow = page.getByText("Home").first();
  await homeRow.hover();

  const renameBtn = page.locator('[title="Rename"]').first();
  await expect(renameBtn).toBeVisible();
  await renameBtn.click();

  const input = page.locator('[class*="renameInput"]');
  await expect(input).toBeVisible();
  await input.fill("Home Renamed");
  await input.press("Enter");

  await expect(page.getByText("Home Renamed")).toBeVisible();

  await page.screenshot({ path: "src/__e2e__/screenshots/renamed-page.png", fullPage: false });

  // Rename back
  await page.getByText("Home Renamed").first().hover();
  await page.locator('[title="Rename"]').first().click();
  const input2 = page.locator('[class*="renameInput"]');
  await input2.fill("Home");
  await input2.press("Enter");
  await expect(page.getByText("Home")).toBeVisible();
});

test("Deleting a page with confirmation", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-testid="new-page-btn"]').click();
  await page.waitForTimeout(500);

  const titleEl = page.locator('[data-testid^="page-title-"]').filter({ hasText: "New Page" }).first();
  await expect(titleEl).toBeVisible();

  const titleTestId = await titleEl.getAttribute("data-testid");
  const pageId = titleTestId!.replace("page-title-", "");

  await titleEl.hover();

  const deleteBtn = page.locator(`[data-testid="delete-${pageId}"]`);
  await deleteBtn.click();

  await expect(page.locator('[data-testid="modal-dialog"]')).toBeVisible();
  await expect(page.getByText("Delete Page")).toBeVisible();

  // Cancel first
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator('[data-testid="modal-dialog"]')).not.toBeVisible();

  // Delete for real
  await titleEl.hover();
  await page.locator(`[data-testid="delete-${pageId}"]`).click();
  await expect(page.locator('[data-testid="modal-dialog"]')).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();

  await page.waitForTimeout(500);
  const remaining = page.locator(`[data-testid="page-title-${pageId}"]`);
  await expect(remaining).toHaveCount(0);

  await page.screenshot({ path: "src/__e2e__/screenshots/deleted-page.png", fullPage: false });
});

test("Selecting a page shows content area", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.getByText("Home").first().click();

  const pageName = page.locator('[data-testid="page-view-title"]');
  await expect(pageName).toBeVisible();
  await expect(pageName).toHaveText("Home");

  await page.waitForTimeout(300);
  await page.getByText("Projects").first().click();
  await expect(pageName).toHaveText("Projects");

  await page.screenshot({ path: "src/__e2e__/screenshots/selected-page.png", fullPage: false });
});