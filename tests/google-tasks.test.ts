import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleTasksDatabase, GOOGLE_TASK_PROPERTY_IDS } from "../app/personal-space/model.ts";
import {
  clearGoogleTaskLink,
  googleRowFingerprint,
  googleTaskPayload,
  googleTaskToRow,
} from "../worker/google-tasks-sync.ts";

const task = {
  id: "task-1",
  title: "Buy bread",
  notes: "Sourdough if possible",
  status: "needsAction",
  due: "2026-09-04T00:00:00.000Z",
  parent: "parent-1",
  position: "0000000001",
  etag: "etag-1",
  updated: "2026-09-04T09:00:00.000Z",
  webViewLink: "https://tasks.google.com/task/task-1",
};

test("Google Tasks rows preserve fields needed for two-way sync", () => {
  const database = createGoogleTasksDatabase();
  const row = googleTaskToRow(task, "Personal", undefined);

  assert.equal(database.id, "google-tasks");
  assert.equal(row.title, "Buy bread");
  assert.equal(row.values[GOOGLE_TASK_PROPERTY_IDS.status], "Open");
  assert.equal(row.values[GOOGLE_TASK_PROPERTY_IDS.due], "2026-09-04");
  assert.equal(row.values[GOOGLE_TASK_PROPERTY_IDS.parent], "parent-1");
  assert.deepEqual(googleTaskPayload(row), {
    title: "Buy bread",
    notes: "Sourdough if possible",
    due: "2026-09-04T00:00:00.000Z",
    status: "needsAction",
  });
});

test("local fingerprint changes when a synced field changes", () => {
  const row = googleTaskToRow(task, "Personal");
  const changed = { ...row, title: "Buy rye bread" };
  assert.notEqual(googleRowFingerprint(row), googleRowFingerprint(changed));
  assert.equal(googleTaskToRow({ ...task, status: "completed" }, "Personal").values[GOOGLE_TASK_PROPERTY_IDS.status], "Done");
});

test("clearing a remote link keeps the local task available for recreation", () => {
  const row = googleTaskToRow(task, "Personal");
  const cleared = clearGoogleTaskLink(row, "Personal");
  assert.equal(cleared.values[GOOGLE_TASK_PROPERTY_IDS.id], "");
  assert.equal(cleared.values[GOOGLE_TASK_PROPERTY_IDS.link], "");
  assert.equal(cleared.title, row.title);
});
