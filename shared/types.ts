export interface Page {
  id: string;
  title: string;
  parentId: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  id: string;
  pageId: string;
  name: string;
  properties: Property[];
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  name: string;
  type: "text" | "number" | "select" | "multi-select" | "date" | "checkbox" | "url";
  options?: SelectOption[];
}

export interface SelectOption {
  id: string;
  value: string;
  color: string;
}

export interface Row {
  id: string;
  databaseId: string;
  pageId?: string;
  title: string;
  data: Record<string, unknown>;
  index?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Block {
  id: string;
  pageId: string;
  type: "paragraph" | "heading1" | "heading2" | "heading3" | "bulleted_list" | "numbered_list" | "todo" | "quote" | "divider" | "code" | "callout";
  content: string;
  position: number;
  checked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface View {
  id: string;
  databaseId: string;
  type: "table" | "board" | "list";
  name: string;
  filters: Filter[];
  sortField: string | null;
  sortDirection: "asc" | "desc";
  groupField: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Filter {
  id: string;
  field: string;
  operator: string;
  value: unknown;
}