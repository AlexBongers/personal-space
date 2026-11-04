"use client";

import { useState } from "react";
import { runGoogleSync, type GoogleService } from "./google-sync-run.ts";
import { useLanguage } from "./i18n";
import { InterfaceIcon } from "./InterfaceIcon";
import type { Item } from "./types";
import type { WorkspaceMutationSession } from "./workspace-persistence-controller.ts";

type Props = {
  service: GoogleService;
  onBeginSync: () => Promise<WorkspaceMutationSession | null>;
  onReplace: (items: Item[], revision: number) => void;
  /** Opens the connection dialog, when Google is not connected yet. */
  onOpenSetup: () => void;
};

/** One click syncs tasks or the calendar with Google right away; the tooltip says how it went. */
export function GoogleSyncButton({ service, onBeginSync, onReplace, onOpenSetup }: Props) {
  const { language, t } = useLanguage();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [note, setNote] = useState("");
  const label = t(service === "tasks" ? "top.syncTasks" : "top.syncCalendar");

  const sync = async () => {
    if (state === "busy") return;
    setState("busy");
    const outcome = await runGoogleSync(service, onBeginSync);
    if (outcome.ok) {
      onReplace(outcome.workspace.items, outcome.workspace.revision);
      setState("done");
      setNote(t("top.syncedAt", { time: new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date()) }));
      return;
    }
    if (outcome.reason === "setup") { setState("idle"); setNote(""); onOpenSetup(); return; }
    setState("error");
    setNote(outcome.reason === "busy" ? t("sync.busy") : outcome.reason === "uncertain" ? t("sync.uncertain") : outcome.reason === "workspace" ? t("sync.workspaceBusy")
      : outcome.message || t(service === "tasks" ? "google.syncError" : "calendar.syncError"));
  };

  return (
    <button type="button" className={`google-sync-button is-${state}`} aria-busy={state === "busy"} title={note ? `${label}: ${note}` : t("top.syncHint", { label })} onClick={() => void sync()}>
      <span className="google-sync-icon" aria-hidden="true"><InterfaceIcon name={service === "tasks" ? "tasks" : "calendar"} /></span>
      <span>{label}</span>
      <span className="google-sync-state" aria-hidden="true">{state === "busy" ? "↻" : state === "done" ? "✓" : state === "error" ? "!" : "↻"}</span>
    </button>
  );
}
