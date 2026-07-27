import type { Property, Row } from '@shared';
import { displayTitle, displayValue, optionsFor } from '../db.ts';
import { Chip } from './Cell.tsx';

interface ListViewProps {
  rows: Row[];
  properties: Property[];
  onOpenRow: (id: string) => void;
}

/** A compact list: the title, plus the first couple of properties. */
export function ListView({ rows, properties, onOpenRow }: ListViewProps) {
  const shown = properties.slice(0, 2);

  return (
    <ul className="list" data-testid="list-view">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            className="list__row"
            data-testid={`list-row-${row.title}`}
            onClick={() => onOpenRow(row.id)}
          >
            <span className="list__title">{displayTitle(row.title)}</span>
            <span className="list__meta">
              {shown.map((property) => {
                const value = row.values[property.id] ?? null;
                if (property.type === 'select' || property.type === 'multi_select') {
                  return optionsFor(property, value).map((option) => (
                    <Chip key={option.id} option={option} />
                  ));
                }
                const text = displayValue(property, value);
                return text ? (
                  <span key={property.id} className="list__pair">
                    <span className="list__label">{property.name}</span> {text}
                  </span>
                ) : null;
              })}
            </span>
          </button>
        </li>
      ))}
      {rows.length === 0 && <li className="board__empty">Nothing matches.</li>}
    </ul>
  );
}
