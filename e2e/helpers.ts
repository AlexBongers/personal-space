import { expect, type Page } from '@playwright/test';

/**
 * Restores the seeded workspace, then opens the app. Every test starts here, so
 * each one runs against the same known data. (A shared `test.beforeEach` would
 * not do: the module is cached, so the hook would only register for whichever
 * spec file imported it first.)
 */
export async function openApp(page: Page): Promise<void> {
  const reset = await page.request.post('/api/test/reset');
  expect(reset.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByTestId('page-tree').getByText('Home', { exact: true })).toBeVisible();
}

export function treeRow(page: Page, title: string) {
  return page.getByTestId(`tree-row-${title}`);
}

/** Expands a sidebar row if it is not already open. */
export async function expandRow(page: Page, title: string): Promise<void> {
  const twisty = treeRow(page, title).getByRole('button', { name: `Expand ${title}` });
  if (await twisty.isVisible()) await twisty.click();
}

/** Opens the "..." row menu for a sidebar page. */
export async function openRowMenu(page: Page, title: string): Promise<void> {
  const row = treeRow(page, title);
  await row.hover();
  await row.getByRole('button', { name: `Actions for ${title}` }).click();
}

export async function createChildPage(page: Page, parentTitle: string, name: string): Promise<void> {
  const row = treeRow(page, parentTitle);
  await row.hover();
  await row.getByRole('button', { name: `Add page inside ${parentTitle}` }).click();
  await expect(page.getByTestId('page-title')).toHaveText('Untitled');
  await renameActivePage(page, name);
}

/** Retitles the currently open page through its header and waits for the save. */
export async function renameActivePage(page: Page, name: string): Promise<void> {
  const title = page.getByTestId('page-title');
  await title.click();
  await page.keyboard.press('ControlOrMeta+a');
  await title.pressSequentially(name);
  await expect(treeRow(page, name)).toBeVisible();
}
