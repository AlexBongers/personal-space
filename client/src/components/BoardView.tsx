import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Property, Row } from '@shared';
import { displayTitle, displayValue, isEmptyValue } from '../db.ts';
import { NO_VALUE, cardMove, type BoardColumn } from '../query.ts';
import type { DatabaseStore } from '../useDatabase.ts';
import { Chip } from './Cell.tsx';

interface BoardViewProps {
  store: DatabaseStore;
  columns: BoardColumn[];
  grouping: Property | null;
  onOpenRow: (id: string) => void;
}

export function BoardView({ store, columns, grouping, onOpenRow }: BoardViewProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const move = cardMove(store.rows, grouping, String(active.id), over ? String(over.id) : null);
    if (move && grouping) store.setCell(move.rowId, grouping.id, move.value);
  };

  if (!grouping) {
    return (
      <div className="board__note">
        Pick a select property to group by, using the <strong>Group</strong> button above.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      <div className="board" data-testid="board-view">
        {columns.map((column) => (
          <Column
            key={column.id ?? NO_VALUE}
            column={column}
            properties={store.properties}
            grouping={grouping}
            onOpenRow={onOpenRow}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  column,
  properties,
  grouping,
  onOpenRow,
}: {
  column: BoardColumn;
  properties: Property[];
  grouping: Property;
  onOpenRow: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id ?? NO_VALUE });

  return (
    <section
      ref={setNodeRef}
      className={`board__col${isOver ? ' board__col--over' : ''}`}
      data-testid={`board-column-${column.name}`}
      aria-label={`${column.name} column`}
    >
      <header className="board__head">
        <Chip option={{ id: column.id ?? NO_VALUE, name: column.name, color: column.color as never }} />
        <span className="board__count">{column.rows.length}</span>
      </header>
      <div className="board__cards">
        {column.rows.map((row) => (
          <Card
            key={row.id}
            row={row}
            properties={properties}
            grouping={grouping}
            onOpen={() => onOpenRow(row.id)}
          />
        ))}
        {column.rows.length === 0 && <p className="board__empty">Drop a card here</p>}
      </div>
    </section>
  );
}

function Card({
  row,
  properties,
  grouping,
  onOpen,
}: {
  row: Row;
  properties: Property[];
  grouping: Property;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
  const extras = properties
    .filter((p) => p.id !== grouping.id && !isEmptyValue(row.values[p.id] ?? null))
    .slice(0, 2);

  return (
    <article
      ref={setNodeRef}
      className={`card${isDragging ? ' card--dragging' : ''}`}
      data-testid={`card-${row.title}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      <button className="card__title" onClick={onOpen}>
        {displayTitle(row.title)}
      </button>
      {extras.length > 0 && (
        <dl className="card__meta">
          {extras.map((property) => (
            <div key={property.id}>
              <dt>{property.name}</dt>
              <dd>{displayValue(property, row.values[property.id] ?? null)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
