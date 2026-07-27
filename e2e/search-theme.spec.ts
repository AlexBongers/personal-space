import { expect, test } from '@playwright/test';
import { openApp, treeRow } from './helpers.ts';

test('quick find opens by shortcut and by the visible control', async ({ page }) => {
  await openApp(page);

  await page.getByRole('button', { name: /Search/ }).click();
  await expect(page.getByRole('dialog', { name: 'Quick find' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Quick find' })).toHaveCount(0);

  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: 'Quick find' })).toBeVisible();
});

test('results narrow live across pages, databases and rows', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('textbox', { name: 'Search' });

  await search.fill('no');
  await expect(page.getByTestId('search-hit-Notes')).toBeVisible();

  await search.fill('note');
  const hits = page.getByTestId('search-results').getByRole('button');
  await expect(hits.first()).toBeVisible();
  await expect(page.getByTestId('search-hit-Meeting Notes')).toContainText('in Notes');

  // A database and one of its rows are both findable.
  await search.fill('reading');
  await expect(page.getByTestId('search-hit-Reading List')).toContainText('Database');
  await search.fill('piranesi');
  await expect(page.getByTestId('search-hit-Piranesi')).toContainText('Entry');

  await search.fill('zzzznothing');
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
});

test('choosing a result jumps to it and reveals it in the sidebar', async ({ page }) => {
  await openApp(page);
  await expect(treeRow(page, 'Lisbon 2026')).toHaveCount(0);

  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('textbox', { name: 'Search' }).fill('lisbon');
  await page.getByTestId('search-hit-Lisbon 2026').click();

  await expect(page.getByTestId('page-title')).toHaveText('Lisbon 2026');
  await expect(treeRow(page, 'Lisbon 2026')).toBeVisible();
});

test('a row found by search opens as its own page', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('textbox', { name: 'Search' }).fill('worktop');
  await page.getByTestId('search-hit-Pick the worktop').click();

  await expect(page.getByTestId('page-title')).toHaveText('Pick the worktop');
  await expect(page.getByTestId('row-properties')).toBeVisible();
});

test('the keyboard alone drives quick find', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('ideas');
  await expect(page.getByTestId('search-hit-Ideas')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('page-title')).toHaveText('Ideas');
});

test('the theme toggle switches the whole app and the choice survives a restart', async ({ page }) => {
  await openApp(page);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');

  const bodyBefore = await page.locator('body').evaluate((n) => getComputedStyle(n).backgroundColor);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  const bodyAfter = await page.locator('body').evaluate((n) => getComputedStyle(n).backgroundColor);
  expect(bodyAfter).not.toBe(bodyBefore);

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
});

test('the seeded workspace shows off every feature', async ({ page }) => {
  await openApp(page);

  // Every block type, on the seeded pages.
  const types = new Set<string>();
  for (const path of [
    ['Home'],
    ['Home', 'Weekly Review'],
    ['Projects', 'Personal Space'],
    ['Projects', 'Personal Space', 'Design Notes'],
  ]) {
    for (const parent of path.slice(0, -1)) {
      const twisty = treeRow(page, parent).getByRole('button', { name: `Expand ${parent}` });
      if (await twisty.isVisible()) await twisty.click();
    }
    await treeRow(page, path[path.length - 1]).click();
    await expect(page.getByTestId('block-editor')).toBeVisible();
    for (const type of await page
      .locator('.block')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.blockType ?? ''))) {
      types.add(type);
    }
  }
  for (const type of [
    'paragraph',
    'heading1',
    'heading2',
    'heading3',
    'bulleted',
    'numbered',
    'todo',
    'quote',
    'divider',
    'code',
    'callout',
  ]) {
    expect(types).toContain(type);
  }

  // A sorted table, a grouped board, and a filtered list.
  await treeRow(page, 'Tasks').click();
  await expect(page.getByRole('button', { name: /^Sort/ })).toContainText('Due');
  await expect(page.locator('.table tbody tr .cell__input--title').first()).toHaveValue(
    'Replace the kitchen tap',
  );

  await page.getByRole('tab', { name: 'Board' }).click();
  await expect(page.getByRole('button', { name: /^Group/ })).toContainText('Status');
  await expect(page.getByTestId('board-column-Backlog')).toBeVisible();

  const life = treeRow(page, 'Life').getByRole('button', { name: 'Expand Life' });
  if (await life.isVisible()) await life.click();
  await treeRow(page, 'Reading List').click();
  await page.getByRole('tab', { name: 'List' }).click();
  await expect(page.getByRole('button', { name: /^Filter/ })).toContainText('(1)');
  await expect(page.getByTestId('row-count')).toHaveText('3 of 8 rows');
});
