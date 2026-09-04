"use client";

import { useCallback, useEffect, useState } from "react";
import { createGoogleTasksDatabase, GOOGLE_TASKS_DATABASE_ID } from "./model";
import { useLanguage } from "./i18n";
import type { Item } from "./types";

type GoogleTaskList = { id: string; title: string };
type GoogleTasksStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect?: boolean;
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
};

type GoogleTasksDialogProps = {
  items: Item[];
  revision: number;
  onReplace: (items: Item[], revision: number) => void;
  onOpenDatabase: () => void;
  onClose: () => void;
};

export function GoogleTasksDialog({ items, revision, onReplace, onOpenDatabase, onClose }: GoogleTasksDialogProps) {
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<GoogleTasksStatus | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
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
      setSelectedListId(body.selectedTaskListId || body.taskLists[0]?.id || "");
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
    try {
      const nextItems = items.some((item) => item.id === GOOGLE_TASKS_DATABASE_ID)
        ? items
        : [...items, createGoogleTasksDatabase()];
      const response = await fetch("/api/google-tasks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: nextItems, baseRevision: revision, taskListId: selectedListId || null }),
      });
      const body = await response.json() as { workspace?: { items: Item[]; revision: number }; sync?: GoogleTasksSummary; error?: string };
      if (!response.ok || !body.workspace || !body.sync) throw new Error(body.error || t("google.syncError"));
      onReplace(body.workspace.items, body.workspace.revision);
      setSummary(body.sync);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("google.syncError"));
    } finally {
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
            <p>{t("google.chooseListHint")}</p>
            <a className="primary-button google-connect-button" href="/api/google-tasks/connect">{t("google.connect")}</a>
          </div>
        )}
        {!loading && status?.configured && status.connected && !status.needsReconnect && (
          <>
            <label className="google-task-list-picker">
              <span>{t("google.chooseList")}</span>
              <select value={selectedListId} onChange={(event) => setSelectedListId(event.target.value)} disabled={busy}>
                {status.taskLists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
              </select>
              <small>{t("google.chooseListHint")}</small>
            </label>
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
            <strong>{summary.taskListTitle}</strong>
            <span>{t("google.syncSummary", summary)}</span>
            {summary.conflicts > 0 && <small>{t("google.conflicts", { count: summary.conflicts })}</small>}
          </div>
        )}
        {error && <p className="google-tasks-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
