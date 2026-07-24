import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

interface SeedProperty {
  name: string;
  type: string;
  options?: { id: string; label: string; color: string }[];
}

interface SeedRow {
  title: string;
  cells: { [propName: string]: any };
}

interface SeedDatabase {
  properties: SeedProperty[];
  rows: SeedRow[];
}

interface SeedPage {
  title: string;
  icon: string;
  type?: 'page' | 'database';
  children?: SeedPage[];
  content?: any;
  database?: SeedDatabase;
}

const editorDemoContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to the Editor' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'This page demonstrates every block type in Personal Space.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Text blocks' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'This is a regular paragraph. You can make text ' }, { type: 'text', marks: [{ type: 'bold' }], text: 'bold' }, { type: 'text', text: ', ' }, { type: 'text', marks: [{ type: 'italic' }], text: 'italic' }, { type: 'text', text: ', or ' }, { type: 'text', marks: [{ type: 'underline' }], text: 'underlined' }, { type: 'text', text: '.' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Lists' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second item' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third item' }] }] },
    ]},
    { type: 'orderedList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step two' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step three' }] }] },
    ]},
    { type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done task' }] }] },
      { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pending task' }] }] },
    ]},
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Quotes and code' }] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The best way to predict the future is to invent it.' }] }] },
    { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: 'function hello() {\n  console.log("Hello, World!");\n}' }] },
    { type: 'horizontalRule' },
    { type: 'paragraph', content: [{ type: 'text', text: 'A divider separates sections above.' }] },
    { type: 'callout', content: [{ type: 'text', text: 'This is a callout block — use it to highlight important information.' }] },
  ],
};

const travelPlansDb: SeedDatabase = {
  properties: [
    { name: 'Destination', type: 'text' },
    { name: 'Budget', type: 'number' },
    { name: 'Status', type: 'select', options: [
      { id: 'tp-status-planning', label: 'Planning', color: 'blue' },
      { id: 'tp-status-booked', label: 'Booked', color: 'green' },
      { id: 'tp-status-progress', label: 'In Progress', color: 'orange' },
      { id: 'tp-status-completed', label: 'Completed', color: 'gray' },
    ]},
    { name: 'Dates', type: 'date' },
  ],
  rows: [
    { title: 'Japan Trip', cells: { Destination: 'Tokyo, Japan', Budget: 5000, Status: 'tp-status-booked', Dates: '2026-09-15' } },
    { title: 'Paris Getaway', cells: { Destination: 'Paris, France', Budget: 3500, Status: 'tp-status-planning', Dates: '2026-11-01' } },
    { title: 'New York City', cells: { Destination: 'New York, USA', Budget: 2500, Status: 'tp-status-progress', Dates: '2026-07-20' } },
    { title: 'Bali Retreat', cells: { Destination: 'Bali, Indonesia', Budget: 2000, Status: 'tp-status-planning', Dates: '2027-01-10' } },
    { title: 'London Adventure', cells: { Destination: 'London, UK', Budget: 4000, Status: 'tp-status-booked', Dates: '2026-10-05' } },
    { title: 'Rome Holiday', cells: { Destination: 'Rome, Italy', Budget: 3000, Status: 'tp-status-planning', Dates: '2027-03-15' } },
    { title: 'Barcelona Trip', cells: { Destination: 'Barcelona, Spain', Budget: 2800, Status: 'tp-status-completed', Dates: '2026-05-01' } },
    { title: 'Sydney Explorer', cells: { Destination: 'Sydney, Australia', Budget: 5500, Status: 'tp-status-planning', Dates: '2027-06-20' } },
  ],
};

const readingListDb: SeedDatabase = {
  properties: [
    { name: 'Author', type: 'text' },
    { name: 'Status', type: 'select', options: [
      { id: 'rl-status-to-read', label: 'To Read', color: 'blue' },
      { id: 'rl-status-reading', label: 'Reading', color: 'orange' },
      { id: 'rl-status-finished', label: 'Finished', color: 'green' },
    ]},
    { name: 'Rating', type: 'number' },
    { name: 'URL', type: 'url' },
  ],
  rows: [
    { title: 'Project Hail Mary', cells: { Author: 'Andy Weir', Status: 'rl-status-finished', Rating: 5, URL: 'https://example.com/project-hail-mary' } },
    { title: 'The Pragmatic Programmer', cells: { Author: 'David Thomas', Status: 'rl-status-reading', Rating: 4, URL: 'https://example.com/pragmatic-programmer' } },
    { title: 'Designing Data-Intensive Applications', cells: { Author: 'Martin Kleppmann', Status: 'rl-status-to-read', Rating: 0, URL: 'https://example.com/ddia' } },
    { title: 'Dune', cells: { Author: 'Frank Herbert', Status: 'rl-status-finished', Rating: 5, URL: 'https://example.com/dune' } },
    { title: 'The Midnight Library', cells: { Author: 'Matt Haig', Status: 'rl-status-reading', Rating: 3, URL: 'https://example.com/midnight-library' } },
    { title: 'Atomic Habits', cells: { Author: 'James Clear', Status: 'rl-status-finished', Rating: 4, URL: 'https://example.com/atomic-habits' } },
    { title: 'Neuromancer', cells: { Author: 'William Gibson', Status: 'rl-status-to-read', Rating: 0, URL: 'https://example.com/neuromancer' } },
    { title: 'The Art of War', cells: { Author: 'Sun Tzu', Status: 'rl-status-finished', Rating: 4, URL: 'https://example.com/art-of-war' } },
    { title: 'Clean Code', cells: { Author: 'Robert C. Martin', Status: 'rl-status-to-read', Rating: 0, URL: 'https://example.com/clean-code' } },
    { title: 'Sapiens', cells: { Author: 'Yuval Noah Harari', Status: 'rl-status-reading', Rating: 4, URL: 'https://example.com/sapiens' } },
  ],
};

const SEED_PAGES: SeedPage[] = [
  {
    title: 'Welcome to Personal Space',
    icon: '👋',
    children: [
      {
        title: 'Getting Started',
        icon: '🚀',
        children: [
          { title: 'Keyboard Shortcuts', icon: '⌨️' },
          { title: 'Tips & Tricks', icon: '💡' },
        ],
      },
      { title: "What's New", icon: '✨' },
      { title: 'Editor Demo', icon: '✏️', content: editorDemoContent },
    ],
  },
  {
    title: 'Projects',
    icon: '📋',
    children: [
      { title: 'Website Redesign', icon: '🎨' },
      { title: 'Mobile App', icon: '📱' },
      { title: 'Research Paper', icon: '📄' },
    ],
  },
  {
    title: 'Travel Plans',
    icon: '✈️',
    type: 'database',
    database: travelPlansDb,
  },
  {
    title: 'Reading List',
    icon: '📚',
    type: 'database',
    database: readingListDb,
  },
  {
    title: 'Recipes',
    icon: '🍳',
    children: [
      { title: 'Pasta Carbonara', icon: '🍝' },
      { title: 'Thai Green Curry', icon: '🍛' },
    ],
  },
  {
    title: 'Notes',
    icon: '📝',
    children: [
      { title: 'Meeting Notes', icon: '📋' },
      { title: 'Ideas', icon: '💭' },
    ],
  },
];

function createDatabase(
  db: Database.Database,
  pageId: string,
  database: SeedDatabase,
  now: string
): void {
  const propIdMap: Record<string, string> = {};

  for (let i = 0; i < database.properties.length; i++) {
    const prop = database.properties[i];
    const propId = uuidv4();
    propIdMap[prop.name] = propId;

    const optionsStr = prop.options ? JSON.stringify(prop.options) : '[]';
    db.prepare(
      'INSERT INTO properties (id, database_id, name, type, position, options, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(propId, pageId, prop.name, prop.type, i, optionsStr, now);
  }

  for (const row of database.rows) {
    const rowId = uuidv4();
    db.prepare(
      'INSERT INTO pages (id, parent_id, title, icon, type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(rowId, pageId, row.title, '', 'row', JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }), now, now);

    const rowPos = database.rows.indexOf(row);
    db.prepare(
      'INSERT INTO rows (id, database_id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(rowId, pageId, row.title, rowPos, now, now);

    for (const [propName, value] of Object.entries(row.cells)) {
      const propId = propIdMap[propName];
      if (!propId) continue;
      const cellId = uuidv4();
      const serialized = JSON.stringify(value);
      db.prepare(
        'INSERT INTO cell_values (id, row_id, property_id, value) VALUES (?, ?, ?, ?)'
      ).run(cellId, rowId, propId, serialized);
    }
  }
}

export function seedDb(db: Database.Database): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number };
  if (existing.count > 0) {
    return;
  }

  const now = new Date().toISOString();

  function insertPage(page: SeedPage, parentId: string | null = null): string {
    const id = uuidv4();
    const pageType = page.type || 'page';
    db.prepare(
      'INSERT INTO pages (id, parent_id, title, icon, type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, parentId, page.title, page.icon, pageType, page.content ? JSON.stringify(page.content) : JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }), now, now);

    if (pageType === 'database' && page.database) {
      createDatabase(db, id, page.database, now);
    }

    if (page.children) {
      for (const child of page.children) {
        insertPage(child, id);
      }
    }

    return id;
  }

  for (const page of SEED_PAGES) {
    insertPage(page);
  }
}
