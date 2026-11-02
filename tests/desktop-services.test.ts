import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackgroundSync } from "../desktop/background-sync.ts";
import { createReminderService } from "../desktop/reminder-service.ts";
import { createScheduler } from "../desktop/scheduler.ts";

test("the scheduler runs each job on its own interval and keeps going after a failure", async () => {
  const runs: string[] = [];
  const errors: string[] = [];
  const scheduler = createScheduler([
    { name: "fast", everyMs: 1000, run: () => { runs.push("fast"); } },
    { name: "slow", everyMs: 5000, run: () => { runs.push("slow"); throw new Error("boom"); } },
  ], (name) => errors.push(name));
  const at = (ms: number) => new Date(1_000_000 + ms);
  await scheduler.tick(at(0));
  await scheduler.tick(at(500));
  await scheduler.tick(at(1000));
  await scheduler.tick(at(5000));
  assert.deepEqual(runs, ["fast", "slow", "fast", "fast", "slow"]);
  assert.deepEqual(errors, ["slow", "slow"]);
});

test("a job that is still running is not started twice", async () => {
  let release = () => {};
  let started = 0;
  const scheduler = createScheduler([{ name: "slow", everyMs: 0, run: () => { started++; return new Promise<void>((resolve) => { release = resolve; }); } }], () => {});
  const first = scheduler.tick();
  await scheduler.tick();
  release();
  await first;
  assert.equal(started, 1);
});

test("the reminder service keeps reminders in memory and writes every change", () => {
  const file = join(mkdtempSync(join(tmpdir(), "ps-service-")), "reminders.json");
  let changes = 0;
  const service = createReminderService(file, () => changes++);
  const now = new Date(2026, 5, 10, 14, 0);
  const added = service.addFromText("morgen 9:00 tandarts bellen", false, undefined, now);
  assert.ok(!("error" in added));
  assert.equal("error" in service.addFromText("geen tijd", false, undefined, now), true);
  service.add({ text: "Al voorbij", at: new Date(2026, 5, 10, 13, 0).toISOString(), repeat: "none", popup: false });
  assert.equal(JSON.parse(readFileSync(file, "utf8")).length, 2);
  assert.deepEqual(service.takeDue(now).map((reminder) => reminder.text), ["Al voorbij"]);
  assert.deepEqual(service.takeDue(now), []);
  assert.equal(service.countOn(new Date(2026, 5, 11)), 1);
  service.snooze("Later", 10, now);
  assert.equal(service.list()[0].text, "Later");
  service.remove(service.list()[0].id);
  assert.equal(createReminderService(file).list().length, 1);
  assert.equal(changes, 5);
});

test("a background pass that hangs is abandoned and the next pass can run", async () => {
  const errors: string[] = [];
  let calls = 0;
  const sync = createBackgroundSync({
    origin: "http://localhost:3210",
    isWindowOpen: () => true,
    onParro: () => {},
    onGmail: () => {},
    onError: (message) => errors.push(message),
    passTimeoutMs: 50,
    fetch: () => { calls++; return new Promise<Response>(() => {}); },
  });
  await sync.run();
  await sync.run();
  assert.equal(calls, 2);
  assert.equal(errors.filter((message) => message.includes("gestopt")).length, 2);
});
