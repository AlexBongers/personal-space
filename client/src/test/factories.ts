import type { Block, BlockType, PageNode, Property, PropertyType, Row, View, ViewKind } from '@shared';

let counter = 0;
const id = (prefix: string) => `${prefix}_${++counter}`;

export function node(title: string, children: PageNode[] = [], extra: Partial<PageNode> = {}): PageNode {
  return {
    id: extra.id ?? id('pg'),
    parentId: null,
    kind: 'page',
    title,
    icon: '📄',
    position: 0,
    children,
    ...extra,
  };
}

export function block(type: BlockType, text = '', extra: Partial<Block> = {}): Block {
  return {
    id: extra.id ?? id('bl'),
    pageId: 'pg_1',
    type,
    text,
    checked: false,
    position: 0,
    ...extra,
  };
}

export function property(name: string, type: PropertyType, extra: Partial<Property> = {}): Property {
  return {
    id: extra.id ?? id('pr'),
    databaseId: 'db_1',
    name,
    type,
    options: [],
    position: 0,
    ...extra,
  };
}

export function row(title: string, values: Row['values'] = {}, extra: Partial<Row> = {}): Row {
  return {
    id: extra.id ?? id('rw'),
    databaseId: 'db_1',
    title,
    position: 0,
    values,
    ...extra,
  };
}

export function view(kind: ViewKind, extra: Partial<View> = {}): View {
  return {
    id: extra.id ?? id('vw'),
    databaseId: 'db_1',
    kind,
    filters: [],
    sort: null,
    groupPropertyId: null,
    ...extra,
  };
}
