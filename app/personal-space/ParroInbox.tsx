"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./i18n";
import { InterfaceIcon } from "./InterfaceIcon";
import type { ParroMessagesResponse } from "./parro-types";
const ParroConnection = lazy(() => import("./ParroConnection").then((module) => ({ default: module.ParroConnection })));
import { parroSnapshotStatus, shouldSyncParro } from "./parro-status";
import { useNearViewport } from "./useNearViewport";

type Props = { compact?: boolean; onOpenParro?: () => void; refreshSignal?: number };

export function ParroInbox({ compact = false, onOpenParro, refreshSignal = 0 }: Props) {
  const { language, t } = useLanguage();
  const [inbox, setInbox] = useState<ParroMessagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [editingConnection, setEditingConnection] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const refreshSignalRef = useRef(refreshSignal);
  const { ref: panelRef, active } = useNearViewport<HTMLElement>();

  const load = useCallback(async (forceSync = false, allowAutomaticSync = true) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: compact ? "4" : "20" });
      const response = await fetch(`/api/parro/messages?${query}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json() as ParroMessagesResponse;
      if (requestRef.current !== controller) return;
      if ((!response.ok && body.state !== "sign_in_required" && body.state !== "unconfigured") || !body.state || body.state === "unavailable") throw new Error("Parro unavailable");
      setInbox(body);
      setFailed(false);
      if (shouldSyncParro(body.connectionState, forceSync, body.syncedAt, allowAutomaticSync)) {
        setSyncing(true);
        setSyncError(null);
        const syncResponse = await fetch("/api/parro/refresh", { method: "POST", signal: controller.signal });
        const result = await syncResponse.json().catch(() => ({})) as { ok?: boolean; state?: string; error?: unknown };
        if (requestRef.current !== controller) return;
        if (!syncResponse.ok || !result.ok) {
          setSyncError(typeof result.error === "string" && result.error.trim() ? result.error : t("parro.syncFailed"));
          if (result.state === "sign_in_required") setEditingConnection(true);
        } else {
          const refreshed = await fetch(`/api/parro/messages?${query}`, { cache: "no-store", signal: controller.signal });
          const refreshedBody = await refreshed.json() as ParroMessagesResponse;
          if (requestRef.current !== controller) return;
          if (!refreshed.ok || !refreshedBody.state || refreshedBody.state === "unavailable") throw new Error("Parro unavailable");
          setInbox(refreshedBody);
        }
      }
    } catch {
      if (!controller.signal.aborted && requestRef.current === controller) setFailed(true);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoading(false); setSyncing(false); }
    }
  }, [compact, t]);

  useEffect(() => {
    if (!active) return undefined;
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15 * 60 * 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); requestRef.current?.abort(); requestRef.current = null; };
  }, [active, load]);

  useEffect(() => {
    if (!active || refreshSignalRef.current === refreshSignal) return;
    refreshSignalRef.current = refreshSignal;
    void load();
  }, [active, load, refreshSignal]);

  const disconnect = async () => {
    if (disconnecting || !window.confirm(t("parro.disconnectConfirm"))) return;
    setDisconnecting(true);
    setSyncError(null);
    try {
      const response = await fetch("/api/parro/connection", { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: unknown };
      if (!response.ok || !result.ok) { setSyncError(typeof result.error === "string" && result.error.trim() ? result.error : t("parro.disconnectFailed")); return; }
      setEditingConnection(false);
      await load();
    } catch { setSyncError(t("parro.disconnectFailed")); }
    finally { setDisconnecting(false); }
  };

  const locale = language === "nl" ? "nl-NL" : "en-US";
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Amsterdam", day: "numeric", month: "short" }), [locale]);
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }), [locale]);
  const dayFormat = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }), []);
  const syncFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: "Europe/Amsterdam", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), [locale]);
  const today = dayFormat.format(new Date());
  const snapshot = parroSnapshotStatus(inbox?.syncedAt);
  const connected = inbox?.connectionState === "connected" && (inbox.state === "connected" || inbox.state === "empty");
  const signInRequired = inbox?.state === "sign_in_required";
  const unread = inbox?.unread || 0;

  const busy = loading || syncing || disconnecting || connectionBusy;

  return <section ref={panelRef} className={`parro-panel ${compact ? "parro-compact" : ""}`} aria-labelledby="parro-heading" aria-busy={busy}>
    <div className="slashdot-heading">
      <h2 id="parro-heading"><InterfaceIcon name="mail" />{t("parro.title")}{connected && unread > 0 && <span className="inbox-count" aria-label={t("parro.unreadCount", { count: unread })}>{unread}</span>}</h2>
      <button type="button" className="feed-refresh" aria-label={t("parro.refresh")} title={connected ? t("parro.refreshHint") : t("parro.refreshUnavailable")} disabled={busy || !connected} onClick={() => void load(true)}><span className={loading || syncing ? "spin" : ""}>↻</span></button>
    </div>
    {connected && snapshot.date && <div className="parro-meta"><span>{t("parro.updated", { time: syncFormat.format(snapshot.date) })}</span><span>{t("parro.unreadCount", { count: unread })}</span></div>}
    {connected && (inbox.messages.length > 0 || snapshot.date) && snapshot.stale && <p className="parro-notice parro-sync-warning" role="status">{t(snapshot.date ? "parro.syncDelayed" : "parro.syncUnknown")}</p>}
    {syncing && <p className="parro-sync-help" role="status">{t("parro.syncing")}</p>}
    {syncError && <p className="parro-notice parro-sync-warning" role="alert">{syncError}</p>}
    {!signInRequired && inbox?.connectionState === "unconfigured" && <p className="parro-notice">{t("parro.serverUnconfigured")}</p>}
    {!signInRequired && inbox && inbox.connectionState !== "unconfigured" && (inbox.connectionState !== "connected" || editingConnection) && (compact ? <button type="button" className="small-button" onClick={onOpenParro}>{t("parro.connect")}</button> : <Suspense fallback={<p className="parro-notice">{t("parro.loading")}</p>}><ParroConnection onBusyChange={setConnectionBusy} onConnected={(error) => { setEditingConnection(false); setSyncError(error); void load(false, false); }} /></Suspense>)}
    {!compact && inbox?.connectionState === "connected" && <div className="parro-connection-actions"><button type="button" className="text-button" disabled={busy} onClick={() => setEditingConnection((current) => !current)}>{t(editingConnection ? "parro.cancelConnect" : "parro.reconnect")}</button><button type="button" className="text-button" disabled={busy} onClick={() => void disconnect()}>{t(disconnecting ? "parro.disconnecting" : "parro.disconnect")}</button></div>}
    {loading && !inbox && <p className="parro-notice">{t("parro.loading")}</p>}
    {failed && <p className="parro-notice" role="status">{connected ? t("parro.stale") : t("parro.unavailable")} <button type="button" className="text-button" onClick={() => void load()} disabled={loading}>{t("overview.tryAgain")}</button></p>}
    {signInRequired && <a className="small-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">{t("parro.signIn")}</a>}
    {inbox?.state === "unconfigured" && <p className="parro-notice">{t("parro.unconfigured")}</p>}
    {connected && <>
      <ol className="parro-list">
        {inbox.messages.map((message) => {
          const date = new Date(message.publishedAt);
          const validDate = !Number.isNaN(date.getTime());
          const sameDay = validDate && dayFormat.format(date) === today;
          const context = message.sender || message.roomName || (message.kind === "announcement" ? t("parro.announcement") : t("parro.chatroom"));
          const detailsId = `parro-details-${message.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          const expanded = expandedId === message.id;
          return <li key={message.id}>
            <article className={`parro-entry ${message.unread ? "is-unread" : ""} ${expanded ? "details-open" : ""}`}>
              <div className="parro-item">
                <span className="parro-read-marker" aria-label={message.unread ? t("parro.unread") : ""} />
                <span className="parro-item-copy">
                  <span className="parro-item-top"><span className="parro-item-context">{context}</span><time dateTime={message.publishedAt || undefined}>{validDate ? (sameDay ? timeFormat : dateFormat).format(date) : ""}</time></span>
                  <strong>{message.title}</strong>
                  {message.body && <span className="parro-item-body">{message.body}</span>}
                  <span className="parro-item-actions">
                    <button type="button" className="parro-details-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedId(expanded ? null : message.id)}>{expanded ? t("parro.hideDetails") : t("parro.showDetails")}</button>
                    {message.attachmentCount > 0 && <span>{t("parro.attachmentsCount", { count: message.attachmentCount })}</span>}
                    {message.externalUrl && <a href={message.externalUrl} target="_blank" rel="noreferrer">{t("parro.openMessage")} ↗</a>}
                  </span>
                </span>
              </div>
              <div id={detailsId} className="parro-hover-details">
                <p>{message.body || t("parro.noText")}</p>
                <div className="parro-attachments">
                  <span>{message.attachmentCount > 0 ? t("parro.attachmentsCount", { count: message.attachmentCount }) : t("parro.noAttachments")}</span>
                  {message.attachmentNames.length > 0 && <ul>{message.attachmentNames.map((name) => <li key={name}>{name}</li>)}</ul>}
                </div>
              </div>
            </article>
          </li>;
        })}
      </ol>
      {!inbox.messages.length && <p className="parro-notice">{t("parro.empty")}</p>}
    </>}
    <div className="slashdot-footer">{compact && onOpenParro && <button type="button" className="inbox-open" onClick={onOpenParro}>{t("parro.showAll")} →</button>}<a href="https://parro.com/" target="_blank" rel="noreferrer">{t("parro.open")} ↗</a></div>
  </section>;
}
