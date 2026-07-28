import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Page } from "shared/types";
import styles from "./TreeItem.module.css";

interface TreeNode {
  page: Page;
  children: TreeNode[];
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function TreeItem({ node, depth, selectedId, onSelect, onRename, onDelete }: TreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.page.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.page.id;
  const padLeft = depth * 16 + 8;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.page.title) {
      onRename(node.page.id, trimmed);
    } else {
      setRenameValue(node.page.title);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenameValue(node.page.title);
      setIsRenaming(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.page.id);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
  };

  return (
    <div className={styles.item}>
      <div
        className={`${styles.row} ${isSelected ? styles.selected : ""}`}
        style={{ paddingLeft: padLeft }}
        onClick={() => onSelect(node.page.id)}
        data-testid={`tree-item-${node.page.id}`}
      >
        {hasChildren ? (
          <button
            className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            ▶
          </button>
        ) : (
          <span className={styles.emptyChevron} />
        )}

        <span className={styles.icon}>{node.page.icon || "📄"}</span>

        {isRenaming ? (
          <input
            ref={inputRef}
            className={styles.renameInput}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.titleText} data-testid={`page-title-${node.page.id}`}>{node.page.title}</span>
        )}

        {!isRenaming && (
          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              onClick={handleRenameClick}
              title="Rename"
              data-testid={`rename-${node.page.id}`}
            >
              ✎
            </button>
            <button
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={handleDeleteClick}
              title="Delete"
              data-testid={`delete-${node.page.id}`}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className={styles.children}>
          {node.children.map((child) => (
            <TreeItem
              key={child.page.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
