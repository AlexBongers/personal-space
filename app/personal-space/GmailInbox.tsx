"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "./i18n";
import { InterfaceIcon } from "./InterfaceIcon";
import type { GmailInboxResponse } from "./gmail-types";

type Props = { compact?: boolean; onOpenInbox?: () => void; authorizationError?: boolean };

export function GmailInbox({ compact = false, onOpenInbox, authorizationError = false }: Props) {
  const { language, t } = useLanguage();
  const [inbox, setInbox] = useState<GmailInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const pagesRef = useRef(1);

  const load = useCallback(async (pageToken = "") => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    const query = new URLSearchParams({ limit: compact ? "5" : "20" });
    if (pageToken) query.set("pageToken", pageToken);
    try {
      const response = await fetch(`/api/gmail/inbox?${query}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json() as GmailInboxResponse;
      if (requestRef.current !== controller) return;
      if (body.state === "unavailable" || !body.state) throw new Error("Gmail unavailable");
      setFailed(false);
      setInbox((previous) => {
        if (pageToken && previous?.state === "connected" && body.state === "connected" && previous.emailAddress === body.emailAddress) {
          const messages = new Map(previous.messages.map((message) => [message.id, message]));
          body.messages.forEach((message) => messages.set(message.id, message));
          return { ...body, messages: [...messages.values()] };
        }
        return body;
      });
      pagesRef.current = pageToken ? pagesRef.current + 1 : 1;
    } catch {
      if (!controller.signal.aborted && requestRef.current === controller) setFailed(true);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoading(false); }
    }
  }, [compact]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (!document.hidden && pagesRef.current === 1) void load(); }, 5 * 60 * 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); requestRef.current?.abort(); requestRef.current = null; };
  }, [load]);

  const connected = inbox?.state === "connected";
  const needsConsent = inbox?.state === "connect" || inbox?.state === "permission_required";
  const gmailUrl = inbox?.emailAddress ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(inbox.emailAddress)}#inbox` : "https://mail.google.com/";
  const locale = language === "nl" ? "nl-NL" : "en-US";
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });

  return <section className={`gmail-panel ${compact ? "gmail-compact" : ""}`} aria-labelledby="gmail-heading" aria-busy={loading}>
    <div className="slashdot-heading">
      <h2 id="gmail-heading"><InterfaceIcon name="mail" />{t("gmail.title")}{connected && <span className="inbox-count" aria-label={t("gmail.unreadCount", { count: inbox.unread || 0 })}>{inbox.unread || 0}</span>}</h2>
      <button type="button" className="feed-refresh" aria-label={t("gmail.refresh")} disabled={loading} onClick={() => void load()}><span className={loading ? "spin" : ""}>↻</span></button>
    </div>
    {connected && <div className="inbox-meta"><span>{inbox.emailAddress}</span><span>{t("gmail.unreadCount", { count: inbox.unread || 0 })}</span></div>}
    {loading && !inbox && <p className="inbox-notice">{t("gmail.loading")}</p>}
    {failed && <p className="inbox-notice" role="status">{connected ? t("gmail.stale") : t("gmail.unavailable")} <button type="button" className="text-button" onClick={() => void load()} disabled={loading}>{t("overview.tryAgain")}</button></p>}
    {authorizationError && !connected && <p className="inbox-notice" role="status">{t("gmail.consentError")}</p>}
    {needsConsent && <div className="gmail-connect"><p>{t("gmail.connectDescription")}</p><a className="primary-button" href="/api/google-tasks/connect?return=gmail" target="_top">{t("gmail.connect")}</a></div>}
    {inbox?.state === "unconfigured" && <p className="inbox-notice">{t("gmail.unconfigured")}</p>}
    {inbox?.state === "api_disabled" && <div className="gmail-connect"><p>{t("gmail.apiDisabled")}</p><a className="small-button" href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer">{t("gmail.enableApi")} ↗</a></div>}
    {inbox?.state === "sign_in_required" && <a className="small-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">{t("gmail.signIn")}</a>}
    {connected && <>
      <ol className="inbox-list">
        {inbox.messages.map((message) => {
          const date = new Date(message.receivedAt);
          const validDate = !Number.isNaN(date.getTime());
          const sameDay = validDate && date.toDateString() === new Date().toDateString();
          return <li key={message.id}>
            <a className={`inbox-message ${message.unread ? "is-unread" : ""}`} href={message.url} target="_blank" rel="noreferrer">
              <span className="inbox-read-marker" aria-label={message.unread ? t("gmail.unread") : t("gmail.read")} />
              <span className="inbox-message-copy"><span className="inbox-message-top"><span className="inbox-sender">{message.sender || t("gmail.unknownSender")}</span><time dateTime={message.receivedAt || undefined}>{validDate ? (sameDay ? timeFormat : dateFormat).format(date) : ""}</time></span><strong>{message.subject || t("gmail.noSubject")}</strong>{message.snippet && <span className="inbox-snippet">{message.snippet}</span>}</span>
            </a>
          </li>;
        })}
      </ol>
      {!inbox.messages.length && <p className="inbox-notice">{t("gmail.empty")}</p>}
      {!compact && inbox.nextPageToken && <button type="button" className="small-button inbox-load-more" disabled={loading} onClick={() => void load(inbox.nextPageToken)}>{t("gmail.more")}</button>}
    </>}
    <div className="slashdot-footer">{compact && onOpenInbox && <button type="button" className="inbox-open" onClick={onOpenInbox}>{t("gmail.showInbox")} →</button>}<a href={gmailUrl} target="_blank" rel="noreferrer">{t("gmail.open")} ↗</a></div>
  </section>;
}
