import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Block, BlockType } from '@shared';
import { api, newId } from '../api.ts';
import { LIST_TYPES, filterSpecs } from '../blocks.ts';
import { useDebounced } from '../hooks.ts';
import { BlockRow } from './BlockRow.tsx';
import { SlashMenu } from './SlashMenu.tsx';
import { anchorBelow, type Anchor } from './Popover.tsx';

interface SlashState {
  blockId: string;
  /** Index of the '/' that opened the menu. */
  start: number;
  query: string;
  index: number;
}

interface BlockEditorProps {
  pageId: string;
  initial: Block[];
}

/** The ordinal a numbered block shows: its place in the run it belongs to. */
export function ordinalFor(blocks: Block[], index: number): number {
  let ordinal = 1;
  for (let i = index - 1; i >= 0 && blocks[i].type === 'numbered'; i--) ordinal++;
  return ordinal;
}

/** Enter keeps you in a list, and drops you back to plain text everywhere else. */
export function typeAfter(block: Block): BlockType {
  return LIST_TYPES.includes(block.type) ? block.type : 'paragraph';
}

function anchorFor(blockId: string): Anchor {
  const el = document.querySelector(`[data-testid="block-${blockId}"]`);
  const rect = el?.getBoundingClientRect();
  if (!rect) return { x: 200, y: 200 };
  return { ...anchorBelow(rect), x: rect.left + 34 };
}

export function BlockEditor({ pageId, initial }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);

  const pending = useRef(new Map<string, string>());

  /**
   * Every write goes through one promise chain, so a block is always created
   * on the server before anything tries to edit or move it.
   */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback((work: () => Promise<unknown>) => {
    const next = chain.current.then(work, work).catch(() => {});
    chain.current = next;
    return next;
  }, []);

  const flush = useCallback(
    (keepalive = false) => {
      const entries = [...pending.current];
      pending.current.clear();
      for (const [id, text] of entries) {
        enqueue(() => api.updateBlock(id, { text }, keepalive));
      }
    },
    [enqueue],
  );

  const scheduleFlush = useDebounced(flush, 350);

  useEffect(() => {
    const onLeave = () => flush(true);
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      flush();
    };
  }, [flush]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setText = (id: string, text: string) => {
    setBlocks((current) => current.map((b) => (b.id === id ? { ...b, text } : b)));
    pending.current.set(id, text);
    scheduleFlush();
  };

  const handleText = (block: Block, text: string) => {
    setText(block.id, text);

    if (slash && slash.blockId === block.id) {
      const query = text.slice(slash.start + 1);
      if (text[slash.start] !== '/' || /\s/.test(query)) setSlash(null);
      else setSlash({ ...slash, query, index: 0 });
      return;
    }
    if (text.endsWith('/')) {
      const start = text.length - 1;
      if (start === 0 || /\s/.test(text[start - 1])) {
        setSlash({ blockId: block.id, start, query: '', index: 0 });
      }
    }
  };

  /** Renders the new block immediately; the server catches up behind it. */
  const insertBelow = (afterId: string | null, type: BlockType = 'paragraph') => {
    const created: Block = { id: newId('bl'), pageId, type, text: '', checked: false, position: 0 };
    setBlocks((current) => {
      const index = current.findIndex((b) => b.id === afterId);
      const next = [...current];
      next.splice(index < 0 ? next.length : index + 1, 0, created);
      return next;
    });
    setFocusId(created.id);
    enqueue(() => api.createBlock(pageId, { id: created.id, type, afterId }));
    return created;
  };

  const remove = (id: string) => {
    pending.current.delete(id);
    const index = blocks.findIndex((b) => b.id === id);
    setBlocks((current) => current.filter((b) => b.id !== id));
    setFocusId(index > 0 ? blocks[index - 1].id : null);
    if (slash?.blockId === id) setSlash(null);
    enqueue(() => api.deleteBlock(id));
  };

  const setType = (id: string, type: BlockType, text?: string) => {
    setBlocks((current) =>
      current.map((b) => (b.id === id ? { ...b, type, text: text ?? b.text } : b)),
    );
    enqueue(() => api.updateBlock(id, { type, ...(text === undefined ? {} : { text }) }));
  };

  const toggleCheck = (block: Block) => {
    const checked = !block.checked;
    setBlocks((current) => current.map((b) => (b.id === block.id ? { ...b, checked } : b)));
    enqueue(() => api.updateBlock(block.id, { checked }));
  };

  const pickSpec = (type: BlockType) => {
    if (!slash) return;
    const block = blocks.find((b) => b.id === slash.blockId);
    if (!block) return;
    const text = block.text.slice(0, slash.start);
    setSlash(null);
    pending.current.delete(block.id);
    setType(block.id, type, type === 'divider' ? '' : text);
    if (type === 'divider') insertBelow(block.id, 'paragraph');
    else setFocusId(block.id);
  };

  const onKeyDown = (block: Block, e: KeyboardEvent<HTMLDivElement>) => {
    if (slash && slash.blockId === block.id) {
      const specs = filterSpecs(slash.query);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : specs.length - 1;
        setSlash({ ...slash, index: specs.length ? (slash.index + step) % specs.length : 0 });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const spec = specs[slash.index];
        if (spec) pickSpec(spec.type);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertBelow(block.id, typeAfter(block));
      return;
    }
    if (e.key === 'Backspace' && block.text === '') {
      e.preventDefault();
      remove(block.id);
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(blocks, from, to);
    setBlocks(next);
    flush();
    enqueue(() =>
      api.reorderBlocks(
        pageId,
        next.map((b) => b.id),
      ),
    );
  };

  const specs = slash ? filterSpecs(slash.query) : [];

  return (
    <div className="editor" data-testid="block-editor">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              ordinal={ordinalFor(blocks, index)}
              focused={focusId === block.id}
              onText={(text) => handleText(block, text)}
              onKeyDown={(e) => onKeyDown(block, e)}
              onFocus={() => setFocusId(block.id)}
              onToggleCheck={() => toggleCheck(block)}
              onInsertBelow={() => insertBelow(block.id)}
              onSetType={(type) => setType(block.id, type)}
              onDelete={() => remove(block.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        className="editor__tail"
        aria-label="Add a block"
        onClick={() => insertBelow(blocks.length ? blocks[blocks.length - 1].id : null)}
      >
        {blocks.length === 0 && <span className="editor__hint">Click here and start writing…</span>}
      </button>

      {slash && (
        <SlashMenu
          anchor={() => anchorFor(slash.blockId)}
          specs={specs}
          activeIndex={slash.index}
          onHover={(index) => setSlash({ ...slash, index })}
          onPick={pickSpec}
          onClose={() => setSlash(null)}
        />
      )}
    </div>
  );
}
