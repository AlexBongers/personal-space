import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../dist/client/.vite/manifest.json", import.meta.url), "utf8"));
const pageEntry = manifest["app/page.tsx"];

test("the initial route keeps heavy editors and dialogs in lazy chunks", () => {
  assert.ok(pageEntry, "app/page.tsx is present in the client manifest");
  assert.ok(statSync(new URL(`../dist/client/${pageEntry.file}`, import.meta.url)).size < 60_000, "the initial page chunk stays below 60 kB");
  for (const moduleName of [
    "app/personal-space/BlockEditor.tsx",
    "app/personal-space/DatabaseView.tsx",
    "app/personal-space/SearchDialog.tsx",
    "app/personal-space/GoogleTasksDialog.tsx",
    "app/personal-space/GoogleCalendarDialog.tsx",
  ]) assert.ok(pageEntry.dynamicImports?.includes(moduleName), `${moduleName} remains lazy-loaded`);
});

test("the compact mobile shell keeps controls usable without a second toolbar row", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 600px)"), css.indexOf("@media (max-width: 480px)"));
  assert.match(mobile, /\.topbar\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(mobile, /\.tasks-trigger\s*\{[^}]*display:\s*none/);
  assert.match(mobile, /\.content-scroll\s*\{[^}]*calc\(100dvh - 56px\)/);
  assert.match(mobile, /\.primary-button[^}]*min-height:\s*44px/);
});
