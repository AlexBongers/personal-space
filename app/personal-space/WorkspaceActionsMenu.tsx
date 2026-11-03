"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useLanguage } from "./i18n";
import type { Item } from "./types";
import type { WorkspaceConflict } from "./workspace-merge.ts";
import {
  createWorkspaceExport,
  createWorkspaceRecoveryExport,
  downloadWorkspaceExport,
  parseWorkspaceImport,
} from "./workspace-export.ts";

type WorkspaceActionsMenuProps = {
  items: Item[];
  confirmedItems: Item[];
  sourceRevision: number;
  containsUnconfirmedChanges: boolean;
  conflicts: WorkspaceConflict[];
  disabled?: boolean;
  onOpenTrash?: () => void;
  onImport: (items: Item[]) => void;
  /** Language and theme controls, shown at the top of the menu. */
  appearance?: ReactNode;
};

const withConflictVersions = (
  source: Item[],
  conflicts: WorkspaceConflict[],
  side: "base" | "local" | "remote",
) => {
  const byId = new Map(source.map((item) => [item.id, item]));
  const sourceIds = new Set(byId.keys());
  for (const conflict of conflicts) {
    const item = conflict[side];
    if (item) byId.set(item.id, item);
    else byId.delete(conflict.id);
  }
  return [...source].map((item) => byId.get(item.id)).filter((item): item is Item => Boolean(item))
    .concat(conflicts
      .map((conflict) => conflict[side])
      .filter((item): item is Item => Boolean(item))
      .filter((item) => !sourceIds.has(item.id)));
};

export function WorkspaceActionsMenu({
  items,
  confirmedItems,
  sourceRevision,
  containsUnconfirmedChanges,
  conflicts,
  disabled = false,
  onOpenTrash,
  onImport,
  appearance,
}: WorkspaceActionsMenuProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const exportWorkspace = () => {
    setMessage("");
    if (conflicts.length) {
      setMessage(t("workspaceActions.exportConflict"));
      return;
    }
    try {
      const payload = createWorkspaceExport({ items, sourceRevision, containsUnconfirmedChanges });
      downloadWorkspaceExport(payload);
      setMessage(t("workspaceActions.exportReady"));
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("workspaceActions.exportError"));
    }
  };

  const exportRecovery = () => {
    setMessage("");
    try {
      // The conflict entries contain the distinct per-item base/local/remote
      // versions. Fill those versions into complete snapshots so recovery
      // material never presents the controller's remote snapshot as all three.
      const payload = createWorkspaceRecoveryExport({
        baseItems: withConflictVersions(confirmedItems.length ? confirmedItems : items, conflicts, "base"),
        localItems: withConflictVersions(items, conflicts, "local"),
        remoteItems: withConflictVersions(confirmedItems.length ? confirmedItems : items, conflicts, "remote"),
        sourceRevision,
        conflicts,
      });
      downloadWorkspaceExport(payload);
      setMessage(t("workspaceActions.recoveryExportReady"));
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("workspaceActions.exportError"));
    }
  };

  const chooseImportFile = () => {
    setMessage("");
    importInput.current?.click();
  };

  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = parseWorkspaceImport(await file.text());
      if (!window.confirm(t("workspaceActions.importConfirm"))) return;
      onImport(imported);
      setMessage(t("workspaceActions.importReady"));
    } catch {
      setMessage(t("workspaceActions.importError"));
    }
  };

  return (
    <div className="workspace-actions" ref={container}>
      <button
        type="button"
        className="workspace-actions-trigger"
        aria-label={t("workspaceActions.open")}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => { setOpen((value) => !value); setMessage(""); }}
      >
        <span aria-hidden="true">•••</span>
      </button>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={importWorkspace}
      />
      {open && (
        <div className="workspace-actions-menu" role="menu">
          {appearance && <div className="workspace-actions-appearance">{appearance}</div>}
          {onOpenTrash && <button type="button" role="menuitem" onClick={() => { onOpenTrash(); setOpen(false); }}>{t("workspaceActions.trash")}</button>}
          <button type="button" role="menuitem" onClick={exportWorkspace}>{t("workspaceActions.export")}</button>
          <button type="button" role="menuitem" onClick={chooseImportFile}>{t("workspaceActions.import")}</button>
          {conflicts.length > 0 && <button type="button" role="menuitem" onClick={exportRecovery}>{t("workspaceActions.recoveryExport")}</button>}
          {message && <p className="workspace-actions-message" role="status">{message}</p>}
        </div>
      )}
    </div>
  );
}
