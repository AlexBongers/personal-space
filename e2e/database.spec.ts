import { expect, type Page, test } from '@playwright/test';
import { expandRow, openApp, treeRow } from './helpers.ts';

async function openDatabase(page: Page, parent: string, title: string): Promise<void> {
  await openApp(page);
  await expandRow(page, parent);
  await treeRow(page, title).click();
  await expect(page.getByTestId('table-view')).toBeVisible();
}

test('a database can be created from the sidebar and shows in the tree', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New database' }).click();

  await expect(page.getByTestId('page-title')).toHaveText('Untitled database');
  await expect(page.getByText('Database', { exact: true })).toBeVisible();
  await expect(page.getByTestId('table-view')).toBeVisible();
  await expect(treeRow(page, 'Untitled database')).toBeVisible();

  // A new database starts with a Status select so the board means something.
  await expect(page.getByRole('button', { name: 'Column Status' })).toBeVisible();

  await page.reload();
  await expect(treeRow(page, 'Untitled database')).toBeVisible();
});

test('the seeded databases show their rows and typed columns', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');
  await expect(page.locator('.table tbody tr')).toHaveCount(9);

  for (const column of ['Status', 'Priority', 'Area', 'Due', 'Effort (h)', 'Needs someone else', 'Link']) {
    await expect(page.getByRole('button', { name: `Column ${column}` })).toBeVisible();
  }
  await expect(page.getByTestId('cell-Status-Ship the board view').getByText('In progress')).toBeVisible();
  await expect(page.getByTestId('cell-Area-Renew the travel insurance')).toContainText('Travel');
  await expect(page.getByTestId('cell-Area-Renew the travel insurance')).toContainText('Admin');
});

test('a property of each type can be added and edited in the table', async ({ page }) => {
  await openDatabase(page, 'Projects', 'Tasks');

  const types: [string, string][] = [
    ['Notes', 'Text'],
    ['Score', 'Number'],
    ['Phase', 'Select'],
    ['Tags', 'Multi-select'],
    ['Start', 'Date'],
    ['Pinned', 'Checkbox'],
    ['Docs', 'URL'],
  ];

  for (const [name, type] of types) {
    await page.getByRole('button', { name: 'Add property' }).click();
    await page.getByRole('textbox', { name: 'New property name' }).fill(name);
    await page.getByRole('button', { name: type, exact: true }).click();
    await page.getByRole('button', { name: 'Create property' }).click();
    await expect(page.getByRole('button', { name: `Column ${name}` })).toBeVisible();
  }

  const row = 'Book the Sintra train';
  await page.getByRole('textbox', { name: `Notes for ${row}` }).fill('Cheap off-peak');
  await page.getByRole('spinbutton', { name: `Score for ${row}` }).fill('7');
  await page.getByRole('textbox', { name: `Docs for ${row}` }).fill('https://cp.pt');
  await page.getByLabel(`Start for ${row}`).fill('2026-09-19');
  await page.getByRole('checkbox', { name: `Pinned for ${row}` }).check();

  // Select and multi-select options are created by the user, then reused.
  await page.getByRole('button', { name: `Phase for ${row}` }).click();
  await page.getByRole('textbox', { name: 'New Phase option' }).fill('Planning');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`cell-Phase-${row}`)).toContainText('Planning');

  await page.getByRole('button', { name: `Tags for ${row}` }).click();
  await page.getByRole('textbox', { name: 'New Tags option' }).fill('Rail');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`cell-Tags-${row}`)).toContainText('Rail');

  await page.waitForTimeout(400);
  await page.reload();

  await expect(page.getByRole('textbox', { name: `Notes for ${row}` })).toHaveValue('Cheap off-peak');
  await expect(page.getByRole('spinbutton', { name: `Score for ${row}` })).toHaveValue('7');
  await expect(page.getByRole('textbox', { name: `Docs for ${row}` })).toHaveValue('https://cp.pt');
  await expect(page.getByLabel(`Start for ${row}`)).toHaveValue('2026-09-19');
  await expect(page.getByRole('checkbox', { name: `Pinned for ${row}` })).toBeChecked();
  await expect(page.getByTestId(`cell-Phase-${row}`)).toContainText('Planning');
  await expect(page.getByTestId(`cell-Tags-${row}`)).toContainText('Rail');

  // The option the user made is offered on other rows of the same database.
  await page.getByRole('button', { name: 'Phase for Draft the Q3 plan' }).click();
  await page.getByRole('menuitem', { name: 'Planning' }).click();
  await expect(page.getByTestId('cell-Phase-Draft the Q3 plan')).toContainText('Planning');
});

test('a property can be renamed and deleted', async ({ page }) => {
  await openDatabase(page, 'Life', 'Reading List');

  await page.getByRole('button', { name: 'Column Rating' }).click();
  await page.getByRole('menuitem', { name: 'Rename property' }).click();
  const input = page.getByRole('textbox', { name: 'Property name' });
  await input.fill('Stars');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Column Stars' })).toBeVisible();

  await page.getByRole('button', { name: 'Column Stars' }).click();
  await page.getByRole('menuitem', { name: 'Delete property' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Column Stars' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Column Stars' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Column Rating' })).toHaveCount(0);
});

test('rows can be added, retitled and deleted', async ({ page }) => {
  await openDatabase(page, 'Life', 'Reading List');
  const rows = page.locator('.table tbody tr');
  const before = await rows.count();

  await page.getByRole('button', { name: 'New row' }).click();
  await expect(rows).toHaveCount(before + 1);

  const title = page.getByRole('textbox', { name: 'Title of Untitled' });
  await title.fill('Wolf Hall');
  await expect(page.getByTestId('row-Wolf Hall')).toBeVisible();

  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByTestId('row-Wolf Hall')).toBeVisible();
  await expect(rows).toHaveCount(before + 1);

  await page.getByRole('button', { name: 'Actions for Wolf Hall' }).click();
  await page.getByRole('menuitem', { name: 'Delete row' }).click();
  await expect(page.getByTestId('row-Wolf Hall')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('row-Wolf Hall')).toHaveCount(0);
  await expect(rows).toHaveCount(before);
});

test('a row opens as a page with properties above editable blocks', async ({ page }) => {
  await openDatabase(page, 'Life', 'Reading List');
  await page.getByRole('button', { name: 'Open Piranesi' }).click();

  await expect(page.getByTestId('page-title')).toHaveText('Piranesi');
  await expect(page.getByText('Entry', { exact: true })).toBeVisible();
  const props = page.getByTestId('row-properties');
  await expect(props).toBeVisible();
  await expect(props.getByRole('textbox', { name: 'Author for this entry' })).toHaveValue(
    'Susanna Clarke',
  );

  await props.getByRole('spinbutton', { name: 'Rating for this entry' }).fill('3');
  await page.getByRole('button', { name: 'Add a block' }).click();
  await page.keyboard.type('Read it twice.');

  await page.waitForTimeout(600);
  await page.reload();
  await expect(props.getByRole('spinbutton', { name: 'Rating for this entry' })).toHaveValue('3');
  await expect(page.locator('.block__text', { hasText: 'Read it twice.' })).toBeVisible();

  // The edited property is visible back in the table too.
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Reading List').click();
  await expect(page.getByRole('spinbutton', { name: 'Rating for Piranesi' })).toHaveValue('3');
});

test('the row property panel goes away when an ordinary page is opened', async ({ page }) => {
  await openDatabase(page, 'Life', 'Reading List');
  await page.getByRole('button', { name: 'Open Piranesi' }).click();
  await expect(page.getByTestId('row-properties')).toBeVisible();

  await treeRow(page, 'Recipes').click();
  await expect(page.getByTestId('page-title')).toHaveText('Recipes');
  await expect(page.getByTestId('row-properties')).toHaveCount(0);

  await treeRow(page, 'Reading List').click();
  await expect(page.getByTestId('database')).toBeVisible();
  await expect(page.getByTestId('row-properties')).toHaveCount(0);
});

test('deleting a database removes it and its rows', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New database' }).click();
  await expect(page.getByTestId('table-view')).toBeVisible();
  await page.getByRole('button', { name: 'New row' }).click();

  await treeRow(page, 'Untitled database').hover();
  await page.getByRole('button', { name: 'Actions for Untitled database' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(treeRow(page, 'Untitled database')).toHaveCount(0);
  await page.reload();
  await expect(treeRow(page, 'Untitled database')).toHaveCount(0);
});
