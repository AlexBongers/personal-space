/** Shared domain types for Personal Space. */

export type PageKind = 'page' | 'database' | 'row';

export interface Page {
  id: string;
  parentId: string | null;
  kind: PageKind;
  title: string;
  icon: string | null;
  position: number;
}

export interface PageNode extends Page {
  children: PageNode[];
}

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'divider'
  | 'code'
  | 'callout';

export const BLOCK_TYPES: BlockType[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
  'quote',
  'divider',
  'code',
  'callout',
];

export interface Block {
  id: string;
  pageId: string;
  type: BlockType;
  text: string;
  checked: boolean;
  position: number;
}

export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'url';

export const PROPERTY_TYPES: PropertyType[] = [
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'checkbox',
  'url',
];

/** Palette keys for select options; the client maps these to concrete colors. */
export type OptionColor =
  | 'amber'
  | 'blue'
  | 'purple'
  | 'green'
  | 'red'
  | 'gray';

export const OPTION_COLORS: OptionColor[] = ['amber', 'blue', 'purple', 'green', 'red', 'gray'];

export interface SelectOption {
  id: string;
  name: string;
  color: OptionColor;
}

export interface Property {
  id: string;
  databaseId: string;
  name: string;
  type: PropertyType;
  options: SelectOption[];
  position: number;
}

/** A cell value: string | number | boolean | string[] | null, depending on property type. */
export type PropertyValue = string | number | boolean | string[] | null;

export interface Row {
  id: string;
  databaseId: string;
  title: string;
  position: number;
  values: Record<string, PropertyValue>;
}

export type ViewKind = 'table' | 'board' | 'list';

export type FilterOperator =
  | 'contains'
  | 'not_contains'
  | 'is'
  | 'is_not'
  | 'is_checked'
  | 'is_not_checked'
  | 'before'
  | 'after';

export interface Filter {
  id: string;
  propertyId: string;
  operator: FilterOperator;
  value: PropertyValue;
}

export interface Sort {
  propertyId: string;
  direction: 'asc' | 'desc';
}

export interface View {
  id: string;
  databaseId: string;
  kind: ViewKind;
  filters: Filter[];
  sort: Sort | null;
  groupPropertyId: string | null;
}

export interface DatabaseDetail {
  page: Page;
  properties: Property[];
  rows: Row[];
  views: View[];
}

export interface PageDetail {
  page: Page;
  blocks: Block[];
  breadcrumb: Page[];
  database: DatabaseDetail | null;
  /** For a row page: its property values and the parent database's property definitions. */
  row: { values: Record<string, PropertyValue>; properties: Property[] } | null;
}

export interface SearchResult {
  id: string;
  title: string;
  icon: string | null;
  kind: PageKind;
  parentTitle: string | null;
}
