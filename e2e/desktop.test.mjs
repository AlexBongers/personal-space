// End-to-end tests for the macOS app shell. They start the real Electron app with its own data folder.
// Run with `npm run test:desktop`; on Linux without a display, wrap it in `xvfb-run -a`.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import electronPath from "electron";
import { _electron } from "playwright-core";
import { createGoogleTasksDatabase, GOOGLE_CALENDAR_PROPERTY_IDS as CAL, GOOGLE_TASK_PROPERTY_IDS as TASK } from "../app/personal-space/model.ts";

const root = new URL("..", import.meta.url).pathname;
let nextPort = 3400 + Math.floor(Math.random() * 400);

const launch = async ({ reminders, config = {}, windowBounds } = {}) => {
  const dataDir = mkdtempSync(join(tmpdir(), "ps-e2e-"));
  const port = nextPort++;
  writeFileSync(join(dataDir, "config.json"), JSON.stringify({ googleClientId: "", googleClientSecret: "", googleCalendarSyncOnly: "", port, ...config }));
  if (reminders) writeFileSync(join(dataDir, "reminders.json"), JSON.stringify(reminders));
  if (windowBounds) writeFileSync(join(dataDir, "window.json"), JSON.stringify(windowBounds));
  const app = await _electron.launch({
    executablePath: electronPath,
    args: ["--no-sandbox", "--password-store=basic", root],
    env: { ...process.env, PERSONAL_SPACE_DATA_DIR: dataDir },
  });
  const main = await app.firstWindow();
  await main.waitForLoadState("domcontentloaded");
  await main.getByText("Opgeslagen").first().waitFor({ timeout: 20_000 });
  // Record what the app hands to the browser and to macOS instead of really opening anything.
  await app.evaluate(({ shell, Notification }) => {
    globalThis.opened = [];
    globalThis.notified = [];
    shell.openExternal = async (url) => { globalThis.opened.push(url); };
    Notification.prototype.show = function show() { globalThis.notified.push({ title: this.title, body: this.body }); };
  });
  return { app, main, dataDir, port };
};

const clickMenu = (app, label) => app.evaluate(({ Menu }, wanted) => {
  const find = (items) => items.flatMap((item) => [item, ...(item.submenu ? find(item.submenu.items) : [])]);
  const item = find(Menu.getApplicationMenu().items).find((candidate) => candidate.label === wanted);
  if (!item) throw new Error(`No menu item ${wanted}`);
  item.click();
}, label);

const toolWindow = async (app, title) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    for (const page of app.windows()) if (page.url().startsWith("data:") && await page.title().catch(() => "") === title) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Window ${title} did not open`);
};

const recorded = (app, name) => app.evaluate((_electron, key) => globalThis[key], name);
const until = async (check, message) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(message);
};

describe("Personal Space desktop app", () => {
  let session;
  before(async () => { session = await launch(); });
  after(async () => { await session?.app.close(); });

  test("starts as Personal Space with its data in the chosen folder", async () => {
    // The internal name must stay "personal-space": the Keychain key that unlocks keys.bin is stored under it.
    const name = await session.app.evaluate(({ app, Menu }) => [app.getName(), app.getPath("userData"), Menu.getApplicationMenu().items[0].label]);
    assert.deepEqual(name, ["personal-space", session.dataDir, "Personal Space"]);
    for (const file of ["personal-space.sqlite", "keys.bin", "config.json"]) assert.ok(existsSync(join(session.dataDir, file)), file);
    assert.equal(new URL(session.main.url()).port, String(session.port));
  });

  test("the menus offer the desktop features", async () => {
    const labels = await session.app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.flatMap((item) => item.submenu ? item.submenu.items.map((sub) => sub.label) : []));
    for (const label of ["Snelle notitie", "Nieuwe herinnering...", "Zoeken...", "Exporteer als Markdown...", "Back-up terugzetten...", "Stuur test-melding", "Copy", "Paste"]) assert.ok(labels.includes(label), label);
  });

  test("a quick note appears in the open window without a reload", async () => {
    await session.main.evaluate(() => { window.notReloaded = true; });
    await clickMenu(session.app, "Snelle notitie");
    const note = await toolWindow(session.app, "Snelle notitie");
    await note.locator("textarea").fill("Melk kopen\nen brood");
    // Saving closes the window, so the key press itself ends with a closed page.
    await note.keyboard.press("Control+Enter").catch(() => {});
    await until(async () => (await session.main.getByText("Snelle notities").count()) > 0, "the notes page did not appear");
    assert.equal(await session.main.evaluate(() => window.notReloaded), true);
  });

  test("search finds note content and opens the page", async () => {
    await clickMenu(session.app, "Zoeken...");
    const search = await toolWindow(session.app, "Zoeken in Personal Space");
    await search.locator("input").fill("brood");
    await search.getByText("Snelle notities").waitFor();
    await search.keyboard.press("Enter").catch(() => {});
    await until(async () => (await session.main.getByText("Melk kopen").count()) > 0, "the notes page was not opened");
  });

  test("a reminder written in Dutch is understood and listed", async () => {
    await clickMenu(session.app, "Nieuwe herinnering...");
    const reminders = await toolWindow(session.app, "Herinneringen");
    await reminders.locator("#quick").fill("morgen 9:00 tandarts bellen");
    await reminders.locator("#quickAdd").click();
    await reminders.getByText("Tandarts bellen").waitFor();
    const stored = JSON.parse(readFileSync(join(session.dataDir, "reminders.json"), "utf8"));
    assert.equal(stored[0].text, "Tandarts bellen");
    assert.equal(new Date(stored[0].at).getHours(), 9);
    await reminders.locator("#quick").fill("tandarts zonder tijd");
    await reminders.locator("#quickAdd").click();
    await reminders.getByText("Ik zie geen tijdstip").waitFor();
    await reminders.close();
  });

  test("personal-space:// links add notes and reminders", async () => {
    await session.app.evaluate(({ app }) => {
      app.emit("open-url", { preventDefault() {} }, "personal-space://note?text=Via%20Shortcuts");
      app.emit("open-url", { preventDefault() {} }, "personal-space://reminder?text=over%2010%20min%20thee");
    });
    await until(async () => (await session.main.getByText("Via Shortcuts").count()) > 0, "the linked note did not appear");
    const stored = JSON.parse(readFileSync(join(session.dataDir, "reminders.json"), "utf8"));
    assert.ok(stored.some((reminder) => reminder.text === "Thee"));
    const notified = await recorded(session.app, "notified");
    assert.ok(notified.some((entry) => entry.title === "Herinnering gezet"));
  });

  test("external links and Google sign-in go to the default browser", async () => {
    await session.main.evaluate(() => window.open("https://nos.nl/artikel"));
    await session.main.evaluate((port) => { window.location.href = `http://localhost:${port}/api/google-tasks/connect`; }, session.port);
    await until(async () => (await recorded(session.app, "opened")).length >= 2, "links were not handed to the browser");
    const opened = await recorded(session.app, "opened");
    assert.ok(opened.includes("https://nos.nl/artikel"));
    assert.ok(opened.some((url) => url.endsWith("/api/google-tasks/connect")));
    assert.ok(session.main.url().startsWith(`http://localhost:${session.port}`));
  });
});

describe("reminders that came due while the app was closed", () => {
  let session;
  let extraBackups;
  before(async () => {
    extraBackups = join(mkdtempSync(join(tmpdir(), "ps-icloud-")), "Personal Space");
    // The window was last on a display that is no longer connected.
    session = await launch({ config: { briefingTime: "00:00", backupDir: extraBackups }, windowBounds: { x: -6000, y: -4000, width: 900, height: 700 }, reminders: [
      { id: "past", text: "Was gemist", at: "2020-01-01T09:00:00.000Z", repeat: "none", popup: false },
      { id: "daily", text: "Elke dag", at: "2020-01-01T09:00:00.000Z", repeat: "daily", popup: false },
    ] });
  });
  after(async () => { await session?.app.close(); });

  test("fire at the next start and move on", async () => {
    // They fire during startup, before the test can watch notifications, so check the stored result.
    const stored = JSON.parse(readFileSync(join(session.dataDir, "reminders.json"), "utf8"));
    assert.deepEqual(stored.map((reminder) => reminder.id), ["daily"]);
    assert.ok(new Date(stored[0].at) > new Date());
  });

  test("the daily briefing is given once and the backup also lands in the extra folder", async () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await until(async () => existsSync(join(session.dataDir, "notify-state.json")), "no briefing state was written");
    assert.equal(JSON.parse(readFileSync(join(session.dataDir, "notify-state.json"), "utf8")).lastBriefing, date);
    assert.equal(readdirSync(extraBackups).length, 1);
  });

  test("a window saved on a missing display opens on screen with its size", async () => {
    const bounds = await session.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    assert.equal(bounds.width, 900);
    assert.ok(bounds.x > -1000 && bounds.y > -1000, JSON.stringify(bounds));
  });

  test("a manual backup is always made", async () => {
    await clickMenu(session.app, "Maak back-up nu");
    await until(async () => readdirSync(join(session.dataDir, "backups")).length === 2, "the manual backup was not written");
    const notified = await recorded(session.app, "notified");
    assert.ok(notified.some((entry) => entry.title === "Back-up gemaakt"));
  });
});

describe("task and appointment editors", () => {
  let session;
  let base;
  const workspace = async () => (await fetch(`${base}/api/workspace`)).json();
  const rowsOf = async (id) => (await workspace()).items.find((item) => item.id === id).rows;

  before(async () => {
    session = await launch();
    base = `http://localhost:${session.port}`;
    // Add to the workspace the app already saved, instead of replacing its calendar database.
    await until(async () => (await workspace()).items.some((item) => item.id === "google-calendar"), "the app did not create its calendar database");
    const current = await workspace();
    const tasks = createGoogleTasksDatabase();
    tasks.rows = [
      { id: "t1", title: "Mail aan team", blocks: [], values: { [TASK.status]: "Open", [TASK.list]: "Werk" } },
      { id: "t2", title: "Boodschappen", blocks: [], values: { [TASK.status]: "Open", [TASK.list]: "Privé" } },
    ];
    const saved = await fetch(`${base}/api/workspace`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [...current.items, tasks], baseRevision: current.revision, protocolVersion: 2, capabilities: ["trash"] }) });
    assert.equal(saved.status, 200);
    await session.main.goto(`${base}/?open=google-tasks`);
    await session.main.locator(".task-group").first().waitFor();
  });
  after(async () => { await session?.app.close(); });

  test("a new task is only created when it is saved", async () => {
    const page = session.main;
    await page.getByRole("button", { name: /Nieuwe taak/ }).click();
    await page.locator(".editor-title-input").fill("Wordt geannuleerd");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Nieuwe taak/ }).click();
    await page.locator(".editor-title-input").fill("Cadeau kopen");
    await page.getByRole("radio", { name: "Privé" }).click();
    await page.getByRole("button", { name: "Morgen" }).click();
    await page.keyboard.press("Control+Enter");
    await until(async () => (await rowsOf("google-tasks")).some((row) => row.title === "Cadeau kopen"), "the task was not saved");
    const rows = await rowsOf("google-tasks");
    assert.ok(!rows.some((row) => row.title === "Wordt geannuleerd" || /Naamloze|Untitled/.test(row.title)));
    assert.equal(rows.find((row) => row.title === "Cadeau kopen").values[TASK.list], "Privé");
  });

  test("a task dragged to another list moves there", async () => {
    const page = session.main;
    await page.locator(".task-item", { hasText: "Mail aan team" }).dragTo(page.locator(".task-group", { hasText: "Privé" }).locator(".task-group-heading"));
    await until(async () => (await rowsOf("google-tasks")).find((row) => row.id === "t1").values[TASK.list] === "Privé", "the task did not move");
  });

  test("quick add puts a task in that list", async () => {
    const page = session.main;
    await page.locator(".task-group", { hasText: "Werk" }).locator(".task-quick-add input").fill("Notulen sturen");
    await page.keyboard.press("Enter");
    await until(async () => (await rowsOf("google-tasks")).some((row) => row.title === "Notulen sturen" && row.values[TASK.list] === "Werk"), "the quick task was not added");
  });

  test("an appointment added on a day starts at 09:00 for an hour and can be dragged to another day", async () => {
    const page = session.main;
    await page.goto(`${base}/?open=google-calendar`);
    const day = page.locator(".calendar-day:not(.outside-month)").nth(14);
    await day.locator(".calendar-add").click({ force: true });
    await page.locator(".editor-title-input").fill("Etentje");
    await page.keyboard.press("Control+Enter");
    await until(async () => (await rowsOf("google-calendar")).some((row) => row.title === "Etentje"), "the appointment was not saved");
    const saved = (await rowsOf("google-calendar")).find((row) => row.title === "Etentje");
    assert.equal(saved.values[CAL.allDay], false);
    assert.equal((new Date(saved.values[CAL.end]) - new Date(saved.values[CAL.start])) / 60_000, 60);
    assert.equal(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }).format(new Date(saved.values[CAL.start])), "09:00");
    await page.locator(".calendar-event", { hasText: "Etentje" }).dragTo(page.locator(".calendar-day:not(.outside-month)").nth(16));
    await until(async () => (await rowsOf("google-calendar")).find((row) => row.title === "Etentje").values[CAL.start] !== saved.values[CAL.start], "the appointment did not move");
    const moved = (await rowsOf("google-calendar")).find((row) => row.title === "Etentje");
    assert.equal((new Date(moved.values[CAL.start]) - new Date(saved.values[CAL.start])) / 86_400_000, 2);
  });
});
