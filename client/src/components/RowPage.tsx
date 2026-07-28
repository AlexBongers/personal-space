import { useState, useEffect, useRef, useCallback } from "react";
import type { Row, Database, Block } from "shared/types";
import * as api from "../api";
import BlockEditor from "./BlockEditor";

interface RowPageProps {
  row: Row;
  database: Database;
  onBack: () => void;
}

export default function RowPage({ row, database, onBack }: RowPageProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const blocksRef = useRef(blocks);

  blocksRef.current = blocks;

  const pageId = row.pageId as string | undefined;

  useEffect(() => {
    if (!pageId) {
      setBlocks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getBlocks(pageId)
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
  }, [pageId]);

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
      if (!pageId) return;

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
          const newBlock = await api.createBlock(pageId, {
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
          const newBlock = await api.createBlock(pageId, {
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
    [pageId, debouncedSave]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!pageId) return;

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
    [pageId]
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

  const rowData = (row.data as Record<string, unknown>) || {};

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ padding: "16px 32px 0", maxWidth: 780, margin: "0 auto", width: "100%" }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
            marginBottom: 16,
            background: "none",
            border: "none",
          }}
        >
          ← Back to {database.name}
        </button>
      </div>

      <div style={{ padding: "0 32px 16px", maxWidth: 780, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>📄</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            {row.title || "Untitled"}
          </h1>
        </div>

        {database.properties && database.properties.length > 0 && (
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
              Properties
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {database.properties.map((prop) => {
                const val = rowData[prop.id];
                const display = val === null || val === undefined || val === "" ? (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>Empty</span>
                ) : (
                  <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                    {typeof val === "boolean" ? (val ? "☑ Yes" : "☐ No") : String(val)}
                  </span>
                );

                return (
                  <div
                    key={prop.id}
                    style={{ display: "flex", gap: 12, padding: "4px 0", borderBottom: "1px solid var(--border)" }}
                  >
                    <span style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 120, flexShrink: 0 }}>
                      {prop.name}
                    </span>
                    {display}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Loading...
        </div>
      ) : pageId ? (
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
      ) : (
        <div style={{ padding: "0 32px", maxWidth: 780, margin: "0 auto", width: "100%", color: "var(--text-muted)", fontSize: 13 }}>
          Unable to load row content.
        </div>
      )}
    </div>
  );
}
