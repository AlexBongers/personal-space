# Personal Space — Design Specification

## Overview

Personal Space is a local, single-user personal knowledge manager (a private Notion alternative) that runs on a user's own machine. It stores notes, plans, and lists as free-form pages and databases with table, board, and list views. Everything is stored in SQLite, there is one user, no login, and no cloud dependency.

## Architecture

### Stack

| Layer | Choice |
|-------|--------|
| Frontend framework | React 18+ with TypeScript |
| Build tool | Vite |
| Editor | TipTap (ProseMirror wrapper) |
| Drag & drop | @dnd-kit |
| State management | Zustand |
| Routing | React Router |
| Backend framework | Express with TypeScript |
| Database | SQLite via better-sqlite3 |
| Unit testing | Vitest |
| E2E testing | agent-browser CLI |
| Coverage | c8 (via vitest --coverage) |

### Project structure

```
personal-space/
├── package.json              # npm workspaces root
├── start.sh                  # Single documented start command
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          # Express server, port 3001
│   │   ├── db.ts             # better-sqlite3 setup + schema creation
│   │   ├── routes/
│   │   │   ├── pages.ts      # CRUD for pages
│   │   │   ├── blocks.ts     # CRUD + reorder for blocks
│   │   │   ├── databases.ts  # CRUD for databases, properties, rows, cells, views
│   │   │   └── search.ts     # Quick-find search
│   │   └── seed.ts           # First-launch seed data
│   └── tests/
│       ├── pages.test.ts
│       ├── blocks.test.ts
│       └── databases.test.ts
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts            # Typed fetch wrapper
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PageEditor.tsx
│   │   │   ├── SlashMenu.tsx
│   │   │   ├── DatabaseView.tsx
│   │   │   ├── TableView.tsx
│   │   │   ├── BoardView.tsx
│   │   │   ├── ListView.tsx
│   │   │   ├── PropertyEditor.tsx
│   │   │   ├── RowPage.tsx
│   │   │   ├── QuickFind.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── store/
│   │   │   ├── pages.ts
│   │   │   └── theme.ts
│   │   └── styles/
│   │       ├── globals.css
│   │       ├── light.css
│   │       └── dark.css
│   └── tests/
│       ├── components/
│       └── store/
├── e2e/
│   ├── phase-1-pages.sh
│   ├── phase-2-editor.sh
│   ├── phase-3-databases.sh
│   ├── phase-4-views.sh
│   └── phase-5-search-theme.sh
└── screenshots/
```

### Data flow

- Client makes REST API calls to Express server (Vite proxies `/api/*` to port 3001)
- Server validates, queries SQLite, returns JSON
- Zustand stores on the client cache the page tree, current page data, and UI state
- Mutations: API call -> response -> update store
- TipTap editor content syncs on blur + debounced 500ms during typing
- React Router drives page selection via URL `/page/:id`

## Database Schema

### Tables

```sql
CREATE TABLE pages (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT REFERENCES pages(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Untitled',
  icon       TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'page' CHECK(type IN ('page', 'database', 'row')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE blocks (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '{}',
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE properties (
  id          TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('text','number','select','multi_select','date','checkbox','url')),
  position    INTEGER NOT NULL,
  options     TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL
);

CREATE TABLE rows (
  id          TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  position    INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE cell_values (
  id          TEXT PRIMARY KEY,
  row_id      TEXT NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  value       TEXT NOT NULL DEFAULT '',
  UNIQUE(row_id, property_id)
);

CREATE TABLE view_settings (
  id          TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  view_type   TEXT NOT NULL CHECK(view_type IN ('table', 'board', 'list')),
  settings    TEXT NOT NULL DEFAULT '{}',
  UNIQUE(database_id, view_type)
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Key decisions

- UUIDs for all primary keys (text format, generated server-side)
- `blocks.content` stores TipTap's native JSON
- `properties.options` stores JSON array of `{id, label, color}` for select/multi_select
- `cell_values.value` stores JSON-stringified typed values
- `view_settings.settings` stores JSON with filters, sort, groupBy
- `settings` table stores key-value pairs (theme, etc.)
- Cascade deletes handle removal of nested content
- Row pages appear in the sidebar via `parent_id = database_id`

## API Routes

### Pages
- `GET /api/pages` — full tree
- `GET /api/pages/:id` — single page with blocks
- `POST /api/pages` — create { title, icon?, parent_id?, type? }
- `PUT /api/pages/:id` — update { title?, icon? }
- `DELETE /api/pages/:id` — delete with cascade

### Blocks
- `GET /api/pages/:id/blocks` — all blocks ordered by position
- `POST /api/pages/:id/blocks` — insert { type, content?, position? }
- `PUT /api/blocks/:id` — update { type?, content? }
- `PUT /api/pages/:id/blocks/reorder` — reorder { blockIds: string[] }
- `DELETE /api/blocks/:id` — remove

### Databases
- `GET /api/databases/:id` — full database with properties, rows, cells
- `POST /api/databases/:id/properties` — add property
- `PUT /api/properties/:id` — rename / update options
- `DELETE /api/properties/:id` — remove (cascades)
- `PUT /api/properties/:id/reorder` — reorder

### Rows
- `POST /api/databases/:id/rows` — add row
- `PUT /api/rows/:id` — rename
- `DELETE /api/rows/:id` — delete (cascades)
- `PUT /api/rows/:id/reorder` — reorder

### Cell Values
- `PUT /api/cells/:id` — update single cell
- `PUT /api/rows/:id/cells` — batch update

### Views
- `GET /api/databases/:id/views` — all view settings
- `PUT /api/databases/:id/views/:viewType` — save view settings

### Search
- `GET /api/search?q=...` — search across page, database, row titles

### Theme
- `GET /api/theme` — get current theme
- `PUT /api/theme` — set theme { theme: 'light'|'dark' }

## Frontend Component Tree

```
App
├── ThemeToggle
├── Sidebar
│   ├── PageTree (recursive)
│   │   └── PageTreeNode (icon, title, inline rename, context menu)
│   └── AddPageButton
├── MainArea
│   ├── PageView (for regular pages)
│   │   ├── PageHeader (icon picker + title)
│   │   └── PageEditor (TipTap)
│   │       ├── BlockMenu (drag handle + add button)
│   │       └── SlashMenu (filterable block type picker)
│   ├── DatabaseView (for database pages)
│   │   ├── ViewSwitcher (table | board | list)
│   │   ├── FilterBar
│   │   ├── SortControl
│   │   └── ActiveView
│   │       ├── TableView
│   │       ├── BoardView (columns = select options, draggable cards)
│   │       └── ListView (compact rows)
│   └── RowPage (when viewing a row as page)
│       ├── PropertyList (read-only properties at top)
│       └── PageEditor (blocks below)
└── QuickFind (modal overlay, keyboard-triggered)
```

### Key libraries

- `@tiptap/starter-kit` — base editor
- `@tiptap/extension-underline`
- `@tiptap/extension-code-block-lowlight`
- `@tiptap/extension-task-item` + `@tiptap/extension-task-list`
- `@tiptap/extension-placeholder`
- `@tiptap/suggestion` — slash menu
- `@dnd-kit/core` + `@dnd-kit/sortable`
- `react-datepicker` — date picker
- `react-colorful` — color picker

## Look and Feel

- Palette: `#ecad0a` (amber), `#209dd7` (blue), `#753991` (purple) over grays
- Both themes draw from the same palette; dark mode is a first-class theme
- Avoid: overuse of gradients, purple-dominated backgrounds, thin accent borders down one side of cards or panels
- CSS variables for all theme tokens, defined in `globals.css` and overridden per theme
- Bold, clean, intentional design — should look like a real product

## Testing Strategy

### Unit tests (Vitest)
- Server tests: each route file tested against an in-memory SQLite database
- Client tests: Zustand stores, utility functions, and React components with @testing-library/react
- Mock API calls at the fetch layer for client tests

### E2E tests (agent-browser)
- Shell scripts using `agent-browser` CLI commands
- Start the app, then `agent-browser open http://localhost:5173`
- Use `snapshot -i` to inspect, `click @eN`/`fill @eN` to interact
- `screenshot` to capture evidence
- `--session` for isolated test sessions
- Assert visible text/content via `get text`/`snapshot` output
- One test script per phase

### Coverage
- 80%+ statement coverage on both frontend and backend (Phase 6 gate)

## Seed Data

On first launch (when `pages` table is empty), seed.ts creates:

- A nested tree of ~15-20 pages with emoji icons, 3-4 levels deep
- Example pages: "Welcome to Personal Space", "Projects", "Travel Plans", "Reading List", "Recipes", "Notes" (with children)
- 2-3 databases: "Travel Plans" (table, properties: Destination, Budget, Status, Dates), "Reading List" (board, grouped by Status), "Project Ideas" (list)
- Content uses every block type, every property type, all three views, filters, sorts

## Phases

### Phase 1 — Running skeleton, pages and the sidebar
- Express server with SQLite, schema creation, seed data
- Page CRUD API routes
- React frontend with sidebar tree, page creation/rename/delete
- E2E test: create a page, see it in sidebar

### Phase 2 — The editor
- TipTap integration with all 11 block types
- Slash menu, drag-to-reorder, auto-save
- Seed extended with pages using every block type

### Phase 3 — Databases and the table view
- Database creation, properties, rows, cell values
- Table view with inline editing
- Select/multi-select with colors
- Row as page (properties + blocks)

### Phase 4 — Board and list views, filters and sorts
- View switcher
- Board view with drag-to-reorder columns
- List view
- Per-view filters, sort, grouping

### Phase 5 — Search, dark mode and full workspace
- Quick-find search
- Theme toggle (light/dark)
- Full seed workspace

### Phase 6 — Final quality gate
- Look-and-feel pass
- Full test suites with coverage
- Adversarial review
- Complete walkthrough with screenshots