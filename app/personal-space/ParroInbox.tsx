"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "./i18n";
import { InterfaceIcon } from "./InterfaceIcon";
import type { ParroMessagesResponse } from "./parro-types";

type Props = { compact?: boolean; onOpenParro?: () => void };

export function ParroInbox({ compact = false, onOpenParro }: Props) {
  const { language, t } = useLanguage();
  const [inbox, setInbox] = useState<ParroMessagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: compact ? "6" : "20" });
      const response = await fetch(`/api/parro/messages?${query}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json() as ParroMessagesResponse;
      if (requestRef.current !== controller) return;
      if (!body.state || body.state === "unavailable") throw new Error("Parro unavailable");
      setInbox(body);
      setFailed(false);
    } catch {
      if (!controller.signal.aborted && requestRef.current === controller) setFailed(true);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoading(false); }
    }
  }, [compact]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15 * 60 * 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); requestRef.current?.abort(); requestRef.current = null; };
  }, [load]);

  const locale = language === "nl" ? "nl-NL" : "en-US";
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const connected = inbox?.state === "connected" || inbox?.state === "empty";
  const signInRequired = inbox?.state === "sign_in_required";
  const unread = inbox?.unread || 0;

  return <section className={`parro-panel ${compact ? "parro-compact" : ""}`} aria-labelledby="parro-heading" aria-busy={loading}>
    <div className="slashdot-heading">
      <h2 id="parro-heading"><InterfaceIcon name="mail" />{t("parro.title")}{connected && unread > 0 && <span className="inbox-count" aria-label={t("parro.unreadCount", { count: unread })}>{unread}</span>}</h2>
      <button type="button" className="feed-refresh" aria-label={t("parro.refresh")} disabled={loading} onClick={() => void load()}><span className={loading ? "spin" : ""}>↻</span></button>
    </div>
    {connected && inbox?.syncedAt && <div className="parro-meta"><span>{t("parro.updated", { time: timeFormat.format(new Date(inbox.syncedAt)) })}</span><span>{t("parro.unreadCount", { count: unread })}</span></div>}
    {loading && !inbox && <p className="parro-notice">{t("parro.loading")}</p>}
    {failed && <p className="parro-notice" role="status">{connected ? t("parro.stale") : t("parro.unavailable")} <button type="button" className="text-button" onClick={() => void load()} disabled={loading}>{t("overview.tryAgain")}</button></p>}
    {signInRequired && <a className="small-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">{t("parro.signIn")}</a>}
    {inbox?.state === "unconfigured" && <p className="parro-notice">{t("parro.unconfigured")}</p>}
    {connected && <>
      <ol className="parro-list">
        {inbox.messages.map((message) => {
          const date = new Date(message.publishedAt);
          const validDate = !Number.isNaN(date.getTime());
          const sameDay = validDate && date.toDateString() === new Date().toDateString();
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
