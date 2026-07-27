import type {
  Filter,
  FilterOperator,
  Property,
  PropertyType,
  PropertyValue,
  Row,
  Sort,
} from '@shared';
import { selectedIds } from './db.ts';

/** Sentinel used when a view sorts by the row title rather than a property. */
export const TITLE_KEY = '__title';

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: 'contains',
  not_contains: 'does not contain',
  is: 'is',
  is_not: 'is not',
  is_checked: 'is checked',
  is_not_checked: 'is not checked',
  before: 'is before',
  after: 'is after',
};

/** The operators that make sense for each property type. */
export function operatorsFor(type: PropertyType): FilterOperator[] {
  switch (type) {
    case 'checkbox':
      return ['is_checked', 'is_not_checked'];
    case 'date':
      return ['before', 'after'];
    case 'select':
    case 'multi_select':
      return ['is', 'is_not'];
    case 'number':
      return ['is', 'is_not'];
    default:
      return ['contains', 'not_contains'];
  }
}

/** True when the operator carries no value of its own. */
export function isUnary(operator: FilterOperator): boolean {
  return operator === 'is_checked' || operator === 'is_not_checked';
}

function text(value: PropertyValue): string {
  return value === null || value === undefined ? '' : String(value);
}

export function matchesFilter(row: Row, property: Property, filter: Filter): boolean {
  const value = row.values[property.id] ?? null;
  const wanted = filter.value;

  switch (filter.operator) {
    case 'is_checked':
      return value === true;
    case 'is_not_checked':
      return value !== true;
    case 'contains':
      return text(value).toLowerCase().includes(text(wanted).toLowerCase());
    case 'not_contains':
      return !text(value).toLowerCase().includes(text(wanted).toLowerCase());
    case 'is':
      if (property.type === 'select' || property.type === 'multi_select') {
        return selectedIds(value).includes(text(wanted));
      }
      if (property.type === 'number') return Number(value) === Number(wanted);
      return text(value) === text(wanted);
    case 'is_not':
      if (property.type === 'select' || property.type === 'multi_select') {
        return !selectedIds(value).includes(text(wanted));
      }
      if (property.type === 'number') return Number(value) !== Number(wanted);
      return text(value) !== text(wanted);
    case 'before':
      return Boolean(value) && text(value) < text(wanted);
    case 'after':
      return Boolean(value) && text(value) > text(wanted);
    default:
      return true;
  }
}

/** Every filter must pass; filters pointing at a missing property are ignored. */
export function applyFilters(rows: Row[], properties: Property[], filters: Filter[]): Row[] {
  const active = filters
    .map((filter) => ({ filter, property: properties.find((p) => p.id === filter.propertyId) }))
    .filter((entry): entry is { filter: Filter; property: Property } => Boolean(entry.property))
    .filter((entry) => isUnary(entry.filter.operator) || !isEmpty(entry.filter.value));

  if (active.length === 0) return rows;
  return rows.filter((row) => active.every(({ filter, property }) => matchesFilter(row, property, filter)));
}

function isEmpty(value: PropertyValue): boolean {
  return value === null || value === undefined || value === '';
}

/** Rank a cell so nulls always sink to the bottom regardless of direction. */
function rank(row: Row, property: Property | null): { empty: boolean; key: string | number } {
  if (!property) return { empty: !row.title, key: row.title.toLowerCase() };
  const value = row.values[property.id] ?? null;
  if (isEmpty(value) || (Array.isArray(value) && value.length === 0)) return { empty: true, key: '' };

  switch (property.type) {
    case 'number':
      return { empty: false, key: Number(value) };
    case 'checkbox':
      return { empty: false, key: value === true ? 1 : 0 };
    case 'select': {
      const index = property.options.findIndex((option) => option.id === value);
      return { empty: false, key: index < 0 ? property.options.length : index };
    }
    case 'multi_select':
      return {
        empty: false,
        key: selectedIds(value)
          .map((id) => property.options.find((o) => o.id === id)?.name ?? '')
          .join(', ')
          .toLowerCase(),
      };
    default:
      return { empty: false, key: String(value).toLowerCase() };
  }
}

export function applySort(rows: Row[], properties: Property[], sort: Sort | null): Row[] {
  if (!sort) return rows;
  const property =
    sort.propertyId === TITLE_KEY ? null : properties.find((p) => p.id === sort.propertyId);
  if (sort.propertyId !== TITLE_KEY && !property) return rows;

  const direction = sort.direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = rank(a, property ?? null);
    const right = rank(b, property ?? null);
    if (left.empty !== right.empty) return left.empty ? 1 : -1;
    if (left.key === right.key) return 0;
    return (left.key < right.key ? -1 : 1) * direction;
  });
}

export function applyView(
  rows: Row[],
  properties: Property[],
  filters: Filter[],
  sort: Sort | null,
): Row[] {
  return applySort(applyFilters(rows, properties, filters), properties, sort);
}

/** The board's droppable id for the column holding rows with no value. */
export const NO_VALUE = '__none';

export interface CardMove {
  rowId: string;
  value: string | null;
}

/**
 * Works out what dropping a card on a column should change, or null when the
 * drop is a no-op.
 */
export function cardMove(
  rows: Row[],
  grouping: Property | null,
  activeId: string,
  overId: string | null,
): CardMove | null {
  if (!grouping || overId === null) return null;
  const row = rows.find((r) => r.id === activeId);
  if (!row) return null;
  const value = overId === NO_VALUE ? null : overId;
  if ((row.values[grouping.id] ?? null) === value) return null;
  return { rowId: row.id, value };
}

export interface BoardColumn {
  id: string | null;
  name: string;
  color: string;
  rows: Row[];
}

/** One column per option of the grouping property, plus a home for the empties. */
export function groupRows(rows: Row[], property: Property | null): BoardColumn[] {
  if (!property) return [{ id: null, name: 'All rows', color: 'gray', rows }];

  const columns: BoardColumn[] = property.options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
    rows: [],
  }));
  const none: BoardColumn = { id: null, name: 'No value', color: 'gray', rows: [] };

  for (const row of rows) {
    const value = row.values[property.id] ?? null;
    const column = columns.find((c) => c.id === value);
    (column ?? none).rows.push(row);
  }
  return [...columns, none];
}
