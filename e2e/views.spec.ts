import { expect, type Page, test } from '@playwright/test';
import { expandRow, openApp, treeRow } from './helpers.ts';

async function openDatabase(page: Page, parent: string, title: string): Promise<void> {
  await openApp(page);
  await expandRow(page, parent);
  await treeRow(page, title).click();
  await expect(page.getByTestId('database')).toBeVisible();
}

const switchTo = (page: Page, name: 'Table' | 'Board' | 'List') =>
  page.getByRole('tab', { name }).click();

test('a database switches between table, board and list over the same rows', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');
  await expect(page.getByTestId('table-view')).toBeVisible();
  await expect(page.getByTestId('row-count')).toHaveText('9 rows');

  await switchTo(page, 'Board');
  await expect(page.getByTestId('board-view')).toBeVisible();
  await expect(page.getByTestId('table-view')).toHaveCount(0);
  await expect(page.locator('.card')).toHaveCount(9);

  await switchTo(page, 'List');
  await expect(page.getByTestId('list-view')).toBeVisible();
  await expect(page.locator('.list__row')).toHaveCount(9);

  await switchTo(page, 'Table');
  await expect(page.locator('.table tbody tr')).toHaveCount(9);
});

test('the board groups by a select property, one column per option', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');
  await switchTo(page, 'Board');

  for (const column of ['Backlog', 'In progress', 'Blocked', 'Done', 'No value']) {
    await expect(page.getByTestId(`board-column-${column}`)).toBeVisible();
  }
  await expect(page.getByTestId('board-column-Backlog').locator('.card')).toHaveCount(3);
  await expect(page.getByTestId('board-column-Backlog')).toContainText('Write the filter UI');
  await expect(page.getByTestId('card-Ship the board view')).toBeVisible();
});

test('dragging a card to another column changes the value everywhere', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');
  await switchTo(page, 'Board');

  const card = page.getByTestId('card-Write the filter UI');
  const target = page.getByTestId('board-column-Done');
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('missing bounding boxes');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + 10, { steps: 8 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();

  await expect(page.getByTestId('board-column-Done').getByTestId('card-Write the filter UI')).toBeVisible();
  await expect(page.getByTestId('board-column-Backlog').locator('.card')).toHaveCount(2);

  // dnd-kit swallows clicks for 50ms after a drop, so a real user's next click
  // always lands but Playwright's does not. Wait past that guard.
  await page.waitForTimeout(120);
  await switchTo(page, 'Table');
  await expect(page.getByTestId('cell-Status-Write the filter UI')).toContainText('Done');

  await page.reload();
  await expect(page.getByTestId('cell-Status-Write the filter UI')).toContainText('Done');
});

test('the grouping property can be changed and is remembered', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');
  await switchTo(page, 'Board');

  await page.getByRole('button', { name: /^Group/ }).click();
  await page.getByRole('menuitem', { name: 'Group by Priority' }).click();

  for (const column of ['Low', 'Medium', 'High']) {
    await expect(page.getByTestId(`board-column-${column}`)).toBeVisible();
  }

  await page.reload();
  await expect(page.getByTestId('board-column-High')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Group/ })).toContainText('Priority');
});

test('each filter kind narrows the rows and survives a refresh', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');
  const count = page.getByTestId('row-count');

  const addFilter = async (property: string, condition: string, value?: string) => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.getByRole('menuitem', { name: 'Add filter' }).click();
    await page.getByLabel('Filter property').last().selectOption({ label: property });
    await page.getByLabel('Filter condition').last().selectOption({ label: condition });
    if (value !== undefined) {
      const field = page.getByLabel('Filter value').last();
      if (await field.evaluate((n) => n.tagName === 'SELECT')) {
        await field.selectOption({ label: value });
      } else {
        await field.fill(value);
      }
    }
    await page.keyboard.press('Escape');
  };

  const clearFilters = async () => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    while ((await page.getByRole('button', { name: 'Remove filter' }).count()) > 0) {
      await page.getByRole('button', { name: 'Remove filter' }).first().click();
    }
    await page.keyboard.press('Escape');
  };

  // text contains
  await addFilter('Link', 'contains', 'dndkit');
  await expect(count).toHaveText('1 of 9 rows');
  await clearFilters();

  // select is / is not
  await addFilter('Status', 'is', 'Done');
  await expect(count).toHaveText('2 of 9 rows');
  await clearFilters();
  await addFilter('Status', 'is not', 'Done');
  await expect(count).toHaveText('7 of 9 rows');
  await clearFilters();

  // checkbox state
  await addFilter('Needs someone else', 'is checked');
  await expect(count).toHaveText('2 of 9 rows');
  await clearFilters();

  // date before / after
  await addFilter('Due', 'is before', '2026-08-01');
  await expect(count).toHaveText('3 of 9 rows');
  await clearFilters();
  await addFilter('Due', 'is after', '2026-08-01');
  await expect(count).toHaveText('5 of 9 rows');

  await expect(page.locator('.table tbody tr')).toHaveCount(5);
  await page.reload();
  await expect(count).toHaveText('5 of 9 rows');
  await expect(page.getByRole('button', { name: /^Filter/ })).toContainText('(1)');
});

test('a sort orders rows in either direction and persists', async ({ page }) => {
  await openDatabase(page, 'Life', 'Reading List');
  const first = () => page.locator('.table tbody tr .cell__input--title').first();

  await page.getByRole('button', { name: /^Sort/ }).click();
  await page.getByRole('menuitem', { name: 'Sort by Name' }).click();
  await expect(first()).toHaveValue('A Pattern Language');

  await page.getByRole('button', { name: /^Sort/ }).click();
  await page.getByRole('menuitem', { name: 'Reverse direction' }).click();
  await expect(first()).toHaveValue('Thinking in Systems');

  await page.reload();
  await expect(first()).toHaveValue('Thinking in Systems');
  await expect(page.getByRole('button', { name: /^Sort/ })).toContainText('Name');
});

test('view settings are kept separately per view', async ({ page }) => {
  await openDatabase(page, 'Life', 'Reading List');

  // The seeded list view is filtered to finished books; the table is not.
  await expect(page.getByTestId('row-count')).toHaveText('8 rows');
  await switchTo(page, 'List');
  await expect(page.getByTestId('row-count')).toHaveText('3 of 8 rows');
  await expect(page.locator('.list__row')).toHaveCount(3);

  await switchTo(page, 'Table');
  await expect(page.getByTestId('row-count')).toHaveText('8 rows');
});

test('the list view shows each row title with a property', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');
  await switchTo(page, 'List');

  const row = page.getByTestId('list-row-Pick the worktop');
  await expect(row).toContainText('Pick the worktop');
  await expect(row).toContainText('Blocked');
  await expect(row).toContainText('High');

  await row.click();
  await expect(page.getByTestId('page-title')).toHaveText('Pick the worktop');
});
