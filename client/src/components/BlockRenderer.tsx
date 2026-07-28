import { useRef, useCallback, useEffect, useState } from "react";
import type { Block } from "shared/types";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { DraggableAttributes } from "@dnd-kit/core";
import styles from "./Editor.module.css";
import SlashMenu from "./SlashMenu";

function getCursorPosition(editableElement: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return 0;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(editableElement);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function setCursorPosition(el: HTMLElement, pos: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let currentPos = 0;
  const stack: Node[] = [el];
  let foundNode: Node | null = null;
  let foundOffset = 0;

  while (stack.length > 0) {
    const node = stack.shift()!;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || "").length;
      if (currentPos + len >= pos) {
        foundNode = node;
        foundOffset = pos - currentPos;
        break;
      }
      currentPos += len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const children = node.childNodes;
      for (let i = children.length - 1; i >= 0; i--) {
        stack.unshift(children[i]);
      }
    }
  }

  if (foundNode) {
    range.setStart(foundNode, foundOffset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

interface BlockRendererProps {
  block: Block;
  number?: number;
  focusId: string | null;
  onClearFocus: () => void;
  onChange: (id: string, content: string) => void;
  onEnter: (id: string, cursorPos: number) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, newType: Block["type"]) => void;
  onToggleTodo: (id: string, checked: boolean) => void;
  dragHandleListeners?: SyntheticListenerMap;
  dragHandleAttributes?: DraggableAttributes;
}

const PLACEHOLDERS: Record<string, string> = {
  paragraph: "Type / for commands...",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  bulleted_list: "List item",
  numbered_list: "List item",
  todo: "To-do",
  quote: "Add a quote",
  code: "Write some code...",
  callout: "Add a callout...",
};

export default function BlockRenderer({
  block,
  number,
  focusId,
  onClearFocus,
  onChange,
  onEnter,
  onDelete,
  onTypeChange,
  onToggleTodo,
  dragHandleListeners,
  dragHandleAttributes,
}: BlockRendererProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const isComposing = useRef(false);
  const blockRef = useRef(block);

  blockRef.current = block;

  useEffect(() => {
    if (focusId === block.id && editableRef.current) {
      const el = editableRef.current;
      el.focus();
      setCursorPosition(el, el.textContent?.length || 0);
      onClearFocus();
    }
  }, [focusId, block.id, onClearFocus]);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== block.content) {
      el.textContent = block.content;
    }
  }, [block.content]);

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const text = el.textContent || "";

      if (showSlashMenu) {
        setSlashFilter(text);
        if (!text.startsWith("/")) {
          setShowSlashMenu(false);
        }
        return;
      }

      if (text.startsWith("/") && text.length === 1) {
        setShowSlashMenu(true);
        setSlashFilter("");
        return;
      }

      onChange(block.id, text);
    },
    [block.id, onChange, showSlashMenu]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isComposing.current) return;

      if (showSlashMenu) {
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const el = e.currentTarget;
        const cursorPos = getCursorPosition(el);
        onEnter(block.id, cursorPos);
        return;
      }

      if (e.key === "Backspace") {
        const el = e.currentTarget;
        const text = el.textContent || "";
        const cursorPos = getCursorPosition(el);

        if (cursorPos === 0 && text.length === 0) {
          e.preventDefault();
          onDelete(block.id);
          return;
        }
      }
    },
    [block.id, onEnter, onDelete, showSlashMenu]
  );

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLDivElement>) => {
      isComposing.current = false;
      const el = e.currentTarget;
      const text = el.textContent || "";

      if (showSlashMenu) {
        setSlashFilter(text);
        if (!text.startsWith("/")) {
          setShowSlashMenu(false);
        }
        return;
      }

      onChange(block.id, text);
    },
    [block.id, onChange, showSlashMenu]
  );

  const handleSlashSelect = useCallback(
    (newType: Block["type"]) => {
      setShowSlashMenu(false);
      setSlashFilter("");
      onTypeChange(block.id, newType);
    },
    [block.id, onTypeChange]
  );

  const handleSlashClose = useCallback(() => {
    setShowSlashMenu(false);
    setSlashFilter("");
  }, []);

  const handleToggleTodo = useCallback(() => {
    onToggleTodo(block.id, !block.checked);
  }, [block.id, block.checked, onToggleTodo]);

  const placeholder = PLACEHOLDERS[block.type] || "Type / for commands...";

  const renderEditable = (
    className: string,
    extraProps?: Record<string, unknown>
  ) => (
    <div
      ref={editableRef}
      className={className}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      data-testid={`block-content-${block.id}`}
      {...extraProps}
    >
      {block.content}
    </div>
  );

  const renderBlockContent = () => {
    switch (block.type) {
      case "paragraph":
        return renderEditable(styles.paragraph);
      case "heading1":
        return renderEditable(styles.heading1);
      case "heading2":
        return renderEditable(styles.heading2);
      case "heading3":
        return renderEditable(styles.heading3);
      case "divider":
        return (
          <div className={styles.divider}>
            <div className={styles.dividerLine} />
          </div>
        );
      case "bulleted_list":
        return (
          <div className={styles.bulletedList}>
            <span className={styles.bulletMarker}>•</span>
            <div
              ref={editableRef}
              className={styles.bulletContent}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              data-testid={`block-content-${block.id}`}
            >
              {block.content}
            </div>
          </div>
        );
      case "numbered_list":
        return (
          <div className={styles.numberedList}>
            <span className={styles.numberMarker}>{number ?? 1}.</span>
            <div
              ref={editableRef}
              className={styles.numberContent}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              data-testid={`block-content-${block.id}`}
            >
              {block.content}
            </div>
          </div>
        );
      case "todo":
        return (
          <div className={`${styles.todo} ${block.checked ? styles.todoChecked : ""}`}>
            <input
              type="checkbox"
              className={styles.todoCheckbox}
              checked={block.checked ?? false}
              onChange={handleToggleTodo}
              data-testid={`block-checkbox-${block.id}`}
            />
            <div
              ref={editableRef}
              className={styles.todoContent}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              data-testid={`block-content-${block.id}`}
            >
              {block.content}
            </div>
          </div>
        );
      case "quote":
        return renderEditable(styles.quote);
      case "code":
        return renderEditable(styles.code);
      case "callout":
        return (
          <div className={styles.callout} ref={contentRef}>
            <span className={styles.calloutIcon}>💡</span>
            <div
              ref={editableRef}
              className={styles.calloutContent}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={placeholder}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              data-testid={`block-content-${block.id}`}
            >
              {block.content}
            </div>
          </div>
        );
      default:
        return renderEditable(styles.paragraph);
    }
  };

  return (
    <div className={styles.blockWrapper}>
      <button
        className={styles.dragHandle}
        {...dragHandleListeners}
        {...dragHandleAttributes}
        data-testid={`drag-handle-${block.id}`}
      >
        ⋮⋮
      </button>
      <div className={styles.blockContent}>{renderBlockContent()}</div>
      {showSlashMenu && (
        <SlashMenu
          filter={slashFilter}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
          anchorEl={editableRef.current}
        />
      )}
    </div>
  );
}
