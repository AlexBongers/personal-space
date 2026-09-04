"use client";

import { useCallback, useEffect, useState } from "react";
import { createGoogleCalendarDatabase, GOOGLE_CALENDAR_DATABASE_ID } from "./model";
import { useLanguage } from "./i18n";
import type { Item } from "./types";

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect?: boolean;
  calendars: Array<{ id: string; title: string; primary: boolean }>;
  lastSyncAt: string | null;
  error?: string;
};

type CalendarSummary = {
  imported: number;
  exported: number;
  updated: number;
  removed: number;
  conflicts: number;
  calendarCount: number;
};

type GoogleCalendarDialogProps = {
  items: Item[];
  revision: number;
  onReplace: (items: Item[], revision: number) => void;
  onOpenDatabase: () => void;
  onClose: () => void;
};

export function GoogleCalendarDialog({ items, revision, onReplace, onOpenDatabase, onClose }: GoogleCalendarDialogProps) {
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<CalendarSummary | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/google-calendar/status", { cache: "no-store" });
      const body = await response.json() as CalendarStatus;
      if (!response.ok) throw new Error(body.error || t("calendar.syncError"));
      setStatus(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("calendar.syncError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStatus(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  const lastSyncLabel = status?.lastSyncAt
    ? t("calendar.lastSync", {
        date: new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(status.lastSyncAt)),
      })
    : t("calendar.neverSynced");

  const sync = async () => {
    if (!status?.connected || !revision) return;
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const nextItems = items.some((item) => item.id === GOOGLE_CALENDAR_DATABASE_ID)
        ? items
        : [...items, createGoogleCalendarDatabase()];
      const response = await fetch("/api/google-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: nextItems, baseRevision: revision }),
      });
      const body = await response.json() as { workspace?: { items: Item[]; revision: number }; sync?: CalendarSummary; error?: string };
      if (!response.ok || !body.workspace || !body.sync) throw new Error(body.error || t("calendar.syncError"));
      onReplace(body.workspace.items, body.workspace.revision);
      setSummary(body.sync);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("calendar.syncError"));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(t("calendar.disconnectConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("calendar.syncError"));
      setSummary(null);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("calendar.syncError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="google-tasks-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="google-tasks-dialog" role="dialog" aria-modal="true" aria-labelledby="google-calendar-title">
        <div className="google-tasks-heading">
          <div>
            <span className="page-kicker">{t("calendar.title")}</span>
            <h2 id="google-calendar-title">{status?.connected ? t("calendar.connected") : t("calendar.title")}</h2>
          </div>
          <button className="dialog-close" aria-label={t("calendar.close")} onClick={onClose}>×</button>
        </div>

        {loading && <p className="google-tasks-muted" aria-live="polite">{t("sync.loading")}</p>}
        {!loading && !status?.configured && (
          <div className="google-tasks-note">
            <strong>{t("calendar.notConfigured")}</strong>
            <p>{t("calendar.notConfiguredHint")}</p>
          </div>
        )}
        {!loading && status?.configured && !status.connected && (
          <div className="google-tasks-connect">
            <p>{t("calendar.syncHint")}</p>
            <a className="primary-button google-connect-button" href="/api/google-calendar/connect">{t("calendar.connect")}</a>
          </div>
        )}
        {!loading && status?.configured && status.connected && !status.needsReconnect && (
          <>
            <div className="google-task-list-summary">
              <span className="page-kicker">{t("calendar.syncMode")}</span>
              <strong>{t("calendar.allCalendars", { count: status.calendars.length })}</strong>
              <p>{t("calendar.syncHint")}</p>
              {status.calendars.length > 0 && (
                <div className="google-task-list-chips" aria-label={t("calendar.calendarNames")}>
                  {status.calendars.map((calendar) => <span key={calendar.id}>{calendar.title}{calendar.primary ? ` · ${t("calendar.primary")}` : ""}</span>)}
                </div>
              )}
              {!status.calendars.length && <p className="google-tasks-error">{t("calendar.noCalendars")}</p>}
            </div>
            <div className="google-tasks-actions">
              <button className="primary-button" onClick={() => void sync()} disabled={busy || !status.calendars.length}>{busy ? t("calendar.syncing") : t("calendar.syncNow")}</button>
              <button className="small-button" onClick={onOpenDatabase}>{t("calendar.openDatabase")}</button>
              <button className="quiet-danger-button" onClick={() => void disconnect()} disabled={busy}>{t("calendar.disconnect")}</button>
            </div>
            <p className="google-tasks-muted" aria-live="polite">{lastSyncLabel}</p>
          </>
        )}
        {!loading && status?.needsReconnect && (
          <div className="google-tasks-note">
            <strong>{t("calendar.reconnectHint")}</strong>
            <a className="primary-button google-connect-button" href="/api/google-calendar/connect">{t("calendar.reconnect")}</a>
          </div>
        )}
        {summary && (
          <div className="google-tasks-result" aria-live="polite">
            <strong>{t("calendar.allCalendars", { count: summary.calendarCount })}</strong>
            <span>{t("calendar.syncSummary", summary)}</span>
            {summary.conflicts > 0 && <small>{t("calendar.conflicts", { count: summary.conflicts })}</small>}
          </div>
        )}
        {error && <p className="google-tasks-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
