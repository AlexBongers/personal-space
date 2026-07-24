import type { DatabaseRow, DatabaseProperty, Filter, Sort } from '../api';

export function filterRows(
  rows: DatabaseRow[],
  cells: { [rowId: string]: { [propId: string]: any } },
  properties: DatabaseProperty[],
  filters: Filter[]
): DatabaseRow[] {
  if (filters.length === 0) return rows;

  return rows.filter(row => {
    return filters.every(filter => {
      const prop = properties.find(p => p.id === filter.propertyId);
      if (!prop) return true;

      const cellValue = (cells[row.id] || {})[filter.propertyId];
      const value = cellValue !== undefined ? cellValue : null;

      switch (prop.type) {
        case 'text':
        case 'url': {
          if (filter.operator === 'contains') {
            const str = value !== null ? String(value).toLowerCase() : '';
            return str.includes(String(filter.value || '').toLowerCase());
          }
          return true;
        }
        case 'number': {
          const num = value !== null ? Number(value) : null;
          const filterNum = filter.value !== null && filter.value !== undefined && filter.value !== '' ? Number(filter.value) : null;
          if (filterNum === null) return true;
          if (num === null) return false;
          switch (filter.operator) {
            case 'equals': return num === filterNum;
            case 'greater than': return num > filterNum;
            case 'less than': return num < filterNum;
            default: return true;
          }
        }
        case 'select': {
          const rowValue = value !== null ? String(value) : '';
          switch (filter.operator) {
            case 'is': return rowValue === filter.value;
            case 'is not': return rowValue !== filter.value;
            default: return true;
          }
        }
        case 'multi_select': {
          const selected = Array.isArray(value) ? value : [];
          const filterVal = String(filter.value || '');
          switch (filter.operator) {
            case 'contains': return selected.includes(filterVal);
            case 'does not contain': return !selected.includes(filterVal);
            default: return true;
          }
        }
        case 'checkbox': {
          const checked = value === true || value === 1 || value === 'true';
          switch (filter.operator) {
            case 'is checked': return checked === true;
            case 'is not checked': return checked === false;
            default: return true;
          }
        }
        case 'date': {
          const rowDate = value !== null ? String(value) : null;
          const filterDate = filter.value ? String(filter.value) : null;
          if (!rowDate || !filterDate) return true;
          switch (filter.operator) {
            case 'before': return rowDate < filterDate;
            case 'after': return rowDate > filterDate;
            default: return true;
          }
        }
        default:
          return true;
      }
    });
  });
}

export function sortRows(
  rows: DatabaseRow[],
  cells: { [rowId: string]: { [propId: string]: any } },
  properties: DatabaseProperty[],
  sort: Sort | null
): DatabaseRow[] {
  if (!sort) return rows;

  const prop = properties.find(p => p.id === sort.propertyId);
  if (!prop) return rows;

  const direction = sort.direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const valA = (cells[a.id] || {})[sort.propertyId];
    const valB = (cells[b.id] || {})[sort.propertyId];

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    let cmp: number;

    switch (prop.type) {
      case 'number': {
        cmp = Number(valA) - Number(valB);
        break;
      }
      case 'select': {
        const optA = prop.options.find(o => o.id === valA);
        const optB = prop.options.find(o => o.id === valB);
        const labelA = optA ? optA.label.toLowerCase() : String(valA).toLowerCase();
        const labelB = optB ? optB.label.toLowerCase() : String(valB).toLowerCase();
        cmp = labelA.localeCompare(labelB);
        break;
      }
      case 'checkbox': {
        cmp = (valA ? 1 : 0) - (valB ? 1 : 0);
        break;
      }
      case 'date': {
        cmp = String(valA).localeCompare(String(valB));
        break;
      }
      default: {
        cmp = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
        break;
      }
    }

    return cmp * direction;
  });
}