import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

interface SeedPage {
  title: string;
  icon: string;
  children?: SeedPage[];
}

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
      'INSERT INTO pages (id, parent_id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, parentId, page.title, page.icon, 'page', now, now);

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