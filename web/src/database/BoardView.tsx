import { useRef } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useNavigate } from "react-router";
import type { DbRow, Property } from "../api";
import { Chip } from "./cells";
import { groupRows, type BoardColumn } from "./viewLogic";

interface Props {
  rows: DbRow[];
  groupProperty: Property;
  cardProperty?: Property;
  onMove: (rowId: string, optionId: string | null) => void;
}

function Card({ row, cardProperty, justDragged }: { row: DbRow; cardProperty?: Property; justDragged: React.RefObject<boolean> }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
  const chips =
    cardProperty && Array.isArray(row.values[cardProperty.id])
      ? (row.values[cardProperty.id] as string[])
      : cardProperty && row.values[cardProperty.id]
        ? [row.values[cardProperty.id] as string]
        : [];
  return (
    <div
      ref={setNodeRef}
      className={`board-card${isDragging ? " dragging" : ""}`}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging && !justDragged.current) navigate(`/p/${row.id}`);
      }}
    >
      <div className="board-card-title">{row.title || "Untitled"}</div>
      {chips.length > 0 && cardProperty && (
        <div className="board-card-chips">
          {chips
            .map((id) => cardProperty.options.find((o) => o.id === id))
            .filter(Boolean)
            .map((o) => (
              <Chip key={o!.id} option={o!} />
            ))}
        </div>
      )}
    </div>
  );
}

function Column({
  column,
  groupProperty,
  cardProperty,
  justDragged,
}: {
  column: BoardColumn;
  groupProperty: Property;
  cardProperty?: Property;
  justDragged: React.RefObject<boolean>;
}) {
  const id = column.option ? `col:${column.option.id}` : "col:none";
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`board-col${isOver ? " over" : ""}`} data-column={column.option?.name ?? "none"}>
      <div className="board-col-head">
        {column.option ? <Chip option={column.option} /> : <span className="board-col-none">No {groupProperty.name}</span>}
        <span className="board-count">{column.rows.length}</span>
      </div>
      <div className="board-cards">
        {column.rows.map((row) => (
          <Card key={row.id} row={row} cardProperty={cardProperty} justDragged={justDragged} />
        ))}
      </div>
    </div>
  );
}

export default function BoardView({ rows, groupProperty, cardProperty, onMove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const columns = groupRows(rows, groupProperty);
  const justDragged = useRef(false);

  const onDragEnd = (event: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
    const { active, over } = event;
    if (!over) return;
    const target = String(over.id);
    const optionId = target === "col:none" ? null : target.replace("col:", "");
    const row = rows.find((r) => r.id === active.id);
    if (row && (row.values[groupProperty.id] ?? null) !== optionId) {
      onMove(String(active.id), optionId);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="board" data-testid="board">
        {columns.map((column) => (
          <Column
            key={column.option?.id ?? "none"}
            column={column}
            groupProperty={groupProperty}
            cardProperty={cardProperty}
            justDragged={justDragged}
          />
        ))}
      </div>
    </DndContext>
  );
}
