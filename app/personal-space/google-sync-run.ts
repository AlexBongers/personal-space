import { createGoogleCalendarDatabase, createGoogleTasksDatabase, GOOGLE_CALENDAR_DATABASE_ID, GOOGLE_TASKS_DATABASE_ID } from "./model.ts";
import type { Item } from "./types.ts";
import type { WorkspaceMutationSession } from "./workspace-persistence-controller.ts";

export type GoogleService = "tasks" | "calendar";

export type GoogleSyncOutcome =
  | { ok: true; workspace: { items: Item[]; revision: number }; summary: unknown }
  /** `setup` means Google is not configured or not connected yet: the connection dialog is the next step. */
  | { ok: false; reason: "busy" | "uncertain" | "workspace" | "setup" | "failed"; message?: string };

const SERVICES = {
  tasks: { path: "/api/google-tasks/sync", id: GOOGLE_TASKS_DATABASE_ID, create: createGoogleTasksDatabase },
  calendar: { path: "/api/google-calendar/sync", id: GOOGLE_CALENDAR_DATABASE_ID, create: createGoogleCalendarDatabase },
} as const;

/**
 * Runs one Google sync for tasks or the calendar: it takes the workspace from the editor (which pauses saving),
 * sends it to the Worker and hands back the synced workspace. Used by the dialogs and the top bar buttons.
 */
export async function runGoogleSync(service: GoogleService, begin: () => Promise<WorkspaceMutationSession | null>): Promise<GoogleSyncOutcome> {
  const session = await begin();
  if (!session) return { ok: false, reason: "workspace" };
  try {
    const { path, id, create } = SERVICES[service];
    const items = session.items.some((item) => item.id === id) ? session.items : [...session.items, create()];
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, baseRevision: session.revision, protocolVersion: 2, capabilities: ["trash"] }),
    });
    const body = await response.json().catch(() => ({})) as { workspace?: { items: Item[]; revision: number }; sync?: unknown; error?: string; code?: string };
    if (response.ok && body.workspace && body.sync) return { ok: true, workspace: body.workspace, summary: body.sync };
    if (body.code === "sync_busy") return { ok: false, reason: "busy" };
    if (body.code === "sync_uncertain") return { ok: false, reason: "uncertain" };
    if (response.status === 401 || response.status === 503) return { ok: false, reason: "setup", message: body.error };
    return { ok: false, reason: "failed", message: body.error };
  } catch (error) {
    return { ok: false, reason: "failed", message: error instanceof Error ? error.message : undefined };
  } finally {
    session.release();
  }
}
