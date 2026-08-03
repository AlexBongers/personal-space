export type Theme = "light" | "dark";

export type BlockType =
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

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "date"
  | "checkbox"
  | "url";

export type ViewMode = "table" | "board" | "list";
export type FilterOperator = "contains" | "is" | "is-not" | "before" | "after" | "checked" | "unchecked";

export type Block = { id: string; type: BlockType; text: string; checked?: boolean };
export type SelectOption = { id: string; label: string; color: string };
export type Property = { id: string; name: string; type: PropertyType; options?: SelectOption[] };
export type CellValue = string | number | boolean | string[] | null;
export type Filter = { propertyId: string; query: string; operator: FilterOperator };
export type ViewSettings = {
  mode: ViewMode;
  groupBy: string;
  filters: Filter[];
  sortBy: string;
  sortDir: "asc" | "desc";
};

export type Page = {
  id: string;
  kind: "page";
  title: string;
  icon: string;
  parentId: string | null;
  blocks: Block[];
};

export type Row = {
  id: string;
  title: string;
  values: Record<string, CellValue>;
  blocks: Block[];
};

export type Database = {
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

export type Item = Page | Database;
export type SearchResult = {
  id: string;
  label: string;
  kind: string;
  parentId: string | null;
  rowId?: string;
};
