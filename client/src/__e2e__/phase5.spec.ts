import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("Search opens with keyboard shortcut", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.keyboard.press("Control+k");

  await expect(page.locator('[data-testid="search-modal"]')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-testid="search-input"]')).toBeVisible();

  await page.screenshot({ path: "src/__e2e__/screenshots/phase5-search-modal.png", fullPage: false });

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="search-modal"]')).not.toBeVisible({ timeout: 3000 });
});

test("Search finds pages", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.keyboard.press("Control+k");

  await expect(page.locator('[data-testid="search-modal"]')).toBeVisible({ timeout: 3000 });

  await page.locator('[data-testid="search-input"]').fill("Project");

  await page.waitForTimeout(500);

  const results = page.locator('[data-testid="search-result"]');
  const count = await results.count();
  expect(count).toBeGreaterThanOrEqual(1);

  const hasProjects = await page.getByText("Projects").first().isVisible();
  expect(hasProjects).toBeTruthy();

  await page.screenshot({ path: "src/__e2e__/screenshots/phase5-search-results.png", fullPage: false });

  await results.first().click();

  await page.waitForSelector('[data-testid="page-view-title"]', { timeout: 5000 });
  const title = await page.locator('[data-testid="page-view-title"]').textContent();
  expect(title).toContain("Projects");
});

test("Search button opens search", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  const searchBtn = page.locator('[data-testid="search-btn"]');
  await expect(searchBtn).toBeVisible({ timeout: 5000 });

  await searchBtn.click();

  await expect(page.locator('[data-testid="search-modal"]')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-testid="search-input"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="search-modal"]')).not.toBeVisible({ timeout: 3000 });
});

test("Theme toggle switches theme", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  const themeToggle = page.locator('[data-testid="theme-toggle"]');
  await expect(themeToggle).toBeVisible({ timeout: 5000 });

  const initialTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );

  await themeToggle.click();
  await page.waitForTimeout(300);

  const newTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );

  expect(newTheme).not.toBe(initialTheme);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase5-light-theme.png", fullPage: false });

  await themeToggle.click();
  await page.waitForTimeout(300);

  const restoredTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );

  expect(restoredTheme).toBe(initialTheme);

  await page.screenshot({ path: "src/__e2e__/screenshots/phase5-dark-theme.png", fullPage: false });
});

test("Theme persists after reload", async ({ page }) => {
  await page.goto("/");

  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  const themeToggle = page.locator('[data-testid="theme-toggle"]');
  await expect(themeToggle).toBeVisible({ timeout: 5000 });

  const initialTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );

  await themeToggle.click();
  await page.waitForTimeout(500);

  const afterToggleTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );
  expect(afterToggleTheme).not.toBe(initialTheme);

  const storedTheme = await page.evaluate(() => localStorage.getItem("theme"));
  expect(storedTheme).toBe(afterToggleTheme);

  await page.goto("/");
  await page.waitForSelector('[data-testid="new-page-btn"]', { state: "visible" });

  await page.waitForFunction(() => {
    const stored = localStorage.getItem("theme");
    const attr = document.documentElement.getAttribute("data-theme");
    return stored === attr && stored !== null;
  }, { timeout: 5000 });

  const afterReloadTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );
  expect(afterReloadTheme).toBe(afterToggleTheme);
});
