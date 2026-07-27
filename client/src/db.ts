import type { Property, PropertyType, PropertyValue, SelectOption } from '@shared';

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  multi_select: 'Multi-select',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'URL',
};

export const PROPERTY_GLYPHS: Record<PropertyType, string> = {
  text: 'T',
  number: '#',
  select: '◉',
  multi_select: '◍',
  date: '📅',
  checkbox: '☑',
  url: '↗',
};

/** The option ids a cell holds, whether the property is single or multi. */
export function selectedIds(value: PropertyValue): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [value];
  return [];
}

export function optionsFor(property: Property, value: PropertyValue): SelectOption[] {
  const ids = selectedIds(value);
  return ids
    .map((id) => property.options.find((option) => option.id === id))
    .filter((option): option is SelectOption => Boolean(option));
}

/** A human-readable rendering of a cell, used by list view and search. */
export function displayValue(property: Property, value: PropertyValue): string {
  if (value === null || value === undefined || value === '') return '';
  switch (property.type) {
    case 'checkbox':
      return value ? 'Yes' : 'No';
    case 'select':
    case 'multi_select':
      return optionsFor(property, value)
        .map((option) => option.name)
        .join(', ');
    case 'date':
      return formatDate(String(value));
    default:
      return String(value);
  }
}

/** ISO date to something readable, leaving anything unparseable alone. */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** What to show for a page, row or card whose title has been emptied. */
export function displayTitle(title: string): string {
  return title.trim() || 'Untitled';
}

export function isEmptyValue(value: PropertyValue): boolean {
  if (value === null || value === undefined || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}
