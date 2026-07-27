import { useState } from 'react';
import type { Property, PropertyType, Row } from '@shared';
import { PROPERTY_GLYPHS, PROPERTY_LABELS } from '../db.ts';
import type { DatabaseStore } from '../useDatabase.ts';
import { Cell } from './Cell.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { MenuItem, Popover, anchorBelow, type Anchor } from './Popover.tsx';
import { Dots, Plus, Trash } from './icons.tsx';

interface TableViewProps {
  store: DatabaseStore;
  rows: Row[];
  onOpenRow: (id: string) => void;
}

const TYPES: PropertyType[] = [
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'checkbox',
  'url',
];

export function TableView({ store, rows, onOpenRow }: TableViewProps) {
  const [addAnchor, setAddAnchor] = useState<Anchor | null>(null);
  const [menu, setMenu] = useState<{ property: Property; anchor: Anchor } | null>(null);
  const [renaming, setRenaming] = useState<Property | null>(null);
  const [confirmDrop, setConfirmDrop] = useState<Property | null>(null);
  const [rowMenu, setRowMenu] = useState<{ row: Row; anchor: Anchor } | null>(null);

  return (
    <div className="table-wrap">
      <table className="table" data-testid="table-view">
        <thead>
          <tr>
            <th className="table__title-col">Name</th>
            {store.properties.map((property) => (
              <th key={property.id}>
                {renaming?.id === property.id ? (
                  <PropertyName
                    property={property}
                    onDone={(name) => {
                      setRenaming(null);
                      if (name) store.renameProperty(property.id, name);
                    }}
                  />
                ) : (
                  <button
                    className="table__head-btn"
                    aria-label={`Column ${property.name}`}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setMenu({ property, anchor: anchorBelow(r, 4) });
                    }}
                  >
                    <span className="table__glyph">{PROPERTY_GLYPHS[property.type]}</span>
                    {property.name}
                  </button>
                )}
              </th>
            ))}
            <th className="table__add-col">
              <button
                className="row__action"
                aria-label="Add property"
                onClick={(e) => {
                  setAddAnchor(anchorBelow(e.currentTarget.getBoundingClientRect(), 4));
                }}
              >
                <Plus />
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid={`row-${row.title}`}>
              <td className="table__title-col">
                <div className="table__title">
                  <input
                    className="cell__input cell__input--title"
                    value={row.title}
                    placeholder="Untitled"
                    aria-label={`Title of ${row.title}`}
                    onChange={(e) => store.renameRow(row.id, e.target.value)}
                  />
                  <button
                    className="btn btn--ghost btn--tiny"
                    aria-label={`Open ${row.title}`}
                    onClick={() => onOpenRow(row.id)}
                  >
                    Open
                  </button>
                </div>
              </td>
              {store.properties.map((property) => (
                <td key={property.id} data-testid={`cell-${property.name}-${row.title}`}>
                  <Cell
                    property={property}
                    value={row.values[property.id] ?? null}
                    rowTitle={row.title}
                    onChange={(value) => store.setCell(row.id, property.id, value)}
                    onAddOption={(name) => {
                      const optionId = store.addOption(property.id, name);
                      if (!optionId) return;
                      const current = row.values[property.id];
                      store.setCell(
                        row.id,
                        property.id,
                        property.type === 'multi_select'
                          ? [...(Array.isArray(current) ? current : []), optionId]
                          : optionId,
                      );
                    }}
                  />
                </td>
              ))}
              <td className="table__add-col">
                <button
                  className="row__action"
                  aria-label={`Actions for ${row.title}`}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setRowMenu({ row, anchor: anchorBelow(r, 4) });
                  }}
                >
                  <Dots />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={store.properties.length + 2} className="table__empty">
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <button className="table__new-row" onClick={() => store.addRow()}>
        <Plus /> New row
      </button>

      {addAnchor && (
        <NewPropertyForm
          anchor={addAnchor}
          onClose={() => setAddAnchor(null)}
          onCreate={(name, type) => {
            setAddAnchor(null);
            store.addProperty(name, type);
          }}
        />
      )}

      {menu && (
        <Popover
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          label={`${menu.property.name} column`}
        >
          <div className="menu__label">{PROPERTY_LABELS[menu.property.type]} property</div>
          <MenuItem
            label="Rename property"
            onClick={() => {
              setRenaming(menu.property);
              setMenu(null);
            }}
          >
            Rename
          </MenuItem>
          <div className="menu__sep" />
          <MenuItem
            label="Delete property"
            danger
            onClick={() => {
              setConfirmDrop(menu.property);
              setMenu(null);
            }}
          >
            <Trash /> Delete property
          </MenuItem>
        </Popover>
      )}

      {rowMenu && (
        <Popover
          anchor={rowMenu.anchor}
          onClose={() => setRowMenu(null)}
          label={`${rowMenu.row.title} actions`}
        >
          <MenuItem
            label="Open as page"
            onClick={() => {
              onOpenRow(rowMenu.row.id);
              setRowMenu(null);
            }}
          >
            Open as page
          </MenuItem>
          <div className="menu__sep" />
          <MenuItem
            label="Delete row"
            danger
            onClick={() => {
              store.removeRow(rowMenu.row.id);
              setRowMenu(null);
            }}
          >
            <Trash /> Delete row
          </MenuItem>
        </Popover>
      )}

      {confirmDrop && (
        <ConfirmDialog
          title={`Delete the "${confirmDrop.name}" property?`}
          body="Its value on every row goes with it. This cannot be undone."
          onCancel={() => setConfirmDrop(null)}
          onConfirm={() => {
            store.removeProperty(confirmDrop.id);
            setConfirmDrop(null);
          }}
        />
      )}
    </div>
  );
}

function PropertyName({
  property,
  onDone,
}: {
  property: Property;
  onDone: (name: string | null) => void;
}) {
  const [value, setValue] = useState(property.name);
  return (
    <input
      className="field field--head"
      autoFocus
      aria-label="Property name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') onDone(null);
      }}
    />
  );
}

function NewPropertyForm({
  anchor,
  onClose,
  onCreate,
}: {
  anchor: Anchor;
  onClose: () => void;
  onCreate: (name: string, type: PropertyType) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PropertyType>('text');

  return (
    <Popover anchor={anchor} onClose={onClose} role="dialog" label="New property">
      <form
        className="menu__pad"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name, type);
        }}
      >
        <input
          className="field"
          autoFocus
          placeholder="Property name"
          aria-label="New property name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="menu__label">Type</div>
        <div className="type-grid">
          {TYPES.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={PROPERTY_LABELS[option]}
              aria-pressed={type === option}
              className={`type-chip${type === option ? ' type-chip--on' : ''}`}
              onClick={() => setType(option)}
            >
              <span className="table__glyph">{PROPERTY_GLYPHS[option]}</span>
              {PROPERTY_LABELS[option]}
            </button>
          ))}
        </div>
        <button className="btn btn--primary btn--wide" type="submit">
          Create property
        </button>
      </form>
    </Popover>
  );
}
