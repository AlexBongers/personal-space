import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

interface SeedPage {
  title: string;
  icon: string;
  children?: SeedPage[];
  content?: any;
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
    children: [
      { title: 'Japan Trip', icon: '🗾' },
      { title: 'Weekend Getaway', icon: '🏖️' },
    ],
  },
  {
    title: 'Reading List',
    icon: '📚',
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

export function seedDb(db: Database.Database): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number };
  if (existing.count > 0) {
    return;
  }

  const now = new Date().toISOString();

  function insertPage(page: SeedPage, parentId: string | null = null): string {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO pages (id, parent_id, title, icon, type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, parentId, page.title, page.icon, 'page', page.content ? JSON.stringify(page.content) : JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }), now, now);

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