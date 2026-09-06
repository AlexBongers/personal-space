"use client";

import { useCallback, useEffect, useState } from "react";
import { createGoogleTasksDatabase, GOOGLE_TASKS_DATABASE_ID } from "./model";
import { useLanguage } from "./i18n";
import type { WorkspaceMutationSession } from "./workspace-persistence-controller.ts";
import type { Item } from "./types";

type GoogleTaskList = { id: string; title: string };
type GoogleTasksStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect?: boolean;
  syncAllTaskLists: boolean;
  taskLists: GoogleTaskList[];
  selectedTaskListId: string | null;
  selectedTaskListTitle: string | null;
  lastSyncAt: string | null;
  error?: string;
};
type GoogleTasksSummary = {
  imported: number;
  exported: number;
  updated: number;
  removed: number;
  conflicts: number;
  taskListTitle: string;
  taskListCount: number;
};

type GoogleTasksDialogProps = {
  revision: number;
  onReplace: (items: Item[], revision: number) => void;
  onBeginSync: () => Promise<WorkspaceMutationSession | null>;
  onOpenDatabase: () => void;
  onClose: () => void;
};

export function GoogleTasksDialog({ revision, onReplace, onBeginSync, onOpenDatabase, onClose }: GoogleTasksDialogProps) {
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<GoogleTasksStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<GoogleTasksSummary | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/google-tasks/status", { cache: "no-store" });
      const body = await response.json() as GoogleTasksStatus & { error?: string };
      if (!response.ok) throw new Error(body.error || t("google.syncError"));
      setStatus(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("google.syncError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStatus(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  const lastSyncLabel = status?.lastSyncAt
    ? t("google.lastSync", {
        date: new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(status.lastSyncAt)),
      })
    : t("google.neverSynced");

  const sync = async () => {
    if (!status?.connected || !revision) return;
    setBusy(true);
    setError("");
    setSummary(null);
    const session = await onBeginSync();
    if (!session) {
      setError(t("sync.workspaceBusy"));
      setBusy(false);
      return;
    }
    try {
      const nextItems = session.items.some((item) => item.id === GOOGLE_TASKS_DATABASE_ID)
        ? session.items
        : [...session.items, createGoogleTasksDatabase()];
      const response = await fetch("/api/google-tasks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: nextItems, baseRevision: session.revision }),
      });
      const body = await response.json() as { workspace?: { items: Item[]; revision: number }; sync?: GoogleTasksSummary; error?: string; code?: string };
      if (!response.ok || !body.workspace || !body.sync) throw new Error(body.code === "sync_busy" ? t("sync.busy") : body.code === "sync_uncertain" ? t("sync.uncertain") : body.error || t("google.syncError"));
      onReplace(body.workspace.items, body.workspace.revision);
      setSummary(body.sync);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("google.syncError"));
    } finally {
      session.release();
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(t("google.disconnectConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/google-tasks/disconnect", { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("google.syncError"));
      setSummary(null);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("google.syncError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="google-tasks-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="google-tasks-dialog" role="dialog" aria-modal="true" aria-labelledby="google-tasks-title">
        <div className="google-tasks-heading">
          <div>
            <span className="page-kicker">{t("google.title")}</span>
            <h2 id="google-tasks-title">{status?.connected ? t("google.connected") : t("google.title")}</h2>
          </div>
          <button className="dialog-close" aria-label={t("google.close")} onClick={onClose}>×</button>
        </div>

        {loading && <p className="google-tasks-muted" aria-live="polite">{t("sync.loading")}</p>}
        {!loading && !status?.configured && (
          <div className="google-tasks-note">
            <strong>{t("google.notConfigured")}</strong>
            <p>{t("google.notConfiguredHint")}</p>
          </div>
        )}
        {!loading && status?.configured && !status.connected && (
          <div className="google-tasks-connect">
            <p>{t("google.syncAllHint")}</p>
            <a className="primary-button google-connect-button" href="/api/google-tasks/connect">{t("google.connect")}</a>
          </div>
        )}
        {!loading && status?.configured && status.connected && !status.needsReconnect && (
          <>
            <div className="google-task-list-summary">
              <span className="page-kicker">{t("google.syncMode")}</span>
              <strong>{t("google.allLists", { count: status.taskLists.length })}</strong>
              <p>{t("google.syncAllHint")}</p>
              {status.taskLists.length > 0 && (
                <div className="google-task-list-chips" aria-label={t("google.listNames")}>
                  {status.taskLists.map((list) => <span key={list.id}>{list.title}</span>)}
                </div>
              )}
              {!status.taskLists.length && <p className="google-tasks-error">{t("google.noLists")}</p>}
            </div>
            <div className="google-tasks-actions">
              <button className="primary-button" onClick={() => void sync()} disabled={busy || !status.taskLists.length}>
                {busy ? t("google.syncing") : t("google.syncNow")}
              </button>
              <button className="small-button" onClick={onOpenDatabase}>{t("google.openDatabase")}</button>
              <button className="quiet-danger-button" onClick={() => void disconnect()} disabled={busy}>{t("google.disconnect")}</button>
            </div>
            <p className="google-tasks-muted" aria-live="polite">{lastSyncLabel}</p>
          </>
        )}
        {!loading && status?.needsReconnect && (
          <div className="google-tasks-note">
            <strong>{t("google.reconnectHint")}</strong>
            <a className="primary-button google-connect-button" href="/api/google-tasks/connect">{t("google.reconnect")}</a>
          </div>
        )}
        {summary && (
          <div className="google-tasks-result" aria-live="polite">
            <strong>{t("google.allLists", { count: summary.taskListCount })}</strong>
            <span>{t("google.syncSummary", summary)}</span>
            {summary.conflicts > 0 && <small>{t("google.conflicts", { count: summary.conflicts })}</small>}
          </div>
        )}
        {error && <p className="google-tasks-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
