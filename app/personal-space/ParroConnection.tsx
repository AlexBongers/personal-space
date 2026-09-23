"use client";

import { useRef, useState } from "react";
import { useLanguage } from "./i18n";
import { parroConnectOutcome } from "./parro-connect-outcome";

type Props = { onConnected: (syncError: string | null) => void; onBusyChange?: (busy: boolean) => void };

type ConnectionResponse = { ok?: boolean; connectionSaved?: boolean; error?: unknown };

export function ParroConnection({ onConnected, onBusyChange }: Props) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  return <form className="parro-connect-form" onSubmit={async (event) => {
    event.preventDefault();
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const response = await fetch("/api/parro/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, ...(account.trim() ? { account: account.trim() } : {}) }),
      });
      const result = await response.json().catch(() => ({})) as ConnectionResponse;
      const outcome = parroConnectOutcome(response.ok, result, t("parro.connectFailed"), t("parro.syncFailed"));
      if (!outcome.connected) {
        setError(outcome.error);
        return;
      }
      onConnected(outcome.syncError);
    } catch {
      setError(t("parro.connectFailed"));
    } finally {
      setPassword("");
      setBusy(false);
      onBusyChange?.(false);
      window.setTimeout(() => passwordRef.current?.focus(), 0);
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
