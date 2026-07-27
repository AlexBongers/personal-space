import type { DB } from './db.js';
import { type CreateBlockInput, setBlocks } from './repo/blocks.js';
import { createDatabase } from './repo/databases.js';
import { createPage } from './repo/pages.js';
import { createProperty } from './repo/properties.js';
import { createRow } from './repo/rows.js';
import { listViews, updateView } from './repo/views.js';
import type { PropertyType, SelectOption, ViewKind } from './types.js';

interface SeedProperty {
  key: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[];
}

interface SeedRow {
  title: string;
  values: Record<string, unknown>;
  blocks?: CreateBlockInput[];
}

interface SeedView {
  kind: ViewKind;
  groupBy?: string;
  sort?: { key: string; direction: 'asc' | 'desc' };
  filters?: { key: string; operator: string; value: unknown }[];
}

interface SeedDatabase {
  title: string;
  icon: string;
  properties: SeedProperty[];
  rows: SeedRow[];
  views?: SeedView[];
}

interface SeedPage {
  title: string;
  icon: string;
  blocks?: CreateBlockInput[];
  children?: SeedPage[];
  database?: SeedDatabase;
}

const p = (text: string): CreateBlockInput => ({ type: 'paragraph', text });
const h1 = (text: string): CreateBlockInput => ({ type: 'heading1', text });
const h2 = (text: string): CreateBlockInput => ({ type: 'heading2', text });
const h3 = (text: string): CreateBlockInput => ({ type: 'heading3', text });
const li = (text: string): CreateBlockInput => ({ type: 'bulleted', text });
const num = (text: string): CreateBlockInput => ({ type: 'numbered', text });
const todo = (text: string, checked = false): CreateBlockInput => ({ type: 'todo', text, checked });
const quote = (text: string): CreateBlockInput => ({ type: 'quote', text });
const code = (text: string): CreateBlockInput => ({ type: 'code', text });
const callout = (text: string): CreateBlockInput => ({ type: 'callout', text });
const divider = (): CreateBlockInput => ({ type: 'divider' });

const option = (id: string, name: string, color: SelectOption['color']): SelectOption => ({
  id,
  name,
  color,
});

const TASKS: SeedDatabase = {
  title: 'Tasks',
  icon: '✅',
  properties: [
    {
      key: 'status',
      name: 'Status',
      type: 'select',
      options: [
        option('st_backlog', 'Backlog', 'gray'),
        option('st_doing', 'In progress', 'blue'),
        option('st_blocked', 'Blocked', 'red'),
        option('st_done', 'Done', 'green'),
      ],
    },
    {
      key: 'priority',
      name: 'Priority',
      type: 'select',
      options: [
        option('pr_low', 'Low', 'gray'),
        option('pr_med', 'Medium', 'amber'),
        option('pr_high', 'High', 'red'),
      ],
    },
    {
      key: 'area',
      name: 'Area',
      type: 'multi_select',
      options: [
        option('ar_ps', 'Personal Space', 'purple'),
        option('ar_kitchen', 'Kitchen', 'amber'),
        option('ar_admin', 'Admin', 'gray'),
        option('ar_travel', 'Travel', 'blue'),
      ],
    },
    { key: 'due', name: 'Due', type: 'date' },
    { key: 'effort', name: 'Effort (h)', type: 'number' },
    { key: 'blocked', name: 'Needs someone else', type: 'checkbox' },
    { key: 'link', name: 'Link', type: 'url' },
  ],
  views: [
    { kind: 'board', groupBy: 'status' },
    { kind: 'table', sort: { key: 'due', direction: 'asc' } },
  ],
  rows: [
    {
      title: 'Ship the board view',
      values: {
        status: 'st_doing',
        priority: 'pr_high',
        area: ['ar_ps'],
        due: '2026-08-07',
        effort: 6,
        blocked: false,
        link: 'https://dndkit.com',
      },
      blocks: [
        { type: 'paragraph', text: 'Cards grouped by status, dragged between columns.' },
        { type: 'todo', text: 'Column layout', checked: true },
        { type: 'todo', text: 'Drag to change the value' },
      ],
    },
    {
      title: 'Write the filter UI',
      values: {
        status: 'st_backlog',
        priority: 'pr_med',
        area: ['ar_ps'],
        due: '2026-08-14',
        effort: 4,
        blocked: false,
      },
    },
    {
      title: 'Pick the worktop',
      values: {
        status: 'st_blocked',
        priority: 'pr_high',
        area: ['ar_kitchen'],
        due: '2026-08-03',
        effort: 2,
        blocked: true,
      },
      blocks: [
        { type: 'callout', text: 'Waiting on the sample from the supplier.' },
        { type: 'paragraph', text: 'Shortlist: honed granite, or the cheaper composite.' },
      ],
    },
    {
      title: 'Book the Sintra train',
      values: {
        status: 'st_backlog',
        priority: 'pr_low',
        area: ['ar_travel'],
        due: '2026-09-20',
        effort: 1,
        blocked: false,
      },
    },
    {
      title: 'Renew the travel insurance',
      values: {
        status: 'st_backlog',
        priority: 'pr_med',
        area: ['ar_travel', 'ar_admin'],
        due: '2026-09-01',
        effort: 1,
        blocked: false,
      },
    },
    {
      title: 'Seed the workspace',
      values: {
        status: 'st_done',
        priority: 'pr_med',
        area: ['ar_ps'],
        due: '2026-07-18',
        effort: 3,
        blocked: false,
      },
    },
    {
      title: 'Chase the plumber quote',
      values: {
        status: 'st_blocked',
        priority: 'pr_med',
        area: ['ar_kitchen', 'ar_admin'],
        due: '2026-08-01',
        effort: 1,
        blocked: true,
      },
    },
    {
      title: 'Draft the Q3 plan',
      values: {
        status: 'st_doing',
        priority: 'pr_high',
        area: ['ar_admin'],
        due: '2026-07-31',
        effort: 5,
        blocked: false,
      },
    },
    {
      title: 'Replace the kitchen tap',
      values: {
        status: 'st_done',
        priority: 'pr_low',
        area: ['ar_kitchen'],
        due: '2026-07-10',
        effort: 2,
        blocked: false,
      },
    },
  ],
};

const READING: SeedDatabase = {
  title: 'Reading List',
  icon: '📚',
  properties: [
    { key: 'author', name: 'Author', type: 'text' },
    {
      key: 'shelf',
      name: 'Shelf',
      type: 'select',
      options: [
        option('sh_now', 'Reading', 'blue'),
        option('sh_next', 'Up next', 'amber'),
        option('sh_done', 'Finished', 'green'),
        option('sh_stop', 'Abandoned', 'red'),
      ],
    },
    {
      key: 'genre',
      name: 'Genre',
      type: 'multi_select',
      options: [
        option('ge_fiction', 'Fiction', 'purple'),
        option('ge_history', 'History', 'amber'),
        option('ge_tech', 'Technology', 'blue'),
        option('ge_essays', 'Essays', 'gray'),
      ],
    },
    { key: 'rating', name: 'Rating', type: 'number' },
    { key: 'finished', name: 'Finished', type: 'date' },
    { key: 'owned', name: 'On the shelf', type: 'checkbox' },
    { key: 'link', name: 'Link', type: 'url' },
  ],
  views: [
    { kind: 'board', groupBy: 'shelf' },
    { kind: 'list', filters: [{ key: 'shelf', operator: 'is', value: 'sh_done' }] },
  ],
  rows: [
    {
      title: 'The Making of the Atomic Bomb',
      values: {
        author: 'Richard Rhodes',
        shelf: 'sh_done',
        genre: ['ge_history'],
        rating: 5,
        finished: '2026-03-12',
        owned: true,
      },
      blocks: [
        { type: 'quote', text: 'Physics, politics and consequence, told as one story.' },
        { type: 'paragraph', text: 'Long, and worth every page.' },
      ],
    },
    {
      title: 'Piranesi',
      values: {
        author: 'Susanna Clarke',
        shelf: 'sh_done',
        genre: ['ge_fiction'],
        rating: 5,
        finished: '2026-05-02',
        owned: false,
      },
    },
    {
      title: 'The Idea Factory',
      values: {
        author: 'Jon Gertner',
        shelf: 'sh_now',
        genre: ['ge_history', 'ge_tech'],
        rating: 4,
        owned: true,
        link: 'https://en.wikipedia.org/wiki/Bell_Labs',
      },
    },
    {
      title: 'Thinking in Systems',
      values: {
        author: 'Donella Meadows',
        shelf: 'sh_next',
        genre: ['ge_tech', 'ge_essays'],
        owned: true,
      },
    },
    {
      title: 'A Pattern Language',
      values: {
        author: 'Christopher Alexander',
        shelf: 'sh_next',
        genre: ['ge_tech'],
        owned: false,
      },
    },
    {
      title: 'Infinite Jest',
      values: {
        author: 'David Foster Wallace',
        shelf: 'sh_stop',
        genre: ['ge_fiction'],
        rating: 2,
        owned: true,
      },
      blocks: [{ type: 'paragraph', text: 'Stopped at page 300. Maybe another year.' }],
    },
    {
      title: 'The Shipping News',
      values: {
        author: 'Annie Proulx',
        shelf: 'sh_done',
        genre: ['ge_fiction'],
        rating: 4,
        finished: '2026-01-24',
        owned: true,
      },
    },
    {
      title: 'Empire of Pain',
      values: {
        author: 'Patrick Radden Keefe',
        shelf: 'sh_now',
        genre: ['ge_history', 'ge_essays'],
        owned: false,
      },
    },
  ],
};

/** The workspace a fresh install opens with. */
const WORKSPACE: SeedPage[] = [
  {
    title: 'Home',
    icon: '🏠',
    blocks: [
      h1('Welcome to your space'),
      p('Everything here is yours, stored on this machine, in one SQLite file. No account, no cloud.'),
      callout('Press the slash key anywhere in a page to insert a block.'),
      h2('Where things live'),
      li('Projects — anything with an end date.'),
      li('Notes — the raw material: meetings, ideas, half-thoughts.'),
      li('Life — travel, food, the rest of it.'),
      divider(),
      h2('This week'),
      todo('Book the Lisbon flights', true),
      todo('Draft the Q3 plan'),
      todo('Replace the kitchen tap'),
    ],
    children: [
      {
        title: 'Weekly Review',
        icon: '🗓️',
        blocks: [
          h1('Weekly review'),
          quote('A week you do not review is a week you cannot learn from.'),
          h3('Three questions'),
          num('What actually moved?'),
          num('What did I avoid, and why?'),
          num('What is the one thing for next week?'),
          divider(),
          p('Answer in one line each. If it takes a paragraph, it is not clear yet.'),
        ],
      },
      {
        title: 'Inbox',
        icon: '📥',
        blocks: [
          p('Unsorted. Empty this every Friday.'),
          todo('Reply to the neighbourhood association'),
          todo('Find the receipt for the espresso grinder'),
          todo('Chase the plumber quote', true),
        ],
      },
    ],
  },
  {
    title: 'Projects',
    icon: '🚀',
    blocks: [
      h1('Projects'),
      p('Live work, with an end in sight. Anything without one belongs in Notes.'),
      callout('The Tasks database below the tree tracks the detail — this page holds the shape.'),
    ],
    children: [
      {
        title: 'Personal Space',
        icon: '🧩',
        blocks: [
          h1('Personal Space'),
          p('A private, local knowledge manager. One user, no login, everything on disk.'),
          h2('Principles'),
          li('Fast to open, fast to type into.'),
          li('Nothing leaves the machine.'),
          li('Boring technology, chosen on purpose.'),
          h2('Stack'),
          code('server: node + express + sqlite\nclient: react + vite\ntests:  vitest + playwright'),
          quote('If it needs a manual, it is not finished.'),
        ],
        children: [
          {
            title: 'Design Notes',
            icon: '🎨',
            blocks: [
              h1('Design notes'),
              h2('Palette'),
              p('Amber leads, blue supports, purple accents. Everything else is gray.'),
              code('--amber: #ecad0a;\n--blue:  #209dd7;\n--purple: #753991;'),
              h2('Rules'),
              li('Flat surfaces. No gradients.'),
              li('Type does the work: weight and size, not decoration.'),
              li('Dark mode is designed, not derived.'),
              callout('When in doubt, remove the border and increase the contrast.'),
            ],
          },
          {
            title: 'Technical Spikes',
            icon: '🔬',
            blocks: [
              h1('Spikes'),
              h3('Block ordering'),
              p('Integer positions, rewritten on drop. Simple, and the pages are small.'),
              h3('Drag and drop'),
              p('dnd-kit for both block reordering and board cards — one mental model.'),
              divider(),
              code("await api.reorderBlocks(pageId, ids)\n// positions are rewritten in one transaction"),
            ],
          },
        ],
      },
      { title: TASKS.title, icon: TASKS.icon, database: TASKS },
      {
        title: 'Kitchen Renovation',
        icon: '🔨',
        blocks: [
          h1('Kitchen'),
          callout('Budget is the constraint. Every choice below is measured against it.'),
          h2('Sequence'),
          num('Strip the old units'),
          num('Electrics and plumbing first fix'),
          num('Floor, then carpentry'),
          num('Second fix, then paint'),
          h2('Open questions'),
          todo('Induction or gas?'),
          todo('Keep the hatch or close it up', true),
          quote('Measure the fridge before ordering anything.'),
        ],
      },
    ],
  },
  {
    title: 'Notes',
    icon: '📓',
    blocks: [
      h1('Notes'),
      p('Raw material. Nothing here has to be finished.'),
    ],
    children: [
      {
        title: 'Meeting Notes',
        icon: '💬',
        blocks: [
          h1('Meetings'),
          h3('Studio catch-up'),
          li('Agreed the launch slips two weeks.'),
          li('Pricing page needs a rewrite before anything else.'),
          todo('Send the revised timeline'),
          divider(),
          h3('Supplier call'),
          li('Lead time is six weeks, not four.'),
          quote('Assume six, plan for eight.'),
        ],
      },
      {
        title: 'Ideas',
        icon: '💡',
        blocks: [
          h1('Ideas'),
          p('Cheap to write down, expensive to forget.'),
          li('A reading log that tracks why a book was abandoned.'),
          li('A recipe page that scales quantities as you type.'),
          li('Weeknotes, sent to nobody.'),
          callout('Most of these are bad. That is the point of the list.'),
        ],
      },
    ],
  },
  {
    title: 'Life',
    icon: '🌿',
    blocks: [h1('Life'), p('The part that is not work.')],
    children: [
      {
        title: 'Travel',
        icon: '✈️',
        blocks: [
          h1('Travel'),
          p('Trips taken and trips wanted.'),
          h2('Rules of thumb'),
          li('Two nights minimum, or it is a commute.'),
          li('Book the return before the outbound.'),
        ],
        children: [
          {
            title: 'Lisbon 2026',
            icon: '🇵🇹',
            blocks: [
              h1('Lisbon, October'),
              callout('Five nights. Alfama for the first two, Príncipe Real after.'),
              h2('Before we go'),
              todo('Flights', true),
              todo('Apartment in Alfama', true),
              todo('Table at the seafood place'),
              todo('Renew the travel insurance'),
              h2('Shortlist'),
              li('Tram 28, early, before the queues.'),
              li('Miradouro da Senhora do Monte at sunset.'),
              li('Day trip to Sintra, midweek.'),
              divider(),
              quote('Walk the hills in the morning, eat late, sleep late.'),
            ],
          },
        ],
      },
      { title: READING.title, icon: READING.icon, database: READING },
      {
        title: 'Recipes',
        icon: '🍜',
        blocks: [
          h1('Recipes'),
          h2('Weeknight ramen'),
          p('Thirty minutes, one pot, no apologies.'),
          num('Soften garlic and ginger in sesame oil.'),
          num('Stock, soy, a spoon of miso. Simmer ten minutes.'),
          num('Noodles in last, then the egg.'),
          code('stock   700ml\nmiso    1 tbsp\nsoy     2 tbsp\nnoodles 2 nests'),
          callout('The egg goes in off the heat, or it turns to rubber.'),
        ],
      },
    ],
  },
];

function insertDatabase(db: DB, spec: SeedDatabase, parentId: string | null): void {
  const page = createDatabase(db, {
    parentId,
    title: spec.title,
    icon: spec.icon,
    withStatus: false,
  });

  const propertyIds = new Map<string, string>();
  for (const property of spec.properties) {
    const created = createProperty(db, page.id, {
      name: property.name,
      type: property.type,
      options: property.options,
    });
    propertyIds.set(property.key, created.id);
  }

  for (const row of spec.rows) {
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row.values)) {
      const id = propertyIds.get(key);
      if (id) values[id] = value;
    }
    const created = createRow(db, page.id, { title: row.title, values });
    if (row.blocks) setBlocks(db, created.id, row.blocks);
  }

  const views = listViews(db, page.id);
  for (const config of spec.views ?? []) {
    const view = views.find((v) => v.kind === config.kind);
    if (!view) continue;
    updateView(db, view.id, {
      groupPropertyId: config.groupBy ? (propertyIds.get(config.groupBy) ?? null) : undefined,
      sort: config.sort
        ? { propertyId: propertyIds.get(config.sort.key)!, direction: config.sort.direction }
        : undefined,
      filters: config.filters?.map((filter, index) => ({
        id: `${view.id}_f${index}`,
        propertyId: propertyIds.get(filter.key)!,
        operator: filter.operator as never,
        value: filter.value as never,
      })),
    });
  }
}

function insert(db: DB, pages: SeedPage[], parentId: string | null): void {
  for (const page of pages) {
    if (page.database) {
      insertDatabase(db, page.database, parentId);
      continue;
    }
    const created = createPage(db, { parentId, title: page.title, icon: page.icon });
    if (page.blocks) setBlocks(db, created.id, page.blocks);
    if (page.children) insert(db, page.children, created.id);
  }
}

export function isEmpty(db: DB): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM pages').get() as { n: number };
  return row.n === 0;
}

/** Populates an empty database with the showcase workspace. */
export function seed(db: DB): void {
  db.transaction(() => insert(db, WORKSPACE, null))();
}

export function seedIfEmpty(db: DB): void {
  if (isEmpty(db)) seed(db);
}
