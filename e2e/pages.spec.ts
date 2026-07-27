import { expect, test } from '@playwright/test';
import { createChildPage, expandRow, openApp, openRowMenu, treeRow } from './helpers.ts';

test('the seeded workspace loads with its tree and icons', async ({ page }) => {
  await openApp(page);
  const tree = page.getByTestId('page-tree');
  for (const title of ['Home', 'Projects', 'Notes', 'Life']) {
    await expect(tree.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(treeRow(page, 'Home')).toContainText('🏠');

  await expandRow(page, 'Projects');
  await expect(treeRow(page, 'Personal Space')).toBeVisible();
  await expect(treeRow(page, 'Kitchen Renovation')).toBeVisible();
});

test('a new page appears in the sidebar and survives a reload', async ({ page }) => {
  await openApp(page);
  await createChildPage(page, 'Notes', 'Ship Log');

  await expect(treeRow(page, 'Ship Log')).toBeVisible();
  await expect(page.getByTestId('page-title')).toHaveText('Ship Log');

  await page.reload();
  await expect(treeRow(page, 'Ship Log')).toBeVisible();
  await expect(page.getByTestId('page-title')).toHaveText('Ship Log');
});

test('a page can be renamed from the sidebar', async ({ page }) => {
  await openApp(page);
  await expandRow(page, 'Life');
  await openRowMenu(page, 'Recipes');
  await page.getByRole('menuitem', { name: 'Rename' }).click();

  const input = page.getByRole('textbox', { name: 'Page name' });
  await input.fill('Cookbook');
  await input.press('Enter');

  await expect(treeRow(page, 'Cookbook')).toBeVisible();
  await expect(treeRow(page, 'Recipes')).toHaveCount(0);

  await page.reload();
  await expect(treeRow(page, 'Cookbook')).toBeVisible();
});

test('deleting a page asks for confirmation and removes nested pages', async ({ page }) => {
  await openApp(page);
  await expandRow(page, 'Life');
  await expandRow(page, 'Travel');
  await expect(treeRow(page, 'Lisbon 2026')).toBeVisible();

  await openRowMenu(page, 'Travel');
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Delete "Travel"?');
  await expect(dialog).toContainText('1 nested page');

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(treeRow(page, 'Travel')).toBeVisible();

  await openRowMenu(page, 'Travel');
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(treeRow(page, 'Travel')).toHaveCount(0);
  await expect(treeRow(page, 'Lisbon 2026')).toHaveCount(0);

  await page.reload();
  await expect(treeRow(page, 'Travel')).toHaveCount(0);
});

test('a page icon can be changed from the page header', async ({ page }) => {
  await openApp(page);
  await treeRow(page, 'Notes').click();
  await page.getByRole('button', { name: 'Change page icon' }).click();
  await page.getByRole('button', { name: 'Icon 🔥' }).click();

  await expect(page.getByRole('button', { name: 'Change page icon' })).toHaveText('🔥');
  await expect(treeRow(page, 'Notes')).toContainText('🔥');
});
