import { expect, type Locator, type Page, test } from '@playwright/test';
import { expandRow, openApp, treeRow } from './helpers.ts';

/** Opens a seeded page by its path from the tree root, and returns its blocks. */
async function openPage(page: Page, ...path: string[]): Promise<Locator> {
  await openApp(page);
  const title = path[path.length - 1];
  for (const parent of path.slice(0, -1)) await expandRow(page, parent);
  await treeRow(page, title).click();
  await expect(page.getByTestId('page-title')).toHaveText(title);
  return page.locator('.block');
}

function blockText(page: Page, text: string): Locator {
  return page.locator('.block').filter({ hasText: text }).first();
}

test('every seeded block type renders and looks distinct', async ({ page }) => {
  await openPage(page, 'Home');
  const types = await page.locator('.block').evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLElement).dataset.blockType),
  );
  for (const type of ['heading1', 'heading2', 'paragraph', 'bulleted', 'todo', 'callout', 'divider']) {
    expect(types).toContain(type);
  }

  const h1 = await blockText(page, 'Welcome to your space')
    .locator('.block__text')
    .evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
  const body = await blockText(page, 'Everything here is yours')
    .locator('.block__text')
    .evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
  expect(h1).toBeGreaterThan(body);
});

test('typing into a block saves automatically and there is no save button', async ({ page }) => {
  await openPage(page, 'Notes', 'Ideas');
  const target = blockText(page, 'Weeknotes, sent to nobody.').locator('.block__text');
  await target.click();
  await page.keyboard.press('End');
  await target.pressSequentially(' Yet.');

  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0);

  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('.block__text', { hasText: 'Weeknotes, sent to nobody. Yet.' })).toBeVisible();
});

test('Enter adds a block below and Backspace removes an empty one', async ({ page }) => {
  const blocks = await openPage(page, 'Notes', 'Ideas');
  const before = await blocks.count();

  const target = blockText(page, 'Weeknotes, sent to nobody.').locator('.block__text');
  await target.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(blocks).toHaveCount(before + 1);

  await page.keyboard.type('A new bullet');
  await expect(page.locator('.block__text', { hasText: 'A new bullet' })).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(blocks).toHaveCount(before + 2);
  await page.keyboard.press('Backspace');
  await expect(blocks).toHaveCount(before + 1);

  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('.block__text', { hasText: 'A new bullet' })).toBeVisible();
  await expect(page.locator('.block')).toHaveCount(before + 1);
});

test('the slash menu filters as you type and inserts by keyboard alone', async ({ page }) => {
  const blocks = await openPage(page, 'Notes', 'Ideas');
  await blocks.last().locator('.block__text').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');

  await page.keyboard.type('/');
  const menu = page.getByTestId('slash-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(11);

  // It must stay fully on screen and never cover the line being typed into.
  // Measured in the page, so both rectangles use viewport coordinates.
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector('.slash')!.getBoundingClientRect();
    const block = [...document.querySelectorAll('.block')].pop()!.getBoundingClientRect();
    return {
      clearOfBlock: panel.top >= block.bottom || panel.bottom <= block.top,
      onScreen:
        panel.top >= 0 &&
        panel.left >= 0 &&
        panel.bottom <= window.innerHeight &&
        panel.right <= window.innerWidth,
      close: Math.min(Math.abs(panel.top - block.bottom), Math.abs(block.top - panel.bottom)),
    };
  });
  expect(geometry.clearOfBlock).toBe(true);
  expect(geometry.onScreen).toBe(true);
  expect(geometry.close).toBeLessThan(40);

  await page.keyboard.type('quo');
  await expect(menu.getByRole('menuitem')).toHaveCount(1);
  await expect(menu.getByRole('menuitem').first()).toContainText('Quote');

  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await page.keyboard.type('Keyboard only');

  const quote = page.locator('[data-block-type="quote"]', { hasText: 'Keyboard only' });
  await expect(quote).toBeVisible();

  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('[data-block-type="quote"]', { hasText: 'Keyboard only' })).toBeVisible();
});

test('the slash menu can be driven with the arrow keys and the mouse', async ({ page }) => {
  const blocks = await openPage(page, 'Notes', 'Ideas');
  await blocks.last().locator('.block__text').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');

  await page.keyboard.type('/');
  const menu = page.getByTestId('slash-menu');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem').nth(2)).toHaveClass(/slash__item--active/);
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitem').nth(1)).toHaveClass(/slash__item--active/);

  await menu.getByRole('menuitem', { name: 'Code' }).click();
  await page.keyboard.type('npm start');
  await expect(page.locator('[data-block-type="code"]', { hasText: 'npm start' })).toBeVisible();
});

test('every block type can be inserted from the slash menu', async ({ page }) => {
  const blocks = await openPage(page, 'Home', 'Inbox');
  await blocks.last().locator('.block__text').click();
  await page.keyboard.press('End');

  const labels = [
    'Text',
    'Heading 1',
    'Heading 2',
    'Heading 3',
    'Bulleted list',
    'Numbered list',
    'To-do',
    'Quote',
    'Divider',
    'Code',
    'Callout',
  ];
  const expected = [
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
  ];

  for (const label of labels) {
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    await page.getByTestId('slash-menu').getByRole('menuitem', { name: label, exact: true }).click();
    if (label !== 'Divider') await page.keyboard.type(`${label} block`);
  }

  for (const type of expected) {
    await expect(page.locator(`[data-block-type="${type}"]`).first()).toBeVisible();
  }
});

test('to-do checkboxes toggle and persist', async ({ page }) => {
  await openPage(page, 'Home', 'Inbox');
  const todo = page.getByRole('checkbox', { name: /Reply to the neighbourhood/ });
  await expect(todo).not.toBeChecked();
  await todo.check();
  await expect(todo).toBeChecked();

  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Reply to the neighbourhood/ })).toBeChecked();
});

test('a block can be dragged to a new position and the order sticks', async ({ page }) => {
  const blocks = await openPage(page, 'Notes', 'Ideas');
  const textOf = () => blocks.locator('.block__text').allTextContents();

  const before = await textOf();
  const source = blocks.nth(4);
  const target = blocks.nth(1);
  const moved = before[4];

  const handle = source.getByLabel(/drag handle/);
  await source.hover();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('missing bounding boxes');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 20, { steps: 10 });
  await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();

  const after = await textOf();
  expect(after).not.toEqual(before);
  expect(after.indexOf(moved)).toBeLessThan(before.indexOf(moved));
  expect(new Set(after)).toEqual(new Set(before));

  await page.reload();
  expect(await blocks.locator('.block__text').allTextContents()).toEqual(after);
});
