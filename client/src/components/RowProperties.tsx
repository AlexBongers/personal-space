import { useState } from 'react';
import type { Property, PropertyValue, SelectOption } from '@shared';
import { api, newId } from '../api.ts';
import { PROPERTY_GLYPHS } from '../db.ts';
import { nextColor } from '../useDatabase.ts';
import { Cell } from './Cell.tsx';

interface RowPropertiesProps {
  rowId: string;
  properties: Property[];
  values: Record<string, PropertyValue>;
}

/** The property panel at the top of a row opened as a page. */
export function RowProperties({ rowId, properties, values: initial }: RowPropertiesProps) {
  const [values, setValues] = useState(initial);
  const [options, setOptions] = useState<Record<string, SelectOption[]>>(() =>
    Object.fromEntries(properties.map((p) => [p.id, p.options])),
  );

  const setCell = (propertyId: string, value: PropertyValue) => {
    setValues((current) => ({ ...current, [propertyId]: value }));
    api.updateRow(rowId, { values: { [propertyId]: value } }).catch(() => {});
  };

  const addOption = (property: Property, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = options[property.id] ?? property.options;
    const match = existing.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
    const option = match ?? { id: newId('op'), name: trimmed, color: nextColor(existing.length) };

    if (!match) {
      const next = [...existing, option];
      setOptions((current) => ({ ...current, [property.id]: next }));
      api.updateProperty(property.id, { options: next }).catch(() => {});
    }
    const current = values[property.id];
    setCell(
      property.id,
      property.type === 'multi_select'
        ? [...(Array.isArray(current) ? current : []), option.id]
        : option.id,
    );
  };

  if (properties.length === 0) return null;

  return (
    <dl className="props" data-testid="row-properties">
      {properties.map((property) => (
        <div className="props__row" key={property.id}>
          <dt className="props__name">
            <span className="table__glyph">{PROPERTY_GLYPHS[property.type]}</span>
            {property.name}
          </dt>
          <dd className="props__value">
            <Cell
              property={{ ...property, options: options[property.id] ?? property.options }}
              value={values[property.id] ?? null}
              rowTitle="this entry"
              onChange={(value) => setCell(property.id, value)}
              onAddOption={(name) => addOption(property, name)}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
