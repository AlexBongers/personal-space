import { useState } from 'react';
import type { Filter, Property, View, ViewKind } from '@shared';
import { newId } from '../api.ts';
import { OPERATOR_LABELS, TITLE_KEY, isUnary, operatorsFor } from '../query.ts';
import { MenuItem, Popover, anchorBelow, type Anchor } from './Popover.tsx';
import { ArrowDown, ArrowUp, Board, Close, Filter as FilterIcon, ListIcon, Plus, Table } from './icons.tsx';

const KINDS: { kind: ViewKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'table', label: 'Table', icon: <Table /> },
  { kind: 'board', label: 'Board', icon: <Board /> },
  { kind: 'list', label: 'List', icon: <ListIcon /> },
];

interface ViewToolbarProps {
  views: View[];
  view: View;
  properties: Property[];
  visibleCount: number;
  totalCount: number;
  onSwitch: (kind: ViewKind) => void;
  onPatch: (patch: Partial<Omit<View, 'id' | 'databaseId' | 'kind'>>) => void;
}

export function ViewToolbar(props: ViewToolbarProps) {
  const { view, properties } = props;
  const [filterAnchor, setFilterAnchor] = useState<Anchor | null>(null);
  const [sortAnchor, setSortAnchor] = useState<Anchor | null>(null);
  const [groupAnchor, setGroupAnchor] = useState<Anchor | null>(null);

  const selectProps = properties.filter((p) => p.type === 'select');
  const grouping = properties.find((p) => p.id === view.groupPropertyId) ?? null;
  const sortProperty =
    view.sort?.propertyId === TITLE_KEY
      ? { name: 'Name' }
      : properties.find((p) => p.id === view.sort?.propertyId);

  const open = (set: (a: Anchor) => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    set(anchorBelow(e.currentTarget.getBoundingClientRect()));
  };

  return (
    <div className="database__bar">
      <div className="switcher" role="tablist" aria-label="View">
        {KINDS.map(({ kind, label, icon }) => (
          <button
            key={kind}
            role="tab"
            aria-selected={view.kind === kind}
            className={`switcher__btn switcher__btn--${kind}${
              view.kind === kind ? ' switcher__btn--on' : ''
            }`}
            onClick={() => props.onSwitch(kind)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <button
        className={`btn btn--ghost${view.filters.length ? ' btn--marked' : ''}`}
        onClick={open(setFilterAnchor)}
      >
        <FilterIcon /> Filter{view.filters.length ? ` (${view.filters.length})` : ''}
      </button>

      <button
        className={`btn btn--ghost${view.sort ? ' btn--marked' : ''}`}
        onClick={open(setSortAnchor)}
      >
        {view.sort?.direction === 'desc' ? <ArrowDown /> : <ArrowUp />} Sort
        {sortProperty ? `: ${sortProperty.name}` : ''}
      </button>

      {view.kind === 'board' && (
        <button
          className={`btn btn--ghost${grouping ? ' btn--marked' : ''}`}
          onClick={open(setGroupAnchor)}
        >
          <Board /> Group{grouping ? `: ${grouping.name}` : ''}
        </button>
      )}

      <span className="database__count" data-testid="row-count">
        {props.visibleCount === props.totalCount
          ? `${props.totalCount} ${props.totalCount === 1 ? 'row' : 'rows'}`
          : `${props.visibleCount} of ${props.totalCount} rows`}
      </span>

      {filterAnchor && (
        <FilterPanel
          anchor={filterAnchor}
          properties={properties}
          filters={view.filters}
          onClose={() => setFilterAnchor(null)}
          onChange={(filters) => props.onPatch({ filters })}
        />
      )}

      {sortAnchor && (
        <Popover anchor={sortAnchor} onClose={() => setSortAnchor(null)} label="Sort">
          <div className="menu__label">Sort by</div>
          <div className="menu__scroll">
            <MenuItem
              label="No sort"
              active={!view.sort}
              onClick={() => {
                props.onPatch({ sort: null });
                setSortAnchor(null);
              }}
            >
              <Close /> No sort
            </MenuItem>
            {[{ id: TITLE_KEY, name: 'Name' }, ...properties].map((property) => (
              <MenuItem
                key={property.id}
                label={`Sort by ${property.name}`}
                active={view.sort?.propertyId === property.id}
                onClick={() => {
                  const flip =
                    view.sort?.propertyId === property.id && view.sort.direction === 'asc';
                  props.onPatch({
                    sort: { propertyId: property.id, direction: flip ? 'desc' : 'asc' },
                  });
                  setSortAnchor(null);
                }}
              >
                {view.sort?.propertyId === property.id && view.sort.direction === 'desc' ? (
                  <ArrowDown />
                ) : (
                  <ArrowUp />
                )}
                {property.name}
              </MenuItem>
            ))}
          </div>
          {view.sort && (
            <>
              <div className="menu__sep" />
              <MenuItem
                label="Reverse direction"
                onClick={() => {
                  props.onPatch({
                    sort: {
                      propertyId: view.sort!.propertyId,
                      direction: view.sort!.direction === 'asc' ? 'desc' : 'asc',
                    },
                  });
                  setSortAnchor(null);
                }}
              >
                {view.sort.direction === 'asc' ? <ArrowDown /> : <ArrowUp />} Reverse direction
              </MenuItem>
            </>
          )}
        </Popover>
      )}

      {groupAnchor && (
        <Popover anchor={groupAnchor} onClose={() => setGroupAnchor(null)} label="Group by">
          <div className="menu__label">Group by</div>
          {selectProps.length === 0 && <div className="slash__empty">Add a select property first</div>}
          {selectProps.map((property) => (
            <MenuItem
              key={property.id}
              label={`Group by ${property.name}`}
              active={view.groupPropertyId === property.id}
              onClick={() => {
                props.onPatch({ groupPropertyId: property.id });
                setGroupAnchor(null);
              }}
            >
              {property.name}
            </MenuItem>
          ))}
        </Popover>
      )}
    </div>
  );
}

function FilterPanel({
  anchor,
  properties,
  filters,
  onClose,
  onChange,
}: {
  anchor: Anchor;
  properties: Property[];
  filters: Filter[];
  onClose: () => void;
  onChange: (filters: Filter[]) => void;
}) {
  const replace = (id: string, patch: Partial<Filter>) =>
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const add = () => {
    const property = properties[0];
    if (!property) return;
    onChange([
      ...filters,
      {
        id: newId('ft'),
        propertyId: property.id,
        operator: operatorsFor(property.type)[0],
        value: null,
      },
    ]);
  };

  return (
    <Popover anchor={anchor} onClose={onClose} className="menu filter-panel" role="dialog" label="Filters">
      <div className="menu__label">Filters (all must match)</div>
      {filters.length === 0 && <div className="slash__empty">No filters yet</div>}

      {filters.map((filter) => {
        const property = properties.find((p) => p.id === filter.propertyId) ?? properties[0];
        if (!property) return null;
        const operators = operatorsFor(property.type);
        return (
          <div className="filter-row" key={filter.id}>
            <select
              className="field"
              aria-label="Filter property"
              value={filter.propertyId}
              onChange={(e) => {
                const next = properties.find((p) => p.id === e.target.value)!;
                replace(filter.id, {
                  propertyId: next.id,
                  operator: operatorsFor(next.type)[0],
                  value: null,
                });
              }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              className="field"
              aria-label="Filter condition"
              value={filter.operator}
              onChange={(e) => replace(filter.id, { operator: e.target.value as Filter['operator'] })}
            >
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {OPERATOR_LABELS[operator]}
                </option>
              ))}
            </select>

            {!isUnary(filter.operator) && <FilterValue property={property} filter={filter} onChange={replace} />}

            <button
              className="row__action"
              aria-label="Remove filter"
              onClick={() => onChange(filters.filter((f) => f.id !== filter.id))}
            >
              <Close />
            </button>
          </div>
        );
      })}

      <div className="menu__sep" />
      <MenuItem label="Add filter" onClick={add}>
        <Plus /> Add filter
      </MenuItem>
    </Popover>
  );
}

function FilterValue({
  property,
  filter,
  onChange,
}: {
  property: Property;
  filter: Filter;
  onChange: (id: string, patch: Partial<Filter>) => void;
}) {
  if (property.type === 'select' || property.type === 'multi_select') {
    return (
      <select
        className="field"
        aria-label="Filter value"
        value={typeof filter.value === 'string' ? filter.value : ''}
        onChange={(e) => onChange(filter.id, { value: e.target.value || null })}
      >
        <option value="">Choose…</option>
        {property.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="field"
      aria-label="Filter value"
      type={property.type === 'date' ? 'date' : property.type === 'number' ? 'number' : 'text'}
      value={filter.value === null || filter.value === undefined ? '' : String(filter.value)}
      onChange={(e) => onChange(filter.id, { value: e.target.value || null })}
    />
  );
}
