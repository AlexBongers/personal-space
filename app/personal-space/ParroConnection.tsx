"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./i18n";
import { fetchRemoteJson } from "./remote-json";
import { parroConnectOutcome, type ParroConnectResponse } from "./parro-connect-outcome";

type Props = { onConnected: (syncError: string | null) => void; onBusyChange?: (busy: boolean) => void };

export function ParroConnection({ onConnected, onBusyChange }: Props) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    const request = requestRef.current;
    requestRef.current = null;
    request?.abort();
    if (request) onBusyChange?.(false);
  }, [onBusyChange]);

  useEffect(() => {
    if (error && !busy) passwordRef.current?.focus();
  }, [error, busy]);

  return <form className="parro-connect-form" onSubmit={async (event) => {
    event.preventDefault();
    if (requestRef.current || !username.trim() || !password) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const { response, body: result } = await fetchRemoteJson<ParroConnectResponse>("/api/parro/connect", {
        signal: controller.signal, method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, ...(account.trim() ? { account: account.trim() } : {}) }),
      }, 95_000);
      if (requestRef.current !== controller) return;
      const outcome = parroConnectOutcome(response.ok, result, t("parro.connectFailed"), t("parro.syncFailed"));
      if (!outcome.connected) {
        setError(outcome.error);
        return;
      }
      onConnected(outcome.syncError);
    } catch (requestError) {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      setError(t(requestError instanceof Error && requestError.name === "TimeoutError" ? "parro.connectTimedOut" : "parro.connectFailed"));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPassword("");
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }} aria-busy={busy}>
    <p className="parro-notice">{t("parro.connectDescription")}</p>
    <label>{t("parro.username")}<input name="parro-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required disabled={busy} /></label>
    <label>{t("parro.password")}<input ref={passwordRef} name="parro-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} aria-describedby="parro-password-note" /></label>
    <label>{t("parro.account")}<input name="parro-account" value={account} onChange={(event) => setAccount(event.target.value)} disabled={busy} aria-describedby="parro-account-help" /></label>
    <p id="parro-account-help" className="parro-field-help">{t("parro.accountHelp")}</p>
    <p id="parro-password-note" className="parro-sync-help">{t("parro.credentialsNote")}</p>
    {error && <p role="alert" className="parro-notice parro-connect-error">{error}</p>}
    {busy && <p role="status" className="parro-sync-help">{t("parro.connectingHelp")}</p>}
    <button className="primary-button" type="submit" disabled={busy || !username.trim() || !password}>{t(busy ? "parro.connecting" : "parro.connect")}</button>
  </form>;
}
