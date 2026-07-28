import { useState, useMemo, useCallback } from "react";
import { Page, Database } from "shared/types";
import TreeItem from "../components/TreeItem";
import Modal from "../components/Modal";
import * as api from "../api";
import styles from "./Sidebar.module.css";

interface TreeNode {
  page: Page;
  children: TreeNode[];
}

function buildTree(pages: Page[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const page of pages) {
    map.set(page.id, { page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id)!;
    if (page.parentId && map.has(page.parentId)) {
      map.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface SidebarProps {
  pages: Page[];
  selectedId: string | null;
  onSelectPage: (id: string) => void;
  onPagesChanged: () => void;
}

export default function Sidebar({ pages, selectedId, onSelectPage, onPagesChanged }: SidebarProps) {
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);
  const [showDbConfirm, setShowDbConfirm] = useState(false);

  const tree = useMemo(() => buildTree(pages), [pages]);

  const handleNewPage = useCallback(async () => {
    const parentId = selectedId;
    try {
      await api.createPage({ title: "New Page", parentId, icon: "📄" });
      onPagesChanged();
    } catch (err) {
      console.error("Failed to create page:", err);
    }
  }, [selectedId, onPagesChanged]);

  const handleNewDatabase = useCallback(async () => {
    const parentId = selectedId;
    try {
      const page = await api.createPage({
        title: "New Database",
        parentId,
        icon: "🗄️",
      });
      await api.createDatabase({
        pageId: page.id,
        name: "New Database",
        properties: [],
      });
      onPagesChanged();
      onSelectPage(page.id);
    } catch (err) {
      console.error("Failed to create database:", err);
    }
  }, [selectedId, onSelectPage, onPagesChanged]);

  const handleRename = useCallback(
    async (id: string, title: string) => {
      try {
        await api.updatePage(id, { title });
        onPagesChanged();
      } catch (err) {
        console.error("Failed to rename page:", err);
      }
    },
    [onPagesChanged]
  );

  const handleDelete = useCallback((id: string) => {
    const page = pages.find((p) => p.id === id);
    if (page) {
      setDeleteTarget(page);
    }
  }, [pages]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePage(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) {
        onSelectPage("");
      }
      onPagesChanged();
    } catch (err) {
      console.error("Failed to delete page:", err);
    }
  }, [deleteTarget, selectedId, onSelectPage, onPagesChanged]);

  const getDeleteLabel = () => {
    if (!deleteTarget) return "";
    const childCount = pages.filter((p) => {
      let parent = p.parentId;
      while (parent) {
        if (parent === deleteTarget.id) return true;
        const ancestor = pages.find((a) => a.id === parent);
        parent = ancestor?.parentId || null;
      }
      return false;
    }).length;
    if (childCount > 0) {
      return `Delete "${deleteTarget.title}" and ${childCount} nested page${childCount > 1 ? "s" : ""}?`;
    }
    return `Delete "${deleteTarget.title}"?`;
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>Personal Space</span>
      </div>

      <div className={styles.tree}>
        {tree.map((node) => (
          <TreeItem
            key={node.page.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelectPage}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <button className={styles.newPageBtn} onClick={handleNewPage} data-testid="new-page-btn">
          <span className={styles.plusIcon}>+</span>
          New Page
        </button>
        <button className={styles.newPageBtn} onClick={handleNewDatabase} data-testid="new-db-btn">
          <span className={styles.plusIcon}>🗄️</span>
          New Database
        </button>
      </div>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Page"
        footer={
          <>
            <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className={styles.deleteBtn} onClick={confirmDelete}>
              Delete
            </button>
          </>
        }
      >
        <p className={styles.confirmText}>{getDeleteLabel()}</p>
        <p className={styles.confirmText} style={{ marginTop: 8 }}>
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
