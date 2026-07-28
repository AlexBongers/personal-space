import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";

interface SeedPage {
  title: string;
  icon: string;
  key?: string;
  children?: SeedPage[];
}

const SEED_DATA: SeedPage = {
  title: "Home",
  icon: "🏠",
  key: "home",
  children: [
    {
      title: "Projects",
      icon: "📋",
      key: "projects",
      children: [
        {
          title: "House Renovation",
          icon: "🏗️",
          key: "house-renovation",
          children: [
            { title: "Kitchen", icon: "🍳", key: "kitchen" },
            { title: "Bathroom", icon: "🛁", key: "bathroom" },
          ],
        },
        {
          title: "Website Redesign",
          icon: "🌐",
          key: "website-redesign",
          children: [
            { title: "Design System", icon: "🎨", key: "design-system" },
            { title: "Content Strategy", icon: "📝", key: "content-strategy" },
          ],
        },
      ],
    },
    {
      title: "Reading List",
      icon: "📚",
      key: "reading-list",
      children: [
        {
          title: "Currently Reading",
          icon: "📖",
          key: "currently-reading",
        },
        {
          title: "Want to Read",
          icon: "🔖",
          key: "want-to-read",
        },
        {
          title: "Finished",
          icon: "✅",
          key: "finished",
          children: [
            { title: "2024", icon: "📅", key: "finished-2024" },
            { title: "2025", icon: "📅", key: "finished-2025" },
          ],
        },
      ],
    },
    {
      title: "Travel Plans",
      icon: "✈️",
      key: "travel-plans",
      children: [
        { title: "Japan 2025", icon: "🗾", key: "japan-2025" },
        { title: "Europe Summer", icon: "🏖️", key: "europe-summer" },
      ],
    },
    {
      title: "Notes",
      icon: "📝",
      key: "notes",
      children: [
        { title: "Meeting Notes", icon: "💼", key: "meeting-notes" },
        { title: "Ideas", icon: "💡", key: "ideas" },
        { title: "Random Thoughts", icon: "💭", key: "random-thoughts" },
      ],
    },
  ],
};

const pageIds: Record<string, string> = {};

function insertBlock(pageKey: string, type: string, content: string, position: number, checked?: boolean) {
  const db = getDb();
  const pageId = pageIds[pageKey];
  if (!pageId) return;

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO blocks (id, page_id, type, content, position, checked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, pageId, type, content, position, checked ? 1 : 0, now, now);
}

function insertPage(parentId: string | null, page: SeedPage): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, page.title, parentId, page.icon, now, now);

  if (page.key) {
    pageIds[page.key] = id;
  }

  if (page.children) {
    for (const child of page.children) {
      insertPage(id, child);
    }
  }

  return id;
}

function seedBlocks() {
  insertBlock("home", "heading1", "Welcome to Personal Space", 0);
  insertBlock("home", "paragraph", "This is your personal workspace. Use the sidebar to navigate between pages, add blocks of content, and organize your thoughts.", 1);
  insertBlock("home", "paragraph", "You can create headings, paragraphs, to-do lists, bulleted lists, numbered lists, quotes, code blocks, callouts, and dividers. Click the + button to add a new block.", 2);
  insertBlock("home", "divider", "", 3);
  insertBlock("home", "heading2", "Quick Links", 4);
  insertBlock("home", "bulleted_list", "Projects — Track your ongoing work", 5);
  insertBlock("home", "bulleted_list", "Reading List — Books you want to read", 6);
  insertBlock("home", "bulleted_list", "Travel Plans — Upcoming trips and itineraries", 7);
  insertBlock("home", "bulleted_list", "Notes — Capture ideas and meeting notes", 8);

  insertBlock("projects", "heading1", "Projects", 0);
  insertBlock("projects", "paragraph", "Here are all the projects I'm currently working on. Each project has its own page with detailed notes and tasks.", 1);
  insertBlock("projects", "divider", "", 2);
  insertBlock("projects", "heading2", "Active Projects", 3);
  insertBlock("projects", "todo", "House Renovation — Kitchen remodel planning", 4, true);
  insertBlock("projects", "todo", "House Renovation — Bathroom design", 5, false);
  insertBlock("projects", "todo", "Website Redesign — Finalize design system", 6, false);
  insertBlock("projects", "todo", "Website Redesign — Write content strategy", 7, false);
  insertBlock("projects", "todo", "Update portfolio with recent work", 8, false);
  insertBlock("projects", "divider", "", 9);
  insertBlock("projects", "heading2", "On Hold", 10);
  insertBlock("projects", "bulleted_list", "Learn Rust — Putting this off until Q3", 11);
  insertBlock("projects", "bulleted_list", "Blog redesign — Need to find a designer first", 12);

  insertBlock("reading-list", "heading1", "Reading List", 0);
  insertBlock("reading-list", "paragraph", "Books I want to read, am currently reading, and have finished.", 1);
  insertBlock("reading-list", "divider", "", 2);
  insertBlock("reading-list", "heading2", "Currently Reading", 3);
  insertBlock("reading-list", "todo", "The Pragmatic Programmer by David Thomas & Andrew Hunt", 4, false);
  insertBlock("reading-list", "todo", "Designing Data-Intensive Applications by Martin Kleppmann", 5, false);
  insertBlock("reading-list", "heading2", "Want to Read", 6);
  insertBlock("reading-list", "bulleted_list", "The Staff Engineer's Path by Tanya Reilly", 7);
  insertBlock("reading-list", "bulleted_list", "Building Evolutionary Architectures by Neal Ford et al.", 8);
  insertBlock("reading-list", "bulleted_list", "Domain-Driven Design by Eric Evans", 9);

  insertBlock("travel-plans", "heading1", "Travel Plans", 0);
  insertBlock("travel-plans", "paragraph", "Upcoming trips and destinations I'm planning.", 1);
  insertBlock("travel-plans", "divider", "", 2);
  insertBlock("travel-plans", "heading2", "Japan 2025", 3);
  insertBlock("travel-plans", "paragraph", "Planning a 2-week trip to Japan in Spring 2025. Tokyo, Kyoto, Osaka, and day trips to Nara and Hakone.", 4);
  insertBlock("travel-plans", "heading2", "Europe Summer", 5);
  insertBlock("travel-plans", "paragraph", "A month-long trip through Europe — Paris, Amsterdam, Berlin, Prague, and Vienna.", 6);

  insertBlock("notes", "heading1", "Notes", 0);
  insertBlock("notes", "callout", "This is your digital garden. Plant ideas, water them, and watch them grow.", 1);
  insertBlock("notes", "divider", "", 2);
  insertBlock("notes", "heading2", "Quick Capture", 3);
  insertBlock("notes", "quote", "The best way to predict the future is to invent it. — Alan Kay", 4);
  insertBlock("notes", "paragraph", "Use this page to quickly jot down ideas before they slip away. You can always organize them later.", 5);

  insertBlock("meeting-notes", "heading1", "Meeting Notes", 0);
  insertBlock("meeting-notes", "paragraph", "Notes from team standups, one-on-ones, and planning sessions.", 1);
  insertBlock("meeting-notes", "divider", "", 2);
  insertBlock("meeting-notes", "heading2", "Template", 3);
  insertBlock("meeting-notes", "code", "# Meeting Title\nDate: YYYY-MM-DD\nAttendees:\n\n## Agenda\n- Item 1\n- Item 2\n\n## Notes\n\n## Action Items\n- [ ] Task 1\n- [ ] Task 2", 4);
  insertBlock("meeting-notes", "heading2", "2025-03-15 — Sprint Planning", 5);
  insertBlock("meeting-notes", "bulleted_list", "Prioritized features for the Personal Space 2.0 release", 6);
  insertBlock("meeting-notes", "bulleted_list", "Decided to use local-first architecture with SQLite", 7);
  insertBlock("meeting-notes", "bulleted_list", "Assigned tasks for database views feature", 8);

  insertBlock("ideas", "heading1", "Ideas", 0);
  insertBlock("ideas", "callout", "No idea is too small. Write everything down.", 1);
  insertBlock("ideas", "divider", "", 2);
  insertBlock("ideas", "heading2", "App Ideas", 3);
  insertBlock("ideas", "todo", "Habit tracker with streak visualization", 4, false);
  insertBlock("ideas", "todo", "Recipe manager that scales ingredients", 5, false);
  insertBlock("ideas", "todo", "Local-first bookmark manager with full-text search", 6, false);
  insertBlock("ideas", "heading2", "Writing Ideas", 7);
  insertBlock("ideas", "bulleted_list", "The case for boring technology in startups", 8);
  insertBlock("ideas", "bulleted_list", "How I build side projects in 10 hours or less", 9);

  insertBlock("random-thoughts", "heading1", "Random Thoughts", 0);
  insertBlock("random-thoughts", "quote", "The quieter you become, the more you can hear.", 1);
  insertBlock("random-thoughts", "divider", "", 2);
  insertBlock("random-thoughts", "paragraph", "I've been thinking about how software complexity grows over time. Conway's Law feels more relevant every day.", 3);
  insertBlock("random-thoughts", "paragraph", "There's something deeply satisfying about a tool that does one thing well.", 4);
  insertBlock("random-thoughts", "heading3", "To explore", 5);
  insertBlock("random-thoughts", "numbered_list", "Edge computing patterns for local-first apps", 6);
  insertBlock("random-thoughts", "numbered_list", "CRDTs vs OT for collaborative editing", 7);
  insertBlock("random-thoughts", "numbered_list", "SQLite as an application file format", 8);
}

function seedDatabases() {
  const db = getDb();
  const now = new Date().toISOString();

  // Store row page IDs for block seeding (keyed by a lookup string)
  const rowPageIds: Record<string, string> = {};

  function insertBlockForPage(pageId: string, type: string, content: string, position: number, checked?: boolean) {
    const id = uuidv4();
    db.prepare(
      "INSERT INTO blocks (id, page_id, type, content, position, checked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, pageId, type, content, position, checked ? 1 : 0, now, now);
  }

  // ============================================================
  // Database 1: Task Tracker (under Projects)
  // ============================================================
  const projectsPageId = pageIds["projects"];
  const taskTrackerPageId = uuidv4();
  const taskTrackerDbId = uuidv4();

  db.prepare(
    "INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(taskTrackerPageId, "Task Tracker", projectsPageId, "✅", now, now);

  const statusPropId = uuidv4();
  const priorityPropId = uuidv4();
  const dueDatePropId = uuidv4();
  const completedPropId = uuidv4();
  const urlPropId = uuidv4();

  const taskTrackerProperties = [
    { id: statusPropId, name: "Status", type: "select" },
    { id: priorityPropId, name: "Priority", type: "select" },
    { id: dueDatePropId, name: "Due Date", type: "date" },
    { id: completedPropId, name: "Completed", type: "checkbox" },
    { id: urlPropId, name: "URL", type: "url" },
  ];

  db.prepare(
    "INSERT INTO databases (id, page_id, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(taskTrackerDbId, taskTrackerPageId, "Task Tracker", JSON.stringify(taskTrackerProperties), now, now);

  // Views for Task Tracker
  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), taskTrackerDbId, "table", "Table View", "[]", null, "asc", null, now, now);

  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), taskTrackerDbId, "board", "Board View", JSON.stringify([
    { id: uuidv4(), field: completedPropId, operator: "is", value: false }
  ]), null, "asc", statusPropId, now, now);

  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), taskTrackerDbId, "list", "List View", "[]", dueDatePropId, "asc", null, now, now);

  // Select options for Status
  const statusOptions = [
    { id: uuidv4(), value: "Backlog", color: "gray" },
    { id: uuidv4(), value: "In Progress", color: "blue" },
    { id: uuidv4(), value: "Review", color: "purple" },
    { id: uuidv4(), value: "Done", color: "green" },
  ];
  statusOptions.forEach((opt, i) => {
    db.prepare(
      "INSERT INTO select_options (id, database_id, property_id, value, color, position) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(opt.id, taskTrackerDbId, statusPropId, opt.value, opt.color, i);
  });

  // Select options for Priority
  const priorityOptions = [
    { id: uuidv4(), value: "High", color: "red" },
    { id: uuidv4(), value: "Medium", color: "amber" },
    { id: uuidv4(), value: "Low", color: "gray" },
  ];
  priorityOptions.forEach((opt, i) => {
    db.prepare(
      "INSERT INTO select_options (id, database_id, property_id, value, color, position) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(opt.id, taskTrackerDbId, priorityPropId, opt.value, opt.color, i);
  });

  function createTaskRow(title: string, data: Record<string, unknown>, key: string): string {
    const rowId = uuidv4();
    const pageId = uuidv4();
    db.prepare(
      "INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(pageId, title, taskTrackerPageId, null, now, now);
    db.prepare(
      "INSERT INTO rows (id, database_id, page_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(rowId, taskTrackerDbId, pageId, title, JSON.stringify(data), now, now);
    rowPageIds[key] = pageId;
    return rowId;
  }

  // Task rows
  createTaskRow("Design new onboarding flow", {
    [statusPropId]: "In Progress",
    [priorityPropId]: "High",
    [dueDatePropId]: "2025-04-15",
    [completedPropId]: false,
    [urlPropId]: "https://figma.com/file/onboarding-v2",
  }, "tt-onboarding");

  createTaskRow("Set up CI/CD pipeline", {
    [statusPropId]: "Done",
    [priorityPropId]: "High",
    [dueDatePropId]: "2025-03-20",
    [completedPropId]: true,
    [urlPropId]: "https://github.com/org/repo/actions",
  }, "tt-cicd");

  createTaskRow("Write API documentation", {
    [statusPropId]: "Review",
    [priorityPropId]: "Medium",
    [dueDatePropId]: "2025-04-10",
    [completedPropId]: false,
    [urlPropId]: "",
  }, "tt-api-docs");

  createTaskRow("Optimize database queries", {
    [statusPropId]: "Backlog",
    [priorityPropId]: "Medium",
    [dueDatePropId]: "2025-05-01",
    [completedPropId]: false,
    [urlPropId]: "",
  }, "tt-db-optimize");

  createTaskRow("Research localization libraries", {
    [statusPropId]: "Backlog",
    [priorityPropId]: "Low",
    [dueDatePropId]: "2025-05-15",
    [completedPropId]: false,
    [urlPropId]: "https://www.npmjs.com/search?q=i18n",
  }, "tt-i18n");

  createTaskRow("Fix mobile nav overflow", {
    [statusPropId]: "In Progress",
    [priorityPropId]: "High",
    [dueDatePropId]: "2025-04-05",
    [completedPropId]: false,
    [urlPropId]: "https://github.com/org/repo/issues/342",
  }, "tt-mobile-nav");

  // Blocks for Task Tracker row pages
  insertBlockForPage(rowPageIds["tt-onboarding"], "heading2", "Requirements", 0);
  insertBlockForPage(rowPageIds["tt-onboarding"], "bulleted_list", "Simplify step count from 7 to 4", 1);
  insertBlockForPage(rowPageIds["tt-onboarding"], "bulleted_list", "Add progress indicator", 2);
  insertBlockForPage(rowPageIds["tt-onboarding"], "bulleted_list", "Support dark mode from day one", 3);
  insertBlockForPage(rowPageIds["tt-onboarding"], "divider", "", 4);
  insertBlockForPage(rowPageIds["tt-onboarding"], "heading3", "Open questions", 5);
  insertBlockForPage(rowPageIds["tt-onboarding"], "todo", "Should we support social login?", 6, false);
  insertBlockForPage(rowPageIds["tt-onboarding"], "todo", "Get UX team review before finalizing", 7, false);

  insertBlockForPage(rowPageIds["tt-cicd"], "heading2", "Summary", 0);
  insertBlockForPage(rowPageIds["tt-cicd"], "paragraph", "The CI/CD pipeline is now fully operational. All PRs run lint, typecheck, unit tests, and E2E tests before merging. Deployments to staging happen automatically on merge to main.", 1);
  insertBlockForPage(rowPageIds["tt-cicd"], "divider", "", 2);
  insertBlockForPage(rowPageIds["tt-cicd"], "heading3", "Key decisions", 3);
  insertBlockForPage(rowPageIds["tt-cicd"], "numbered_list", "Use GitHub Actions for CI", 4);
  insertBlockForPage(rowPageIds["tt-cicd"], "numbered_list", "Docker-based deployment to staging", 5);
  insertBlockForPage(rowPageIds["tt-cicd"], "numbered_list", "Nightly build for dependency updates", 6);

  insertBlockForPage(rowPageIds["tt-api-docs"], "heading2", "Sections to cover", 0);
  insertBlockForPage(rowPageIds["tt-api-docs"], "todo", "Authentication endpoints", 1, true);
  insertBlockForPage(rowPageIds["tt-api-docs"], "todo", "Page API (CRUD)", 2, true);
  insertBlockForPage(rowPageIds["tt-api-docs"], "todo", "Block API (CRUD)", 3, false);
  insertBlockForPage(rowPageIds["tt-api-docs"], "todo", "Database API", 4, false);
  insertBlockForPage(rowPageIds["tt-api-docs"], "todo", "Error response format", 5, false);
  insertBlockForPage(rowPageIds["tt-api-docs"], "callout", "Use OpenAPI 3.1 spec with Stoplight for rendering", 6);

  insertBlockForPage(rowPageIds["tt-db-optimize"], "heading2", "Findings", 0);
  insertBlockForPage(rowPageIds["tt-db-optimize"], "paragraph", "Profile reveals the nested page query is the main bottleneck — it recursively fetches children one at a time instead of using a single recursive CTE.", 1);
  insertBlockForPage(rowPageIds["tt-db-optimize"], "code", "-- Current: N+1 query pattern\nSELECT * FROM pages WHERE parent_id = ?;\n-- Better: single recursive CTE\nWITH RECURSIVE tree AS (\n  SELECT * FROM pages WHERE parent_id = ?\n  UNION ALL\n  SELECT p.* FROM pages p JOIN tree t ON p.parent_id = t.id\n)\nSELECT * FROM tree;", 2);
  insertBlockForPage(rowPageIds["tt-db-optimize"], "divider", "", 3);
  insertBlockForPage(rowPageIds["tt-db-optimize"], "heading3", "Indexes to add", 4);
  insertBlockForPage(rowPageIds["tt-db-optimize"], "bulleted_list", "CREATE INDEX idx_pages_parent ON pages(parent_id)", 5);
  insertBlockForPage(rowPageIds["tt-db-optimize"], "bulleted_list", "CREATE INDEX idx_blocks_page ON blocks(page_id, position)", 6);

  insertBlockForPage(rowPageIds["tt-i18n"], "heading2", "Candidates", 0);
  insertBlockForPage(rowPageIds["tt-i18n"], "bulleted_list", "react-i18next — most popular, mature", 1);
  insertBlockForPage(rowPageIds["tt-i18n"], "bulleted_list", "next-intl — tight Next.js integration", 2);
  insertBlockForPage(rowPageIds["tt-i18n"], "bulleted_list", "lingui — macro-based, compile-time", 3);
  insertBlockForPage(rowPageIds["tt-i18n"], "divider", "", 4);
  insertBlockForPage(rowPageIds["tt-i18n"], "callout", "Make sure the library supports ICU MessageFormat for pluralization and date formatting. We'll need RTL support for Arabic and Hebrew in Q4.", 5);

  insertBlockForPage(rowPageIds["tt-mobile-nav"], "heading2", "Bug description", 0);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "paragraph", "The sidebar navigation menu overflows the viewport on screens narrower than 360px. The bottom two items are cut off and unreachable.", 1);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "divider", "", 2);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "heading3", "Reproduction", 3);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "numbered_list", "Open app on iPhone SE (320px wide)", 4);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "numbered_list", "Create 10+ pages so sidebar is taller than viewport", 5);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "numbered_list", "Observe bottom items hidden behind browser chrome", 6);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "heading3", "Fix approach", 7);
  insertBlockForPage(rowPageIds["tt-mobile-nav"], "paragraph", "Add max-height with overflow-y: auto to the sidebar nav container, and ensure safe-area-inset-bottom is accounted for.", 8);

  // ============================================================
  // Database 2: Book Collection (under Reading List)
  // ============================================================
  const readingListPageId = pageIds["reading-list"];
  const bookCollectionPageId = uuidv4();
  const bookCollectionDbId = uuidv4();

  db.prepare(
    "INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(bookCollectionPageId, "Book Collection", readingListPageId, "📚", now, now);

  const bookAuthorPropId = uuidv4();
  const bookStatusPropId = uuidv4();
  const bookRatingPropId = uuidv4();
  const bookYearPropId = uuidv4();
  const bookGenrePropId = uuidv4();

  const bookCollectionProperties = [
    { id: bookAuthorPropId, name: "Author", type: "text" },
    { id: bookStatusPropId, name: "Status", type: "select" },
    { id: bookRatingPropId, name: "Rating", type: "number" },
    { id: bookYearPropId, name: "Year", type: "number" },
    { id: bookGenrePropId, name: "Genre", type: "multi-select" },
  ];

  db.prepare(
    "INSERT INTO databases (id, page_id, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(bookCollectionDbId, bookCollectionPageId, "Book Collection", JSON.stringify(bookCollectionProperties), now, now);

  // Views for Book Collection
  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), bookCollectionDbId, "table", "Table View", "[]", null, "asc", null, now, now);

  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), bookCollectionDbId, "board", "Board View", "[]", null, "asc", bookStatusPropId, now, now);

  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuidv4(), bookCollectionDbId, "list", "List View", "[]", null, "asc", null, now, now);

  // Select options for Status
  const bookStatusOptions = [
    { id: uuidv4(), value: "Read", color: "green" },
    { id: uuidv4(), value: "Reading", color: "blue" },
    { id: uuidv4(), value: "Want to Read", color: "gray" },
  ];
  bookStatusOptions.forEach((opt, i) => {
    db.prepare(
      "INSERT INTO select_options (id, database_id, property_id, value, color, position) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(opt.id, bookCollectionDbId, bookStatusPropId, opt.value, opt.color, i);
  });

  const genreOptions = [
    { id: uuidv4(), value: "Software Engineering", color: "blue" },
    { id: uuidv4(), value: "Architecture", color: "purple" },
    { id: uuidv4(), value: "Career Growth", color: "amber" },
    { id: uuidv4(), value: "Databases", color: "green" },
  ];
  genreOptions.forEach((opt, i) => {
    db.prepare(
      "INSERT INTO select_options (id, database_id, property_id, value, color, position) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(opt.id, bookCollectionDbId, bookGenrePropId, opt.value, opt.color, i);
  });

  function createBookRow(title: string, data: Record<string, unknown>, key: string): string {
    const rowId = uuidv4();
    const pageId = uuidv4();
    db.prepare(
      "INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(pageId, title, bookCollectionPageId, null, now, now);
    db.prepare(
      "INSERT INTO rows (id, database_id, page_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(rowId, bookCollectionDbId, pageId, title, JSON.stringify(data), now, now);
    rowPageIds[key] = pageId;
    return rowId;
  }

  // Book rows
  createBookRow("The Pragmatic Programmer", {
    [bookAuthorPropId]: "David Thomas & Andrew Hunt",
    [bookStatusPropId]: "Read",
    [bookRatingPropId]: 5,
    [bookYearPropId]: 1999,
    [bookGenrePropId]: "Software Engineering",
  }, "bc-pragmatic");

  createBookRow("Designing Data-Intensive Applications", {
    [bookAuthorPropId]: "Martin Kleppmann",
    [bookStatusPropId]: "Reading",
    [bookRatingPropId]: 4,
    [bookYearPropId]: 2017,
    [bookGenrePropId]: "Databases",
  }, "bc-ddia");

  createBookRow("The Staff Engineer's Path", {
    [bookAuthorPropId]: "Tanya Reilly",
    [bookStatusPropId]: "Want to Read",
    [bookRatingPropId]: null,
    [bookYearPropId]: 2022,
    [bookGenrePropId]: "Career Growth",
  }, "bc-staff-engineer");

  createBookRow("A Philosophy of Software Design", {
    [bookAuthorPropId]: "John Ousterhout",
    [bookStatusPropId]: "Read",
    [bookRatingPropId]: 5,
    [bookYearPropId]: 2018,
    [bookGenrePropId]: "Software Engineering,Architecture",
  }, "bc-philosophy");

  createBookRow("Building Evolutionary Architectures", {
    [bookAuthorPropId]: "Neal Ford, Rebecca Parsons & Patrick Kua",
    [bookStatusPropId]: "Want to Read",
    [bookRatingPropId]: null,
    [bookYearPropId]: 2017,
    [bookGenrePropId]: "Architecture,Software Engineering",
  }, "bc-evolutionary");

  // Blocks for Book Collection row pages
  insertBlockForPage(rowPageIds["bc-pragmatic"], "heading2", "Notes", 0);
  insertBlockForPage(rowPageIds["bc-pragmatic"], "paragraph", "A timeless classic that holds up incredibly well. The chapter on tracer bullets and prototyping alone is worth the price of the book.", 1);
  insertBlockForPage(rowPageIds["bc-pragmatic"], "divider", "", 2);
  insertBlockForPage(rowPageIds["bc-pragmatic"], "heading3", "Key takeaways", 3);
  insertBlockForPage(rowPageIds["bc-pragmatic"], "bulleted_list", "DRY isn't just about code — it's about knowledge", 4);
  insertBlockForPage(rowPageIds["bc-pragmatic"], "bulleted_list", "Orthogonality reduces risk and increases flexibility", 5);
  insertBlockForPage(rowPageIds["bc-pragmatic"], "bulleted_list", "Invest in your knowledge portfolio every day", 6);
  insertBlockForPage(rowPageIds["bc-pragmatic"], "quote", "The greatest of all weaknesses is the fear of appearing weak.", 7);

  insertBlockForPage(rowPageIds["bc-ddia"], "heading2", "Current chapter: Transactions", 0);
  insertBlockForPage(rowPageIds["bc-ddia"], "paragraph", "Chapter 7 is a deep dive into transactions — ACID, isolation levels, and the trade-offs between weak and strong consistency. The comparison between snapshot isolation and serializable isolation is particularly well done.", 1);
  insertBlockForPage(rowPageIds["bc-ddia"], "divider", "", 2);
  insertBlockForPage(rowPageIds["bc-ddia"], "heading3", "Chapter progress", 3);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 1: Reliable, Scalable, Maintainable", 4, true);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 2: Data Models and Query Languages", 5, true);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 3: Storage and Retrieval", 6, true);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 4: Encoding and Evolution", 7, true);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 5: Replication", 8, true);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 6: Partitioning", 9, true);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 7: Transactions", 10, false);
  insertBlockForPage(rowPageIds["bc-ddia"], "todo", "Ch 8: The Trouble with Distributed Systems", 11, false);

  insertBlockForPage(rowPageIds["bc-staff-engineer"], "heading2", "Why I want to read this", 0);
  insertBlockForPage(rowPageIds["bc-staff-engineer"], "paragraph", "As I'm approaching the Staff level, I want to understand what the role actually entails beyond just writing better code. Several colleagues have recommended this as the definitive guide.", 1);
  insertBlockForPage(rowPageIds["bc-staff-engineer"], "heading3", "Topics I'm curious about", 2);
  insertBlockForPage(rowPageIds["bc-staff-engineer"], "bulleted_list", "How to balance technical work with leadership", 3);
  insertBlockForPage(rowPageIds["bc-staff-engineer"], "bulleted_list", "Managing up and across the organization", 4);
  insertBlockForPage(rowPageIds["bc-staff-engineer"], "bulleted_list", "The difference between Staff and Senior Engineer", 5);

  insertBlockForPage(rowPageIds["bc-philosophy"], "heading2", "Review", 0);
  insertBlockForPage(rowPageIds["bc-philosophy"], "paragraph", "Short but incredibly dense. Ousterhout's core thesis — that complexity is the real enemy and we should design to minimize it — is presented with compelling examples throughout.", 1);
  insertBlockForPage(rowPageIds["bc-philosophy"], "divider", "", 2);
  insertBlockForPage(rowPageIds["bc-philosophy"], "heading3", "Favorite concepts", 3);
  insertBlockForPage(rowPageIds["bc-philosophy"], "numbered_list", "Deep modules vs shallow modules", 4);
  insertBlockForPage(rowPageIds["bc-philosophy"], "numbered_list", "Strategic vs tactical programming", 5);
  insertBlockForPage(rowPageIds["bc-philosophy"], "numbered_list", "Information hiding is about knowledge, not code", 6);
  insertBlockForPage(rowPageIds["bc-philosophy"], "numbered_list", "Comments should describe things not obvious from the code", 7);
  insertBlockForPage(rowPageIds["bc-philosophy"], "quote", "The most fundamental problem in computer science is problem decomposition: how to take a complex problem and divide it up into pieces that can be solved independently.", 8);

  insertBlockForPage(rowPageIds["bc-evolutionary"], "heading2", "Context", 0);
  insertBlockForPage(rowPageIds["bc-evolutionary"], "paragraph", "Looking to improve how we evolve our architecture across multiple teams. Our current approach is too rigid — we plan for 6 months then discover the plan is obsolete by month 3.", 1);
  insertBlockForPage(rowPageIds["bc-evolutionary"], "divider", "", 2);
  insertBlockForPage(rowPageIds["bc-evolutionary"], "heading3", "Fitness functions concept", 3);
  insertBlockForPage(rowPageIds["bc-evolutionary"], "callout", "The idea of automated fitness functions that continuously validate architectural properties is fascinating. This could integrate well with our CI pipeline and give us early warning when changes start degrading quality attributes.", 4);
}

export function seed(): void {
  const db = getDb();
  const marker = db.prepare("SELECT seeded FROM _seed_marker WHERE id = 1").get() as { seeded: number } | undefined;

  if (marker && marker.seeded === 1) {
    return;
  }

  db.prepare("DELETE FROM _seed_marker").run();
  db.prepare("DELETE FROM blocks").run();
  db.prepare("DELETE FROM select_options").run();
  db.prepare("DELETE FROM views").run();
  db.prepare("DELETE FROM rows").run();
  db.prepare("DELETE FROM databases").run();
  db.prepare("DELETE FROM pages").run();

  insertPage(null, SEED_DATA);
  seedBlocks();
  seedDatabases();

  db.prepare("INSERT INTO _seed_marker (id, seeded) VALUES (1, 1)").run();
  console.log("Seed data inserted successfully.");
}
