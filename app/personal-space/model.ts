import type {
  Block,
  BlockType,
  CellValue,
  Database,
  Filter,
  FilterOperator,
  Item,
  Page,
  Property,
  PropertyType,
  Row,
  SelectOption,
  ViewMode,
  ViewSettings,
} from "./types";

export const STORAGE_KEYS = {
  items: "personal-space-items",
  theme: "personal-space-theme",
  seedVersion: "personal-space-seed-version",
} as const;

export const SEED_VERSION = "4";
export const palette = ["#209dd7", "#ecad0a", "#753991", "#35a77c", "#e36b55", "#6c7a89"];

export const blockLabels: Record<BlockType, string> = {
  paragraph: "Text",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  bulleted: "Bulleted list",
  numbered: "Numbered list",
  todo: "To-do",
  quote: "Quote",
  divider: "Divider",
  code: "Code",
  callout: "Callout",
};

export const propertyLabels: Record<PropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  "multi-select": "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
};

export const filterOperatorLabels: Record<FilterOperator, string> = {
  contains: "contains",
  is: "is",
  "is-not": "is not",
  before: "before",
  after: "after",
  checked: "is checked",
  unchecked: "is not checked",
};

export const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

export const createBlock = (type: BlockType, text = "", checked = false): Block => ({
  id: uid("block"),
  type,
  text,
  checked,
});

export const createOption = (label: string, color: string): SelectOption => ({
  id: uid("option"),
  label,
  color,
});

export const compactText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const defaultFilterOperator = (property: Property | undefined): FilterOperator => {
  if (property?.type === "checkbox") return "checked";
  if (property?.type === "date") return "after";
  if (property?.type === "select") return "is";
  return "contains";
};

export const emptyView = (mode: ViewMode): ViewSettings => ({
  mode,
  groupBy: "",
  filters: [],
  sortBy: "",
  sortDir: "asc",
});

export const isDatabase = (item: Item | undefined): item is Database => item?.kind === "database";
export const isPage = (item: Item | undefined): item is Page => item?.kind === "page";
export const getValue = (row: Row, propertyId: string): CellValue => row.values[propertyId] ?? null;
export const valueText = (value: CellValue): string =>
  Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value);

export const matchesFilter = (row: Row, property: Property, filter: Filter) => {
  const value = getValue(row, property.id);
  const query = filter.query.trim().toLowerCase();
  if (filter.operator === "checked") return Boolean(value);
  if (filter.operator === "unchecked") return !value;
  if (!query) return true;
  const text = valueText(value).toLowerCase();
  if (filter.operator === "is") return text === query;
  if (filter.operator === "is-not") return text !== query;
  if (filter.operator === "before") return text !== "" && text < query;
  if (filter.operator === "after") return text !== "" && text > query;
  return text.includes(query);
};

const migrateBlockCopy = (entry: Block): Block => entry.text === "Personal Space keeps projects, plans and ideas close at hand. Everything is stored in this browser, ready when you are."
  ? { ...entry, text: "Personal Space keeps projects, plans and ideas close at hand. Everything is synced to your private D1 database, ready wherever you open this space." }
  : entry;

export const normalizeItems = (rawItems: Item[]): Item[] =>
  rawItems.map((item) => {
    if (item.kind !== "database") return { ...item, blocks: item.blocks.map(migrateBlockCopy) };
    const normalizeView = (rawView: ViewSettings | undefined, mode: ViewMode): ViewSettings => {
      const source = rawView || emptyView(mode);
      return {
        ...emptyView(mode),
        ...source,
        mode,
        filters: (source.filters || []).map((filter) => ({
          ...filter,
          operator:
            filter.operator ||
            defaultFilterOperator(item.properties.find((property) => property.id === filter.propertyId)),
        })),
      };
    };
    const active = normalizeView(item.view, item.view?.mode || "table");
    const views = {
      table: normalizeView(item.views?.table || (active.mode === "table" ? active : undefined), "table"),
      board: normalizeView(item.views?.board || (active.mode === "board" ? active : undefined), "board"),
      list: normalizeView(item.views?.list || (active.mode === "list" ? active : undefined), "list"),
    };
    return {
      ...item,
      rows: item.rows.map((row) => ({ ...row, blocks: row.blocks.map(migrateBlockCopy) })),
      view: active,
      views,
    };
  });

const seedBlocks = (): Block[] => [
  createBlock("heading1", "A calm place for busy minds"),
  createBlock(
    "paragraph",
    "Personal Space keeps projects, plans and ideas close at hand. Everything is synced to your private D1 database, ready wherever you open this space.",
  ),
  createBlock(
    "callout",
    "Start with the sidebar. Create a page, open a database, or press ⌘K to find anything in your workspace.",
  ),
  createBlock("heading2", "This week"),
  createBlock("bulleted", "Ship the first Personal Space release"),
  createBlock("bulleted", "Read one chapter before bed"),
  createBlock("todo", "Sketch the spring travel route"),
  createBlock("quote", "A good workspace makes the next useful action obvious."),
  createBlock("code", "const focus = 'one useful thing';"),
  createBlock("divider"),
  createBlock("heading3", "A tiny field guide"),
  createBlock("numbered", "Capture the thought"),
  createBlock("numbered", "Give it a shape"),
  createBlock("numbered", "Make it easy to return to"),
];

const stabilizeSeedIds = (items: Item[]): Item[] => items.map((item) => {
  if (item.kind === "page") {
    return {
      ...item,
      blocks: item.blocks.map((entry, index) => ({ ...entry, id: `${item.id}-block-${index + 1}` })),
    };
  }
  return {
    ...item,
    properties: item.properties.map((property) => ({
      ...property,
      options: property.options?.map((entry, index) => ({
        ...entry,
        id: `${item.id}-${property.id}-option-${index + 1}`,
      })),
    })),
    rows: item.rows.map((row) => ({
      ...row,
      blocks: row.blocks.map((entry, index) => ({ ...entry, id: `${row.id}-block-${index + 1}` })),
    })),
  };
});

export const makeSeed = (): Item[] => {
  const home: Page = {
    id: "home",
    kind: "page",
    title: "Home",
    icon: "⌂",
    parentId: null,
    blocks: seedBlocks(),
  };
  const work: Page = {
    id: "work",
    kind: "page",
    title: "Work studio",
    icon: "✦",
    parentId: "home",
    blocks: [
      createBlock("heading1", "Work studio"),
      createBlock("paragraph", "A focused corner for the projects that deserve your best attention."),
      createBlock("heading2", "Working principles"),
      createBlock("bulleted", "Make the smallest useful version"),
      createBlock("bulleted", "Leave a clear trail for future me"),
    ],
  };
  const launch: Page = {
    id: "launch",
    kind: "page",
    title: "Launch notes",
    icon: "↗",
    parentId: "work",
    blocks: [
      createBlock("heading1", "Launch notes"),
      createBlock(
        "paragraph",
        "A simple launch can still feel intentional. Tell one clear story, then make the next step effortless.",
      ),
      createBlock("todo", "Write the first release note", true),
      createBlock("todo", "Invite three thoughtful testers"),
    ],
  };
  const personal: Page = {
    id: "personal",
    kind: "page",
    title: "Personal notes",
    icon: "☼",
    parentId: "home",
    blocks: [
      createBlock("heading1", "Personal notes"),
      createBlock(
        "paragraph",
        "Loose thoughts, small observations and the ideas that are not ready for a project yet.",
      ),
      createBlock("quote", "Attention is the beginning of devotion."),
    ],
  };
  const travel: Page = {
    id: "travel",
    kind: "page",
    title: "Spring route",
    icon: "✈",
    parentId: "personal",
    blocks: [
      createBlock("heading1", "Spring route"),
      createBlock(
        "paragraph",
        "A slower week between old streets, long lunches and the kind of museums that make time disappear.",
      ),
      createBlock("heading2", "Loose plan"),
      createBlock("bulleted", "Utrecht → Antwerp → Ghent"),
      createBlock("bulleted", "Keep one afternoon completely unscheduled"),
      createBlock("todo", "Book the first train"),
      createBlock("todo", "Save a short list of places to eat"),
    ],
  };
  const reading: Database = {
    id: "reading",
    kind: "database",
    title: "Reading list",
    icon: "▤",
    parentId: "home",
    properties: [
      {
        id: "status",
        name: "Status",
        type: "select",
        options: [
          createOption("To read", "#209dd7"),
          createOption("Reading", "#ecad0a"),
          createOption("Finished", "#35a77c"),
        ],
      },
      { id: "author", name: "Author", type: "text" },
      { id: "rating", name: "Rating", type: "number" },
      { id: "started", name: "Started", type: "date" },
      { id: "favorite", name: "Favorite", type: "checkbox" },
      { id: "link", name: "Link", type: "url" },
    ],
    rows: [
      {
        id: "book-1",
        title: "The Creative Act",
        values: {
          status: "Reading",
          author: "Rick Rubin",
          rating: 5,
          started: "2026-01-10",
          favorite: true,
          link: "https://www.penguinrandomhouse.com",
        },
        blocks: [createBlock("paragraph", "Keep making the thing. The practice is the point.")],
      },
      {
        id: "book-2",
        title: "The Dispossessed",
        values: {
          status: "Finished",
          author: "Ursula K. Le Guin",
          rating: 5,
          started: "2025-11-04",
          favorite: true,
          link: "https://www.ursulakleguin.com",
        },
        blocks: [
          createBlock(
            "quote",
            "You cannot buy the revolution. You cannot make the revolution. You can only be the revolution.",
          ),
        ],
      },
      {
        id: "book-3",
        title: "Thinking in Systems",
        values: { status: "To read", author: "Donella Meadows", rating: 0, started: "", favorite: false, link: "" },
        blocks: [createBlock("paragraph", "A note to return to when the map feels too simple.")],
      },
    ],
    view: {
      mode: "table",
      groupBy: "status",
      filters: [{ propertyId: "status", query: "Reading", operator: "is" }],
      sortBy: "rating",
      sortDir: "desc",
    },
  };
  const projects: Database = {
    id: "projects",
    kind: "database",
    title: "Project tracker",
    icon: "▦",
    parentId: "work",
    properties: [
      {
        id: "stage",
        name: "Stage",
        type: "select",
        options: [
          createOption("Backlog", "#6c7a89"),
          createOption("In progress", "#209dd7"),
          createOption("Review", "#ecad0a"),
          createOption("Done", "#35a77c"),
        ],
      },
      {
        id: "priority",
        name: "Priority",
        type: "select",
        options: [
          createOption("Low", "#6c7a89"),
          createOption("Medium", "#ecad0a"),
          createOption("High", "#e36b55"),
        ],
      },
      {
        id: "tags",
        name: "Tags",
        type: "multi-select",
        options: [
          createOption("Build", "#753991"),
          createOption("Writing", "#209dd7"),
          createOption("Life", "#35a77c"),
        ],
      },
      { id: "owner", name: "Owner", type: "text" },
      { id: "due", name: "Due", type: "date" },
      { id: "complete", name: "Complete", type: "checkbox" },
    ],
    rows: [
      {
        id: "project-1",
        title: "Personal Space",
        values: { stage: "In progress", priority: "High", tags: ["Build"], owner: "Alex", due: "2026-08-12", complete: false },
        blocks: [createBlock("paragraph", "Build a workspace that feels good enough to return to every day.")],
      },
      {
        id: "project-2",
        title: "Spring route",
        values: { stage: "Backlog", priority: "Medium", tags: ["Life"], owner: "Alex", due: "2026-09-01", complete: false },
        blocks: [createBlock("todo", "Book the train"), createBlock("todo", "Save a short list of places")],
      },
      {
        id: "project-3",
        title: "Release checklist",
        values: { stage: "Review", priority: "Medium", tags: ["Build", "Writing"], owner: "Alex", due: "2026-08-20", complete: false },
        blocks: [createBlock("bulleted", "Run the happy path"), createBlock("bulleted", "Invite a friend to poke holes")],
      },
      {
        id: "project-4",
        title: "Inbox zero",
        values: { stage: "Done", priority: "Low", tags: ["Life"], owner: "Alex", due: "2026-08-02", complete: true },
        blocks: [createBlock("paragraph", "A little lighter.")],
      },
    ],
    view: { mode: "board", groupBy: "stage", filters: [], sortBy: "priority", sortDir: "asc" },
  };
  return stabilizeSeedIds([home, work, launch, personal, travel, reading, projects]);
};

export const mergeSeedAdditions = (existing: Item[]): Item[] => {
  const existingIds = new Set(existing.map((item) => item.id));
  const seedItems = normalizeItems(makeSeed());
  return [...existing, ...seedItems.filter((item) => !existingIds.has(item.id))];
};

export const optionForValue = (property: Property, value: CellValue) =>
  property.options?.find((entry) => entry.label === String(value));

export const createEmptyDatabase = (): Database => {
  const statusId = uid("property");
  const view = { ...emptyView("table"), groupBy: statusId };
  return {
    id: uid("database"),
    kind: "database",
    title: "Untitled database",
    icon: "▦",
    parentId: null,
    properties: [
      {
        id: statusId,
        name: "Status",
        type: "select",
        options: [createOption("Backlog", palette[0]), createOption("Done", palette[3])],
      },
    ],
    rows: [],
    view,
    views: {
      table: view,
      board: { ...emptyView("board"), groupBy: statusId },
      list: emptyView("list"),
    },
  };
};

export const GOOGLE_TASKS_DATABASE_ID = "google-tasks";
export const GOOGLE_TASK_PROPERTY_IDS = {
  status: "google-status",
  due: "google-due",
  notes: "google-notes",
  list: "google-list",
  link: "google-link",
  id: "google-id",
  parent: "google-parent",
  position: "google-position",
} as const;

export const createGoogleTasksDatabase = (): Database => {
  const properties: Property[] = [
    {
      id: GOOGLE_TASK_PROPERTY_IDS.status,
      name: "Status",
      type: "select",
      options: [
        createOption("Open", "#209dd7"),
        createOption("Done", "#35a77c"),
      ],
    },
    { id: GOOGLE_TASK_PROPERTY_IDS.due, name: "Due", type: "date" },
    { id: GOOGLE_TASK_PROPERTY_IDS.notes, name: "Notes", type: "text" },
    { id: GOOGLE_TASK_PROPERTY_IDS.list, name: "List", type: "text" },
    { id: GOOGLE_TASK_PROPERTY_IDS.link, name: "Google link", type: "url" },
    { id: GOOGLE_TASK_PROPERTY_IDS.id, name: "Google ID", type: "text" },
    { id: GOOGLE_TASK_PROPERTY_IDS.parent, name: "Parent ID", type: "text" },
    { id: GOOGLE_TASK_PROPERTY_IDS.position, name: "Position", type: "text" },
  ];
  const view = { ...emptyView("list"), sortBy: GOOGLE_TASK_PROPERTY_IDS.due, sortDir: "asc" as const };
  return {
    id: GOOGLE_TASKS_DATABASE_ID,
    kind: "database",
    title: "Google Tasks",
    icon: "✓",
    parentId: null,
    properties,
    rows: [],
    view,
    views: {
      table: emptyView("table"),
      board: { ...emptyView("board"), groupBy: GOOGLE_TASK_PROPERTY_IDS.status },
      list: view,
    },
  };
};

export const createEmptyPage = (parentId: string | null): Page => ({
  id: uid("page"),
  kind: "page",
  title: "Untitled page",
  icon: "✦",
  parentId,
  blocks: [createBlock("paragraph")],
});

export const descendantIds = (items: Item[], rootId: string) => {
  const descendants = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    items.forEach((item) => {
      if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
        descendants.add(item.id);
        changed = true;
      }
    });
  }
  return descendants;
};
