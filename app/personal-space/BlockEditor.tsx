"use client";

import { useMemo, useRef, useState } from "react";
import { blockLabels, compactText, createBlock } from "./model";
import type { Block, BlockType, Page, Row } from "./types";

type BlockEditorProps = {
  item: Page | Row;
  onChange: (blocks: Block[]) => void;
};

const blockGlyph: Record<BlockType, string> = {
  paragraph: "T",
  heading1: "H1",
  heading2: "H2",
  heading3: "H3",
  bulleted: "•",
  numbered: "1.",
  todo: "☑",
  quote: "“",
  divider: "—",
  code: "‹›",
  callout: "✦",
};

export function BlockEditor({ item, onChange }: BlockEditorProps) {
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const editorRef = useRef<HTMLElement>(null);
  const blocks = useMemo(() => (item.blocks.length ? item.blocks : [createBlock("paragraph")]), [item.blocks]);
  const filteredTypes = (Object.keys(blockLabels) as BlockType[]).filter((type) =>
    compactText(blockLabels[type]).includes(compactText(slashQuery)),
  );

  const focusBlock = (id: string) => {
    window.requestAnimationFrame(() => {
      const input = editorRef.current?.querySelector<HTMLTextAreaElement>(`[data-block-id="${id}"]`);
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  };

  const updateBlock = (id: string, patch: Partial<Block>) =>
    onChange(blocks.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));

  const insertBlock = (type: BlockType, afterId?: string) => {
    const index = afterId ? blocks.findIndex((entry) => entry.id === afterId) + 1 : blocks.length;
    const nextBlock = createBlock(type);
    onChange([...blocks.slice(0, index), nextBlock, ...blocks.slice(index)]);
    setSlashBlockId(null);
    setSlashQuery("");
    setSlashIndex(0);
    focusBlock(nextBlock.id);
  };

  const chooseSlash = (type: BlockType) => {
    if (!slashBlockId) return;
    const current = blocks.find((entry) => entry.id === slashBlockId);
    if (!current) return;
    const cleanedBlocks = blocks.map((entry) =>
      entry.id === current.id
        ? { ...entry, text: entry.text.replace(/(?:^|\s)\/[^\s]*$/, "").trimEnd() }
        : entry,
    );
    const currentIndex = cleanedBlocks.findIndex((entry) => entry.id === current.id);
    const nextBlock = createBlock(type);
    onChange([
      ...cleanedBlocks.slice(0, currentIndex + 1),
      nextBlock,
      ...cleanedBlocks.slice(currentIndex + 1),
    ]);
    setSlashBlockId(null);
    setSlashQuery("");
    setSlashIndex(0);
    focusBlock(nextBlock.id);
  };

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>, current: Block) => {
    if (event.key === "/") {
      setSlashBlockId(current.id);
      setSlashQuery("");
      setSlashIndex(0);
    }
    if (slashBlockId === current.id) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((index) => Math.min(index + 1, Math.max(filteredTypes.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter" && filteredTypes.length > 0) {
        event.preventDefault();
        chooseSlash(filteredTypes[slashIndex] || filteredTypes[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSlashBlockId(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      insertBlock("paragraph", current.id);
      return;
    }
    if (event.key === "Backspace" && !current.text && blocks.length > 1) {
      event.preventDefault();
      const index = blocks.findIndex((entry) => entry.id === current.id);
      const previous = blocks[Math.max(0, index - 1)];
      onChange(blocks.filter((entry) => entry.id !== current.id));
      focusBlock(previous.id);
    }
  };

  const handleText = (current: Block, text: string) => {
    updateBlock(current.id, { text });
    const slash = text.match(/(?:^|\s)\/([^\s]*)$/);
    if (slash) {
      setSlashBlockId(current.id);
      setSlashQuery(slash[1]);
      setSlashIndex(0);
    } else {
      setSlashBlockId(null);
    }
  };

  const moveBlock = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = blocks.findIndex((entry) => entry.id === dragId);
    const to = blocks.findIndex((entry) => entry.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDragId(null);
  };

  return (
    <section className="editor" ref={editorRef}>
      <div className="editor-toolbar">
        <span className="eyebrow">Page content</span>
        <div className="toolbar-actions">
          <button className="text-button" onClick={() => insertBlock("paragraph")}>
            <span>＋</span> Add block
          </button>
          <span className="autosave"><i /> Saved locally</span>
        </div>
      </div>
      <div className="block-list">
        {blocks.map((current, index) => (
          <div
            className={`block-row ${dragId === current.id ? "is-dragging" : ""}`}
            key={current.id}
            draggable
            onDragStart={() => setDragId(current.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => moveBlock(current.id)}
          >
            <button className="drag-handle" aria-label={`Drag ${blockLabels[current.type]}`} title="Drag to reorder">⠿</button>
            <div className="block-content">
              {current.type === "divider" ? (
                <div className="block-divider" />
              ) : (
                <div className={`block-input block-${current.type}`}>
                  {current.type === "todo" && (
                    <input
                      aria-label="To-do complete"
                      type="checkbox"
                      checked={Boolean(current.checked)}
                      onChange={(event) => updateBlock(current.id, { checked: event.target.checked })}
                    />
                  )}
                  <textarea
                    data-block-id={current.id}
                    aria-label={`${blockLabels[current.type]} block ${index + 1}`}
                    value={current.text}
                    placeholder={current.type === "paragraph" ? "Type something, or use / for blocks" : blockLabels[current.type]}
                    onChange={(event) => handleText(current, event.target.value)}
                    onKeyDown={(event) => handleKey(event, current)}
                    rows={current.type === "code" || current.type === "callout" || current.type === "quote" ? 2 : 1}
                  />
                </div>
              )}
              {slashBlockId === current.id && filteredTypes.length > 0 && (
                <div className="slash-menu">
                  <div className="slash-heading">Insert block <span>↑↓ Enter</span></div>
                  {filteredTypes.slice(0, 7).map((type, typeIndex) => (
                    <button
                      className={slashIndex === typeIndex ? "highlighted" : ""}
                      key={type}
                      onMouseEnter={() => setSlashIndex(typeIndex)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => chooseSlash(type)}
                    >
                      <span className={`slash-icon icon-${type}`}>{blockGlyph[type]}</span>
                      {blockLabels[type]}
                      <span className="slash-shortcut">{typeIndex === 0 ? "↵" : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button className="add-block-row" onClick={() => insertBlock("paragraph")}>
        <span>＋</span> Click to add a block
      </button>
    </section>
  );
}
