import { useMemo, useCallback } from "react";
import type { Block as BlockType } from "shared/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BlockRenderer from "./BlockRenderer";
import styles from "./Editor.module.css";

function SortableBlock({
  block,
  number,
  focusId,
  onClearFocus,
  onChange,
  onEnter,
  onDelete,
  onTypeChange,
  onToggleTodo,
}: {
  block: BlockType;
  number?: number;
  focusId: string | null;
  onClearFocus: () => void;
  onChange: (id: string, content: string) => void;
  onEnter: (id: string, cursorPos: number) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, newType: BlockType["type"]) => void;
  onToggleTodo: (id: string, checked: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.sortableItem} ${isDragging ? styles.sortableDragging : ""}`}
    >
      <BlockRenderer
        block={block}
        number={number}
        focusId={focusId}
        onClearFocus={onClearFocus}
        onChange={onChange}
        onEnter={onEnter}
        onDelete={onDelete}
        onTypeChange={onTypeChange}
        onToggleTodo={onToggleTodo}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

interface BlockEditorProps {
  blocks: BlockType[];
  focusId: string | null;
  onClearFocus: () => void;
  onChange: (id: string, content: string) => void;
  onEnter: (id: string, cursorPos: number) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, newType: BlockType["type"]) => void;
  onToggleTodo: (id: string, checked: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export default function BlockEditor({
  blocks,
  focusId,
  onClearFocus,
  onChange,
  onEnter,
  onDelete,
  onTypeChange,
  onToggleTodo,
  onReorder,
}: BlockEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    },
    [blocks, onReorder]
  );

  const numbers = useMemo(() => {
    let counter = 0;
    return blocks.map((block, i) => {
      if (block.type !== "numbered_list") {
        counter = 0;
        return undefined;
      }
      const prevBlock = blocks[i - 1];
      if (!prevBlock || prevBlock.type !== "numbered_list") {
        counter = 1;
      }
      const num = counter;
      counter++;
      return num;
    });
  }, [blocks]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className={styles.editorWrapper}>
          {blocks.map((block, index) => (
            <SortableBlock
              key={block.id}
              block={block}
              number={numbers[index]}
              focusId={focusId}
              onClearFocus={onClearFocus}
              onChange={onChange}
              onEnter={onEnter}
              onDelete={onDelete}
              onTypeChange={onTypeChange}
              onToggleTodo={onToggleTodo}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
