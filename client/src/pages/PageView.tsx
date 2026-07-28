import { useState, useEffect, useRef, useCallback } from "react";
import { Page, Block, Database } from "shared/types";
import * as api from "../api";
import BlockEditor from "../components/BlockEditor";
import DatabaseView from "./DatabaseView";

interface PageViewProps {
  page: Page | null;
}

export default function PageView({ page }: PageViewProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [database, setDatabase] = useState<Database | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const blocksRef = useRef(blocks);

  blocksRef.current = blocks;

  useEffect(() => {
    if (!page) {
      setBlocks([]);
      setDatabase(null);
      return;
    }

    setDbLoading(true);
    api
      .getDatabaseByPage(page.id)
      .then((db) => setDatabase(db))
      .catch(() => setDatabase(null))
      .finally(() => setDbLoading(false));

    let cancelled = false;
    setLoading(true);
    api
      .getBlocks(page.id)
      .then((data) => {
        if (!cancelled) setBlocks(data);
      })
      .catch((err) => console.error("Failed to fetch blocks:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page?.id]);

  const debouncedSave = useCallback(
    (id: string, data: Partial<Block>) => {
      const existing = saveTimers.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        api.updateBlock(id, data).catch((err) =>
          console.error("Failed to save block:", err)
        );
        saveTimers.current.delete(id);
      }, 500);
      saveTimers.current.set(id, timer);
    },
    []
  );

  useEffect(() => {
    return () => {
      saveTimers.current.forEach((timer) => clearTimeout(timer));
      saveTimers.current.clear();
    };
  }, []);

  const handleChange = useCallback(
    (id: string, content: string) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, content } : b))
      );
      debouncedSave(id, { content });
    },
    [debouncedSave]
  );

  const handleEnter = useCallback(
    async (id: string, cursorPos: number) => {
      if (!page) return;

      const currentBlocks = blocksRef.current;
      const blockIndex = currentBlocks.findIndex((b) => b.id === id);
      if (blockIndex === -1) return;

      const block = currentBlocks[blockIndex];
      const textBeforeCursor = block.content.substring(0, cursorPos);
      const textAfterCursor = block.content.substring(cursorPos);

      const splittableTypes: Block["type"][] = [
        "paragraph",
        "heading1",
        "heading2",
        "heading3",
        "bulleted_list",
        "numbered_list",
        "todo",
        "quote",
        "code",
        "callout",
      ];

      if (splittableTypes.includes(block.type) && textAfterCursor) {
        setBlocks((prev) =>
          prev.map((b) => (b.id === id ? { ...b, content: textBeforeCursor } : b))
        );
        debouncedSave(id, { content: textBeforeCursor });

        try {
          const newBlock = await api.createBlock(page.id, {
            type: block.type,
            content: textAfterCursor,
            position: block.position + 1,
          });
          setBlocks((prev) => {
            const insertIdx = prev.findIndex((b) => b.id === id) + 1;
            return [...prev.slice(0, insertIdx), newBlock, ...prev.slice(insertIdx)];
          });
          setFocusId(newBlock.id);
        } catch (err) {
          console.error("Failed to create block on Enter:", err);
        }
      } else {
        try {
          const newBlock = await api.createBlock(page.id, {
            type: block.type,
            content: "",
            position: block.position + 1,
          });
          setBlocks((prev) => {
            const insertIdx = prev.findIndex((b) => b.id === id) + 1;
            return [...prev.slice(0, insertIdx), newBlock, ...prev.slice(insertIdx)];
          });
          setFocusId(newBlock.id);
        } catch (err) {
          console.error("Failed to create block on Enter:", err);
        }
      }
    },
    [page, debouncedSave]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!page) return;

      const currentBlocks = blocksRef.current;
      const blockIndex = currentBlocks.findIndex((b) => b.id === id);
      if (blockIndex === -1) return;

      const prevBlock = blockIndex > 0 ? currentBlocks[blockIndex - 1] : null;

      setBlocks((prev) => prev.filter((b) => b.id !== id));

      try {
        await api.deleteBlock(id);
        if (prevBlock) {
          setFocusId(prevBlock.id);
        }
      } catch (err) {
        console.error("Failed to delete block:", err);
      }
    },
    [page]
  );

  const handleTypeChange = useCallback(
    async (id: string, newType: Block["type"]) => {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                type: newType,
                content: newType === "divider" ? "" : b.content,
              }
            : b
        )
      );

      try {
        await api.updateBlock(id, {
          type: newType,
          ...(newType === "divider" ? { content: "" } : {}),
        });
      } catch (err) {
        console.error("Failed to change block type:", err);
      }
    },
    []
  );

  const handleToggleTodo = useCallback(
    async (id: string, checked: boolean) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, checked } : b))
      );

      try {
        await api.updateBlock(id, { checked });
      } catch (err) {
        console.error("Failed to toggle todo:", err);
      }
    },
    []
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setBlocks((prev) => {
        const reordered = [...prev];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        const updates = reordered.map((block, i) => ({
          id: block.id,
          position: i,
        }));
        api.reorderBlocks(updates).catch((err) =>
          console.error("Failed to reorder blocks:", err)
        );
        return reordered;
      });
    },
    []
  );

  const handleClearFocus = useCallback(() => {
    setFocusId(null);
  }, []);

  if (!page) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 15 }}>
        Select a page
      </div>
    );
  }

  if (dbLoading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  if (database) {
    return <DatabaseView database={database} />;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ padding: "24px 32px 16px", maxWidth: 780, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>{page.icon || "📄"}</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }} data-testid="page-view-title">{page.title}</h1>
        </div>
      </div>
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Loading...
        </div>
      ) : (
        <BlockEditor
          blocks={blocks}
          focusId={focusId}
          onClearFocus={handleClearFocus}
          onChange={handleChange}
          onEnter={handleEnter}
          onDelete={handleDelete}
          onTypeChange={handleTypeChange}
          onToggleTodo={handleToggleTodo}
          onReorder={handleReorder}
        />
      )}
    </div>
  );
}
