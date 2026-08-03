"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Theme = "light" | "dark";
type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulleted"
  | "numbered"
  | "todo"
  | "quote"
  | "divider"
  | "code"
  | "callout";
type PropertyType = "text" | "number" | "select" | "multi-select" | "date" | "checkbox" | "url";
type ViewMode = "table" | "board" | "list";
type FilterOperator = "contains" | "is" | "is-not" | "before" | "after" | "checked" | "unchecked";

type Block = { id: string; type: BlockType; text: string; checked?: boolean };
type SelectOption = { id: string; label: string; color: string };
type Property = { id: string; name: string; type: PropertyType; options?: SelectOption[] };
type CellValue = string | number | boolean | string[] | null;
type Filter = { propertyId: string; query: string; operator: FilterOperator };
type ViewSettings = { mode: ViewMode; groupBy: string; filters: Filter[]; sortBy: string; sortDir: "asc" | "desc" };
type Page = { id: string; kind: "page"; title: string; icon: string; parentId: string | null; blocks: Block[] };
type Row = { id: string; title: string; values: Record<string, CellValue>; blocks: Block[] };
type Database = {
  id: string;
  kind: "database";
  title: string;
  icon: string;
  parentId: string | null;
  properties: Property[];
  rows: Row[];
  view: ViewSettings;
  views?: Partial<Record<ViewMode, ViewSettings>>;
};
type Item = Page | Database;
type SearchResult = { id: string; label: string; kind: string; parentId: string | null; rowId?: string };

const palette = ["#209dd7", "#ecad0a", "#753991", "#35a77c", "#e36b55", "#6c7a89"];
const blockLabels: Record<BlockType, string> = {
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
const propertyLabels: Record<PropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  "multi-select": "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
};
const filterOperatorLabels: Record<FilterOperator, string> = {
  contains: "contains",
  is: "is",
  "is-not": "is not",
  before: "before",
  after: "after",
  checked: "is checked",
  unchecked: "is not checked",
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
const block = (type: BlockType, text = "", checked = false): Block => ({ id: uid("block"), type, text, checked });
const option = (label: string, color: string): SelectOption => ({ id: uid("option"), label, color });
const compactText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const defaultFilterOperator = (property: Property | undefined): FilterOperator => property?.type === "checkbox" ? "checked" : property?.type === "date" ? "after" : property?.type === "select" ? "is" : "contains";
const emptyView = (mode: ViewMode): ViewSettings => ({ mode, groupBy: "", filters: [], sortBy: "", sortDir: "asc" });

const seedBlocks = (): Block[] => [
  block("heading1", "A calm place for busy minds"),
  block("paragraph", "Personal Space keeps projects, plans and ideas close at hand. Everything is stored in this browser, ready when you are."),
  block("callout", "Start with the sidebar. Create a page, open a database, or press ⌘K to find anything in your workspace."),
  block("heading2", "This week"),
  block("bulleted", "Ship the first Personal Space release"),
  block("bulleted", "Read one chapter before bed"),
  block("todo", "Sketch the spring travel route", false),
  block("quote", "A good workspace makes the next useful action obvious."),
  block("code", "const focus = 'one useful thing';"),
  block("divider"),
  block("heading3", "A tiny field guide"),
  block("numbered", "Capture the thought"),
  block("numbered", "Give it a shape"),
  block("numbered", "Make it easy to return to"),
];

const makeSeed = (): Item[] => {
  const home: Page = { id: "home", kind: "page", title: "Home", icon: "⌂", parentId: null, blocks: seedBlocks() };
  const work: Page = {
    id: "work",
    kind: "page",
    title: "Work studio",
    icon: "✦",
    parentId: "home",
    blocks: [block("heading1", "Work studio"), block("paragraph", "A focused corner for the projects that deserve your best attention."), block("heading2", "Working principles"), block("bulleted", "Make the smallest useful version"), block("bulleted", "Leave a clear trail for future me")],
  };
  const personal: Page = {
    id: "personal",
    kind: "page",
    title: "Personal notes",
    icon: "☼",
    parentId: "home",
    blocks: [block("heading1", "Personal notes"), block("paragraph", "Loose thoughts, small observations and the ideas that are not ready for a project yet."), block("quote", "Attention is the beginning of devotion.")],
  };
  const launch: Page = {
    id: "launch",
    kind: "page",
    title: "Launch notes",
    icon: "↗",
    parentId: "work",
    blocks: [block("heading1", "Launch notes"), block("paragraph", "A simple launch can still feel intentional. Tell one clear story, then make the next step effortless."), block("todo", "Write the first release note", true), block("todo", "Invite three thoughtful testers", false)],
  };
  const travel: Page = {
    id: "travel",
    kind: "page",
    title: "Spring route",
    icon: "✈",
    parentId: "personal",
    blocks: [block("heading1", "Spring route"), block("paragraph", "A slower week between old streets, long lunches and the kind of museums that make time disappear."), block("heading2", "Loose plan"), block("bulleted", "Utrecht → Antwerp → Ghent"), block("bulleted", "Keep one afternoon completely unscheduled"), block("todo", "Book the first train", false), block("todo", "Save a short list of places to eat", false)],
  };
  const reading: Database = {
    id: "reading",
    kind: "database",
    title: "Reading list",
    icon: "▤",
    parentId: "home",
    properties: [
      { id: "status", name: "Status", type: "select", options: [option("To read", "#209dd7"), option("Reading", "#ecad0a"), option("Finished", "#35a77c")] },
      { id: "author", name: "Author", type: "text" },
      { id: "rating", name: "Rating", type: "number" },
      { id: "started", name: "Started", type: "date" },
      { id: "favorite", name: "Favorite", type: "checkbox" },
      { id: "link", name: "Link", type: "url" },
    ],
    rows: [
      { id: "book-1", title: "The Creative Act", values: { status: "Reading", author: "Rick Rubin", rating: 5, started: "2025-01-10", favorite: true, link: "https://www.penguinrandomhouse.com" }, blocks: [block("paragraph", "Keep making the thing. The practice is the point.")] },
      { id: "book-2", title: "The Dispossessed", values: { status: "Finished", author: "Ursula K. Le Guin", rating: 5, started: "2024-11-04", favorite: true, link: "https://www.ursulakleguin.com" }, blocks: [block("quote", "You cannot buy the revolution. You cannot make the revolution. You can only be the revolution.")] },
      { id: "book-3", title: "Thinking in Systems", values: { status: "To read", author: "Donella Meadows", rating: 0, started: "", favorite: false, link: "" }, blocks: [block("paragraph", "A note to return to when the map feels too simple.")] },
    ],
    view: { mode: "table", groupBy: "status", filters: [{ propertyId: "status", query: "Reading", operator: "is" }], sortBy: "rating", sortDir: "desc" },
  };
  const projects: Database = {
    id: "projects",
    kind: "database",
    title: "Project tracker",
    icon: "▦",
    parentId: "work",
    properties: [
      { id: "stage", name: "Stage", type: "select", options: [option("Backlog", "#6c7a89"), option("In progress", "#209dd7"), option("Review", "#ecad0a"), option("Done", "#35a77c")] },
      { id: "priority", name: "Priority", type: "select", options: [option("Low", "#6c7a89"), option("Medium", "#ecad0a"), option("High", "#e36b55")] },
      { id: "tags", name: "Tags", type: "multi-select", options: [option("Build", "#753991"), option("Writing", "#209dd7"), option("Life", "#35a77c")] },
      { id: "owner", name: "Owner", type: "text" },
      { id: "due", name: "Due", type: "date" },
      { id: "complete", name: "Complete", type: "checkbox" },
    ],
    rows: [
      { id: "project-1", title: "Personal Space", values: { stage: "In progress", priority: "High", tags: ["Build"], owner: "Alex", due: "2025-03-12", complete: false }, blocks: [block("paragraph", "Build a workspace that feels good enough to return to every day.")] },
      { id: "project-2", title: "Spring route", values: { stage: "Backlog", priority: "Medium", tags: ["Life"], owner: "Alex", due: "2025-04-01", complete: false }, blocks: [block("todo", "Book the train", false), block("todo", "Save a short list of places", false)] },
      { id: "project-3", title: "Release checklist", values: { stage: "Review", priority: "Medium", tags: ["Build", "Writing"], owner: "Alex", due: "2025-02-20", complete: false }, blocks: [block("bulleted", "Run the happy path"), block("bulleted", "Invite a friend to poke holes") ] },
      { id: "project-4", title: "Inbox zero", values: { stage: "Done", priority: "Low", tags: ["Life"], owner: "Alex", due: "2025-02-02", complete: true }, blocks: [block("paragraph", "A little lighter.")] },
    ],
    view: { mode: "board", groupBy: "stage", filters: [], sortBy: "priority", sortDir: "asc" },
  };
  return [home, work, launch, personal, travel, reading, projects];
};

const isDatabase = (item: Item | undefined): item is Database => item?.kind === "database";
const isPage = (item: Item | undefined): item is Page => item?.kind === "page";
const getValue = (row: Row, propertyId: string): CellValue => row.values[propertyId] ?? null;
const valueText = (value: CellValue): string => Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value);
const matchesFilter = (row: Row, property: Property, filter: Filter) => {
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

const normalizeItems = (rawItems: Item[]): Item[] => rawItems.map((item) => {
  if (item.kind !== "database") return item;
  const normalizeView = (rawView: ViewSettings | undefined, mode: ViewMode): ViewSettings => {
    const source = rawView || emptyView(mode);
    return { ...emptyView(mode), ...source, mode, filters: (source.filters || []).map((filter) => ({ ...filter, operator: filter.operator || defaultFilterOperator(item.properties.find((property) => property.id === filter.propertyId)) })) };
  };
  const active = normalizeView(item.view, item.view?.mode || "table");
  const views = {
    table: normalizeView(item.views?.table || (active.mode === "table" ? active : undefined), "table"),
    board: normalizeView(item.views?.board || (active.mode === "board" ? active : undefined), "board"),
    list: normalizeView(item.views?.list || (active.mode === "list" ? active : undefined), "list"),
  };
  return { ...item, view: active, views };
});
const mergeSeedAdditions = (existing: Item[]): Item[] => {
  const existingIds = new Set(existing.map((item) => item.id));
  const seedItems = normalizeItems(makeSeed());
  return [...existing, ...seedItems.filter((item) => !existingIds.has(item.id))];
};

function BlockEditor({ item, onChange }: { item: Page | Row; onChange: (blocks: Block[]) => void }) {
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const blocks = item.blocks.length ? item.blocks : [block("paragraph")];
  const filteredTypes = (Object.keys(blockLabels) as BlockType[]).filter((type) => compactText(blockLabels[type]).includes(compactText(slashQuery)));

  const updateBlock = (id: string, patch: Partial<Block>) => onChange(blocks.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  const insertBlock = (type: BlockType, afterId?: string) => {
    const index = afterId ? blocks.findIndex((entry) => entry.id === afterId) + 1 : blocks.length;
    const next = [...blocks.slice(0, index), block(type), ...blocks.slice(index)];
    onChange(next);
    setSlashBlockId(null);
    setSlashQuery("");
    setSlashIndex(0);
  };
  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>, current: Block) => {
    if (event.key === "/") {
      setSlashBlockId(current.id);
      setSlashQuery("");
      setSlashIndex(0);
    }
    if (slashBlockId === current.id) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((index) => Math.min(index + 1, Math.max(filteredTypes.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter" && filteredTypes.length > 0) {
        event.preventDefault();
        chooseSlash(filteredTypes[slashIndex] || filteredTypes[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSlashBlockId(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      insertBlock("paragraph", current.id);
      return;
    }
    if (event.key === "Backspace" && !current.text && blocks.length > 1) {
      event.preventDefault();
      onChange(blocks.filter((entry) => entry.id !== current.id));
    }
  };
  const handleText = (current: Block, text: string) => {
    updateBlock(current.id, { text });
    const slash = text.match(/(?:^|\s)\/([^\s]*)$/);
    if (slash) {
      setSlashBlockId(current.id);
      setSlashQuery(slash[1]);
      setSlashIndex(0);
    } else {
      setSlashBlockId(null);
    }
  };
  const chooseSlash = (type: BlockType) => {
    if (!slashBlockId) return;
    const current = blocks.find((entry) => entry.id === slashBlockId);
    if (!current) return;
    updateBlock(current.id, { text: current.text.replace(/(?:^|\s)\/[^\s]*$/, "").trimEnd() });
    insertBlock(type, current.id);
  };
  const moveBlock = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = blocks.findIndex((entry) => entry.id === dragId);
    const to = blocks.findIndex((entry) => entry.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDragId(null);
  };

  return <section className="editor">
    <div className="editor-toolbar">
      <span className="eyebrow">Page content</span>
      <div className="toolbar-actions">
        <button className="text-button" onClick={() => insertBlock("paragraph")}><span>＋</span> Add block</button>
        <span className="autosave"><i /> Saved locally</span>
      </div>
    </div>
    <div className="block-list">
      {blocks.map((current, index) => <div className={`block-row ${dragId === current.id ? "is-dragging" : ""}`} key={current.id} draggable onDragStart={() => setDragId(current.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveBlock(current.id)}>
        <button className="drag-handle" aria-label={`Drag ${blockLabels[current.type]}`} title="Drag to reorder">⠿</button>
        <div className="block-content">
          {current.type === "divider" ? <div className="block-divider" /> : <div className={`block-input block-${current.type}`}>
            {current.type === "todo" && <input aria-label="To-do complete" type="checkbox" checked={Boolean(current.checked)} onChange={(event) => updateBlock(current.id, { checked: event.target.checked })} />}
            <textarea aria-label={`${blockLabels[current.type]} block ${index + 1}`} value={current.text} placeholder={current.type === "paragraph" ? "Type something, or use / for blocks" : blockLabels[current.type]} onChange={(event) => handleText(current, event.target.value)} onKeyDown={(event) => handleKey(event, current)} rows={current.type === "code" || current.type === "callout" || current.type === "quote" ? 2 : 1} />
          </div>}
          {slashBlockId === current.id && filteredTypes.length > 0 && <div className="slash-menu">
            <div className="slash-heading">Insert block <span>↑↓ Enter</span></div>
            {filteredTypes.slice(0, 7).map((type, typeIndex) => <button className={slashIndex === typeIndex ? "highlighted" : ""} key={type} onMouseEnter={() => setSlashIndex(typeIndex)} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSlash(type)}><span className={`slash-icon icon-${type}`}>{type === "divider" ? "—" : type === "todo" ? "☑" : type === "code" ? "‹›" : "T"}</span>{blockLabels[type]}<span className="slash-shortcut">{typeIndex === 0 ? "↵" : ""}</span></button>)}
          </div>}
        </div>
      </div>)}
    </div>
    <button className="add-block-row" onClick={() => insertBlock("paragraph")}><span>＋</span> Click to add a block</button>
  </section>;
}

function Sidebar({ items, selectedId, expanded, onSelect, onToggle, onCreatePage, onCreateDatabase, onRename, onDelete }: {
  items: Item[]; selectedId: string; expanded: Set<string>; onSelect: (id: string) => void; onToggle: (id: string) => void; onCreatePage: (parentId: string | null) => void; onCreateDatabase: () => void; onRename: (id: string, title: string) => void; onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const childrenOf = (parentId: string | null) => items.filter((item) => item.parentId === parentId);
  const beginRename = (item: Item) => { setEditingId(item.id); setEditingValue(item.title); };
  const finishRename = () => { if (editingId && editingValue.trim()) onRename(editingId, editingValue.trim()); setEditingId(null); };
  const renderNode = (item: Item, depth: number): React.ReactNode => {
    const children = childrenOf(item.id);
    const hasChildren = children.length > 0;
    return <div key={item.id} className="tree-group">
      <div className={`tree-row ${selectedId === item.id ? "active" : ""}`} style={{ paddingLeft: `${12 + depth * 18}px` }}>
        <button className="chevron" aria-label={expanded.has(item.id) ? "Collapse" : "Expand"} onClick={() => hasChildren && onToggle(item.id)}>{hasChildren ? (expanded.has(item.id) ? "⌄" : "›") : "·"}</button>
        <button className="tree-label" onClick={() => onSelect(item.id)}><span className={`tree-icon ${item.kind === "database" ? "database-icon" : ""}`}>{item.icon}</span>{editingId === item.id ? <input autoFocus value={editingValue} onChange={(event) => setEditingValue(event.target.value)} onBlur={finishRename} onKeyDown={(event) => { if (event.key === "Enter") finishRename(); if (event.key === "Escape") setEditingId(null); }} onClick={(event) => event.stopPropagation()} /> : <span>{item.title}</span>}</button>
        <div className="tree-actions">{item.kind === "page" && <button aria-label={`New page inside ${item.title}`} onClick={(event) => { event.stopPropagation(); onCreatePage(item.id); }}>＋</button>}<button aria-label={`Rename ${item.title}`} onClick={(event) => { event.stopPropagation(); beginRename(item); }}>•••</button><button aria-label={`Delete ${item.title}`} onClick={(event) => { event.stopPropagation(); onDelete(item.id); }}>×</button></div>
      </div>
      {expanded.has(item.id) && children.map((child) => renderNode(child, depth + 1))}
    </div>;
  };
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark">P</div><div><strong>Personal Space</strong><span>Private workspace</span></div><button className="sidebar-more" aria-label="Workspace menu">•••</button></div>
    <div className="sidebar-nav"><button className="nav-item" onClick={() => onSelect("home")}><span className="nav-glyph">⌂</span> Home <kbd>H</kbd></button><button className="nav-item" onClick={() => onSelect("search")}><span className="nav-glyph">⌕</span> Quick find <kbd>⌘K</kbd></button></div>
    <div className="sidebar-section"><div className="section-heading"><span>Workspace</span><button aria-label="New page" onClick={() => onCreatePage(null)}>＋</button></div><div className="tree">{childrenOf(null).map((item) => renderNode(item, 0))}</div></div>
    <div className="sidebar-footer"><button className="new-button" onClick={() => onCreatePage(null)}><span>＋</span> New page</button><button className="new-button secondary" onClick={onCreateDatabase}><span>▦</span> New database</button><div className="storage-note"><span className="local-dot" /> Changes stored in this browser</div></div>
  </aside>;
}

function PropertyCell({ property, value, onChange }: { property: Property; value: CellValue; onChange: (value: CellValue) => void }) {
  if (property.type === "checkbox") return <label className="cell-check"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span>{value ? "Done" : "No"}</span></label>;
  if (property.type === "select") return <select className="cell-select" value={String(value || "")} onChange={(event) => onChange(event.target.value)}><option value="">Empty</option>{(property.options || []).map((entry) => <option key={entry.id} value={entry.label}>{entry.label}</option>)}</select>;
  if (property.type === "multi-select") return <select className="cell-select multi" multiple value={Array.isArray(value) ? value : []} onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((entry) => entry.value))}>{(property.options || []).map((entry) => <option key={entry.id} value={entry.label}>{entry.label}</option>)}</select>;
  return <input className="cell-input" type={property.type === "number" ? "number" : property.type === "date" ? "date" : property.type === "url" ? "url" : "text"} value={valueText(value)} onChange={(event) => onChange(property.type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value)} placeholder={propertyLabels[property.type]} />;
}

function PropertyManager({ database, onUpdate }: { database: Database; onUpdate: (database: Database) => void }) {
  const addProperty = () => {
    const name = window.prompt("Property name", "New property");
    if (!name?.trim()) return;
    const typeInput = window.prompt("Type: text, number, select, multi-select, date, checkbox, or url", "text")?.toLowerCase().trim() as PropertyType;
    const type = Object.keys(propertyLabels).includes(typeInput) ? typeInput : "text";
    const next: Property = { id: uid("property"), name: name.trim(), type };
    if (type === "select" || type === "multi-select") next.options = [option("Option 1", palette[0]), option("Option 2", palette[1])];
    onUpdate({ ...database, properties: [...database.properties, next] });
  };
  const rename = (property: Property) => {
    const name = window.prompt("Rename property", property.name);
    if (!name?.trim()) return;
    onUpdate({ ...database, properties: database.properties.map((entry) => entry.id === property.id ? { ...entry, name: name.trim() } : entry) });
  };
  const remove = (property: Property) => {
    if (!window.confirm(`Remove ${property.name}? Values in this column will be deleted.`)) return;
    const nextRows = database.rows.map((row) => { const values = { ...row.values }; delete values[property.id]; return { ...row, values }; });
    const cleanView = (view: ViewSettings): ViewSettings => ({ ...view, groupBy: view.groupBy === property.id ? "" : view.groupBy, sortBy: view.sortBy === property.id ? "" : view.sortBy, filters: view.filters.filter((filter) => filter.propertyId !== property.id) });
    const nextViews = database.views ? Object.fromEntries(Object.entries(database.views).map(([mode, view]) => [mode, view ? cleanView(view) : view])) as Partial<Record<ViewMode, ViewSettings>> : undefined;
    onUpdate({ ...database, properties: database.properties.filter((entry) => entry.id !== property.id), rows: nextRows, view: cleanView(database.view), views: nextViews });
  };
  const addOption = (property: Property) => {
    const label = window.prompt("Option label", "New option");
    if (!label?.trim()) return;
    const next = { ...property, options: [...(property.options || []), option(label.trim(), palette[(property.options || []).length % palette.length])] };
    onUpdate({ ...database, properties: database.properties.map((entry) => entry.id === property.id ? next : entry) });
  };
  return <div className="property-manager"><div className="property-manager-head"><div><span className="eyebrow">Schema</span><strong>Properties</strong></div><button className="small-button" onClick={addProperty}>＋ Add property</button></div><div className="property-chips">{database.properties.map((property) => <div className="property-chip" key={property.id}><span className="property-type-dot type-{property.type}" /><span>{property.name}</span><small>{propertyLabels[property.type]}</small><button onClick={() => rename(property)} aria-label={`Rename ${property.name}`}>✎</button>{(property.type === "select" || property.type === "multi-select") && <button onClick={() => addOption(property)} aria-label={`Add option to ${property.name}`}>＋</button>}<button className="danger-quiet" onClick={() => remove(property)} aria-label={`Remove ${property.name}`}>×</button></div>)}</div></div>;
}

function RowPage({ database, row, onUpdate, onBack }: { database: Database; row: Row; onUpdate: (database: Database) => void; onBack: () => void }) {
  const updateValue = (propertyId: string, value: CellValue) => onUpdate({ ...database, rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, values: { ...entry.values, [propertyId]: value } } : entry) });
  const updateBlocks = (blocks: Block[]) => onUpdate({ ...database, rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, blocks } : entry) });
  const updateTitle = (title: string) => onUpdate({ ...database, rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, title } : entry) });
  return <div className="row-page"><button className="back-link" onClick={onBack}>← Back to {database.title}</button><div className="row-page-heading"><span className="page-kicker">Database row</span><input className="row-title-input" value={row.title} onChange={(event) => updateTitle(event.target.value)} /></div><div className="row-properties">{database.properties.map((property) => <label key={property.id}><span>{property.name}</span><PropertyCell property={property} value={getValue(row, property.id)} onChange={(value) => updateValue(property.id, value)} /></label>)}</div><BlockEditor item={row} onChange={updateBlocks} /></div>;
}

function DatabaseView({ database, onUpdate, initialRowId }: { database: Database; onUpdate: (database: Database) => void; initialRowId?: string | null }) {
  const [openRowId, setOpenRowId] = useState<string | null>(initialRowId || null);
  const activeView = database.views?.[database.view.mode] || database.view;
  const updateView = (patch: Partial<ViewSettings>) => {
    const nextView = { ...activeView, ...patch, mode: activeView.mode };
    onUpdate({ ...database, view: nextView, views: { ...database.views, [activeView.mode]: nextView } });
  };
  const switchMode = (mode: ViewMode) => {
    const nextView = database.views?.[mode] || { ...emptyView(mode), groupBy: database.properties.find((entry) => entry.type === "select")?.id || "" };
    onUpdate({ ...database, view: nextView, views: { ...database.views, [mode]: nextView } });
  };
  const updateCell = (rowId: string, propertyId: string, value: CellValue) => onUpdate({ ...database, rows: database.rows.map((row) => row.id === rowId ? { ...row, values: { ...row.values, [propertyId]: value } } : row) });
  const visibleRows = useMemo(() => {
    let rows = database.rows.filter((row) => activeView.filters.every((filter) => { const prop = database.properties.find((entry) => entry.id === filter.propertyId); return prop ? matchesFilter(row, prop, filter) : true; }));
    if (activeView.sortBy) {
      const sortProperty = database.properties.find((entry) => entry.id === activeView.sortBy);
      if (sortProperty) rows = [...rows].sort((a, b) => { const av = valueText(a.values[sortProperty.id]).toLowerCase(); const bv = valueText(b.values[sortProperty.id]).toLowerCase(); return activeView.sortDir === "asc" ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true }); });
    }
    return rows;
  }, [activeView, database.properties, database.rows]);
  const addRow = () => onUpdate({ ...database, rows: [...database.rows, { id: uid("row"), title: "Untitled row", values: Object.fromEntries(database.properties.map((entry) => [entry.id, entry.type === "checkbox" ? false : entry.type === "multi-select" ? [] : ""])), blocks: [block("paragraph")] }] });
  const deleteRow = (rowId: string) => { if (window.confirm("Delete this row permanently?")) onUpdate({ ...database, rows: database.rows.filter((row) => row.id !== rowId) }); };
  const addFilter = () => { const first = database.properties[0]; if (!first) return; updateView({ filters: [...activeView.filters, { propertyId: first.id, query: "", operator: defaultFilterOperator(first) }] }); };
  const changeFilter = (index: number, patch: Partial<Filter>) => {
    const nextFilters = activeView.filters.map((filter, filterIndex) => {
      if (filterIndex !== index) return filter;
      if (patch.propertyId && patch.propertyId !== filter.propertyId) return { ...filter, ...patch, query: "", operator: defaultFilterOperator(database.properties.find((entry) => entry.id === patch.propertyId)) };
      return { ...filter, ...patch };
    });
    updateView({ filters: nextFilters });
  };
  const removeFilter = (index: number) => updateView({ filters: activeView.filters.filter((_, filterIndex) => filterIndex !== index) });
  const openRow = openRowId ? database.rows.find((row) => row.id === openRowId) : undefined;
  if (openRow) return <RowPage database={database} row={openRow} onUpdate={onUpdate} onBack={() => setOpenRowId(null)} />;
  const selectProperty = database.properties.find((entry) => entry.id === activeView.groupBy && entry.type === "select") || database.properties.find((entry) => entry.type === "select");
  const columns = selectProperty?.options || [];
  const moveCard = (rowId: string, label: string) => { if (!selectProperty) return; updateCell(rowId, selectProperty.id, label); };
  const filterOperators = (property: Property | undefined): FilterOperator[] => property?.type === "checkbox" ? ["checked", "unchecked"] : property?.type === "date" ? ["before", "after", "is", "is-not"] : property?.type === "select" ? ["is", "is-not", "contains"] : ["contains", "is", "is-not"];
  return <div className="database-page"><div className="database-heading"><div><div className="page-kicker">Database</div><h1><span className="database-title-icon">{database.icon}</span>{database.title}</h1><p>{database.rows.length} records · {database.properties.length} properties</p></div><button className="primary-button" onClick={addRow}>＋ New row</button></div><div className="database-toolbar"><div className="view-switcher">{(["table", "board", "list"] as ViewMode[]).map((mode) => <button className={activeView.mode === mode ? "active" : ""} key={mode} onClick={() => switchMode(mode)}><span>{mode === "table" ? "▤" : mode === "board" ? "▥" : "☷"}</span>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div><div className="view-settings"><label>Sort <select value={activeView.sortBy} onChange={(event) => updateView({ sortBy: event.target.value })}><option value="">None</option>{database.properties.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>{activeView.sortBy && <button className="icon-button" aria-label="Reverse sort direction" onClick={() => updateView({ sortDir: activeView.sortDir === "asc" ? "desc" : "asc" })}>{activeView.sortDir === "asc" ? "↑" : "↓"}</button>}<button className="small-button" onClick={addFilter}>＋ Filter</button></div></div>{activeView.filters.length > 0 && <div className="filter-bar">{activeView.filters.map((filter, index) => { const filterProperty = database.properties.find((entry) => entry.id === filter.propertyId); return <div className="filter-pill" key={`${filter.propertyId}-${index}`}><span>Filter</span><select value={filter.propertyId} onChange={(event) => changeFilter(index, { propertyId: event.target.value })}>{database.properties.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><select value={filter.operator} onChange={(event) => changeFilter(index, { operator: event.target.value as FilterOperator })}>{filterOperators(filterProperty).map((operator) => <option key={operator} value={operator}>{filterOperatorLabels[operator]}</option>)}</select>{filterProperty?.type !== "checkbox" && <input type={filterProperty?.type === "date" ? "date" : "text"} placeholder={filterProperty?.type === "date" ? "Choose date" : "Value…"} value={filter.query} onChange={(event) => changeFilter(index, { query: event.target.value })} />}<button aria-label="Remove filter" onClick={() => removeFilter(index)}>×</button></div>; })}</div>}{activeView.mode === "table" && <div className="table-wrap"><table><thead><tr><th className="row-title-col">Name</th>{database.properties.map((entry) => <th key={entry.id}>{entry.name}<small>{propertyLabels[entry.type]}</small></th>)}<th /></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td className="row-name"><div className="row-name-cell"><span className="row-bullet">↗</span><input className="row-title-cell" aria-label={`Title for ${row.title}`} value={row.title} onChange={(event) => onUpdate({ ...database, rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, title: event.target.value } : entry) })} /><button className="row-open" aria-label={`Open ${row.title}`} onClick={() => setOpenRowId(row.id)}>→</button></div></td>{database.properties.map((entry) => <td key={entry.id}><PropertyCell property={entry} value={getValue(row, entry.id)} onChange={(value) => updateCell(row.id, entry.id, value)} /></td>)}<td><button className="delete-row" onClick={() => deleteRow(row.id)} aria-label={`Delete ${row.title}`}>×</button></td></tr>)}</tbody></table>{visibleRows.length === 0 && <div className="empty-state">No rows match these filters.</div>}<button className="add-row-link" onClick={addRow}>＋ Add a row</button></div>}{activeView.mode === "board" && <div className="board-wrap"><div className="board-toolbar"><label>Group by <select value={selectProperty?.id || ""} onChange={(event) => updateView({ groupBy: event.target.value })}>{database.properties.filter((entry) => entry.type === "select").map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><span>Drag cards between columns to update the select value.</span></div><div className="board-columns">{columns.length ? columns.map((column) => <div className="board-column" key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const rowId = event.dataTransfer.getData("row-id"); if (rowId) moveCard(rowId, column.label); }}><div className="column-heading"><span className="color-dot" style={{ background: column.color }} />{column.label}<small>{visibleRows.filter((row) => getValue(row, selectProperty?.id || "") === column.label).length}</small></div>{visibleRows.filter((row) => getValue(row, selectProperty?.id || "") === column.label).map((row) => <article className="board-card" key={row.id} draggable onDragStart={(event) => event.dataTransfer.setData("row-id", row.id)} onClick={() => setOpenRowId(row.id)}><div className="card-title">{row.title}</div><div className="card-meta">{database.properties.slice(0, 2).map((entry) => <span key={entry.id}>{entry.name}: {valueText(getValue(row, entry.id))}</span>)}</div></article>)}</div>) : <div className="empty-state">Add a select property to create board columns.</div>}</div></div>}{activeView.mode === "list" && <div className="list-view">{visibleRows.map((row) => <button className="list-row" key={row.id} onClick={() => setOpenRowId(row.id)}><span className="list-leading">↗</span><strong>{row.title}</strong><span className="list-properties">{database.properties.slice(0, 2).map((entry) => <span key={entry.id}><small>{entry.name}</small>{valueText(getValue(row, entry.id)) || "—"}</span>)}</span><span className="list-arrow">→</span></button>)}{visibleRows.length === 0 && <div className="empty-state">No rows match these filters.</div>}</div>}<PropertyManager database={database} onUpdate={onUpdate} /></div>;
}

export default function Home() {
  const [items, setItems] = useState<Item[]>(() => normalizeItems(makeSeed()));
  const [selectedId, setSelectedId] = useState("home");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["home", "work", "personal"]));
  const [theme, setTheme] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
    try {
      const stored = window.localStorage.getItem("personal-space-items");
      const storedTheme = window.localStorage.getItem("personal-space-theme") as Theme | null;
      if (stored) {
        const parsedItems = normalizeItems(JSON.parse(stored) as Item[]);
        const seedVersion = window.localStorage.getItem("personal-space-seed-version");
        const nextItems = seedVersion === "2" ? parsedItems : mergeSeedAdditions(parsedItems);
        setItems(nextItems);
        window.localStorage.setItem("personal-space-seed-version", "2");
      } else {
        window.localStorage.setItem("personal-space-seed-version", "2");
      }
      if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
    } catch { /* use the seed when browser storage is unavailable */ }
    setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem("personal-space-items", JSON.stringify(items)); }, [items, hydrated]);
  useEffect(() => { if (hydrated) window.localStorage.setItem("personal-space-theme", theme); }, [theme, hydrated]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); } if (event.key === "Escape") setSearchOpen(false); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  useEffect(() => { if (searchOpen) setTimeout(() => searchInput.current?.focus(), 20); }, [searchOpen]);
  const selected = items.find((item) => item.id === selectedId) || items[0];
  const updateItem = (next: Item) => setItems((current) => current.map((item) => item.id === next.id ? next : item));
  const selectItem = (id: string, rowId?: string) => { setSelectedId(id); setSelectedRowId(rowId || null); setSearchOpen(false); setQuery(""); };
  const createPage = (parentId: string | null) => { const page: Page = { id: uid("page"), kind: "page", title: "Untitled page", icon: "✦", parentId, blocks: [block("paragraph")] }; setItems((current) => [...current, page]); if (parentId) setExpanded((current) => new Set(current).add(parentId)); selectItem(page.id); };
  const createDatabase = () => { const statusId = uid("property"); const database: Database = { id: uid("database"), kind: "database", title: "Untitled database", icon: "▦", parentId: null, properties: [{ id: statusId, name: "Status", type: "select", options: [option("Backlog", palette[0]), option("Done", palette[3])] }], rows: [], view: { ...emptyView("table"), groupBy: statusId }, views: { table: { ...emptyView("table"), groupBy: statusId }, board: { ...emptyView("board"), groupBy: statusId }, list: emptyView("list") } }; setItems((current) => [...current, database]); selectItem(database.id); };
  const rename = (id: string, title: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, title } : item));
  const changeIcon = (id: string) => { const item = items.find((entry) => entry.id === id); if (!item) return; const icon = window.prompt("Choose an emoji icon", item.icon); if (icon?.trim()) setItems((current) => current.map((entry) => entry.id === id ? { ...entry, icon: icon.trim().slice(0, 3) } : entry)); };
  const deleteItem = (id: string) => { const target = items.find((item) => item.id === id); if (!target || id === "home" || !window.confirm(`Delete “${target.title}” and all nested pages?`)) return; const descendants = new Set<string>([id]); let changed = true; while (changed) { changed = false; items.forEach((item) => { if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) { descendants.add(item.id); changed = true; } }); } setItems((current) => current.filter((item) => !descendants.has(item.id))); selectItem("home"); };
  const searchResults = useMemo<SearchResult[]>(() => { const needle = query.toLowerCase().trim(); if (!needle) return []; return items.flatMap((item) => { const results: SearchResult[] = []; if (item.title.toLowerCase().includes(needle)) results.push({ id: item.id, label: item.title, kind: item.kind === "database" ? "Database" : "Page", parentId: item.parentId }); if (item.kind === "database") item.rows.forEach((row) => { if (row.title.toLowerCase().includes(needle)) results.push({ id: item.id, label: row.title, kind: `Row in ${item.title}`, parentId: item.parentId, rowId: row.id }); }); return results; }); }, [items, query]);
  const pageBlocks = isPage(selected) ? selected.blocks : [];
  const updateSelectedBlocks = (blocks: Block[]) => { if (isPage(selected)) updateItem({ ...selected, blocks }); };
  return <main className={`app-shell theme-${theme}`}>
    <Sidebar items={items} selectedId={selectedId} expanded={expanded} onSelect={(id) => id === "search" ? setSearchOpen(true) : selectItem(id)} onToggle={(id) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onCreatePage={createPage} onCreateDatabase={createDatabase} onRename={rename} onDelete={deleteItem} />
    <section className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span>›</span><strong>{selected?.title || "Home"}</strong></div><div className="topbar-actions"><button className="search-trigger" onClick={() => setSearchOpen(true)}><span>⌕</span><span>Search your space</span><kbd>⌘ K</kbd></button><button className="theme-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">{theme === "light" ? "☾" : "☼"}</button><div className="avatar">A</div></div></header><div className="content-scroll">{isDatabase(selected) ? <DatabaseView key={`${selected.id}-${selectedRowId || "none"}`} database={selected} onUpdate={updateItem} initialRowId={selectedRowId} /> : <div className="page-view"><div className="page-heading"><button className="page-icon" aria-label="Change page icon" title="Change page icon" onClick={() => selected && changeIcon(selected.id)}>{selected?.icon || "⌂"}</button><input className="page-title-input" value={selected?.title || ""} onChange={(event) => selected && rename(selected.id, event.target.value)} aria-label="Page title" /><button className="page-menu" aria-label="Page options" onClick={() => selected && deleteItem(selected.id)}>•••</button></div><div className="page-caption">Personal Space <span>·</span> edited just now</div><BlockEditor item={selected && isPage(selected) ? selected : { ...items[0] as Page, blocks: pageBlocks }} onChange={updateSelectedBlocks} /></div>}</div></section>
    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Quick find" onClick={() => setSearchOpen(false)}><div className="search-dialog" onClick={(event) => event.stopPropagation()}><div className="search-input-wrap"><span>⌕</span><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, databases and rows…" /><kbd>ESC</kbd></div>{query ? <div className="search-results">{searchResults.map((result) => <button key={`${result.id}-${result.rowId || "item"}`} onClick={() => selectItem(result.id, result.rowId)}><span className="result-icon">{result.kind.startsWith("Row") ? "↗" : result.kind === "Database" ? "▦" : "✦"}</span><span><strong>{result.label}</strong><small>{result.kind}</small></span><span className="result-arrow">→</span></button>)}{searchResults.length === 0 && <div className="no-results">No pages or rows found for “{query}”.</div>}</div> : <div className="search-empty"><span className="search-command">⌘K</span><p>Find anything in your workspace</p><small>Search titles as you type. Press Escape to close.</small></div>}</div></div>}
  </main>;
}
