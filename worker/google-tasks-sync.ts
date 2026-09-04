import { GOOGLE_TASK_PROPERTY_IDS } from "../app/personal-space/model.ts";
import type { CellValue, Row } from "../app/personal-space/types.ts";

export type GoogleTask = {
  id: string;
  title?: string;
  notes?: string;
  updated?: string;
  etag?: string;
  status?: "needsAction" | "completed" | string;
  due?: string;
  parent?: string;
  position?: string;
  deleted?: boolean;
  hidden?: boolean;
  webViewLink?: string;
};

export type GoogleTaskPayload = {
  title: string;
  notes?: string | null;
  due?: string | null;
  status: "needsAction" | "completed";
};

const cellString = (value: CellValue | undefined) => {
  if (Array.isArray(value)) return value.join(", ");
  return value === null || value === undefined ? "" : String(value);
};

const localValue = (row: Row, id: string) => row.values[id];

export const googleTaskId = (row: Row) => cellString(localValue(row, GOOGLE_TASK_PROPERTY_IDS.id));

export const googleTaskPayload = (row: Row): GoogleTaskPayload => {
  const due = cellString(localValue(row, GOOGLE_TASK_PROPERTY_IDS.due));
  const notes = cellString(localValue(row, GOOGLE_TASK_PROPERTY_IDS.notes));
  return {
    title: row.title.trim() || "Untitled task",
    notes: notes || null,
    due: due ? `${due}T00:00:00.000Z` : null,
    status: cellString(localValue(row, GOOGLE_TASK_PROPERTY_IDS.status)) === "Done" ? "completed" : "needsAction",
  };
};

export const googleRowFingerprint = (row: Row) => JSON.stringify(googleTaskPayload(row));

export const googleTaskToRow = (task: GoogleTask, taskListTitle: string, existing?: Row): Row => ({
  id: existing?.id || `google-task-${task.id}`,
  title: task.title?.trim() || "Untitled task",
  values: {
    ...(existing?.values || {}),
    [GOOGLE_TASK_PROPERTY_IDS.status]: task.status === "completed" ? "Done" : "Open",
    [GOOGLE_TASK_PROPERTY_IDS.due]: task.due?.slice(0, 10) || "",
    [GOOGLE_TASK_PROPERTY_IDS.notes]: task.notes || "",
    [GOOGLE_TASK_PROPERTY_IDS.list]: taskListTitle,
    [GOOGLE_TASK_PROPERTY_IDS.link]: task.webViewLink || "",
    [GOOGLE_TASK_PROPERTY_IDS.id]: task.id,
    [GOOGLE_TASK_PROPERTY_IDS.parent]: task.parent || "",
    [GOOGLE_TASK_PROPERTY_IDS.position]: task.position || "",
  },
  blocks: existing?.blocks || [],
});

export const clearGoogleTaskLink = (row: Row, taskListTitle: string): Row => ({
  ...row,
  values: {
    ...row.values,
    [GOOGLE_TASK_PROPERTY_IDS.status]: "Open",
    [GOOGLE_TASK_PROPERTY_IDS.list]: taskListTitle,
    [GOOGLE_TASK_PROPERTY_IDS.link]: "",
    [GOOGLE_TASK_PROPERTY_IDS.id]: "",
    [GOOGLE_TASK_PROPERTY_IDS.parent]: "",
    [GOOGLE_TASK_PROPERTY_IDS.position]: "",
  },
});
