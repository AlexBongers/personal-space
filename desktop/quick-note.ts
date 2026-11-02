import { createBlock, createEmptyPage } from "../app/personal-space/model.ts";
import type { Page } from "../app/personal-space/types.ts";
import { loadWorkspace, saveWorkspace, type WorkspaceDatabase } from "../worker/workspace-store.ts";

const PAGE_TITLE = "Snelle notities";

const stamp = (now: Date) => new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(now);

/** Appends a note to the top-level page "Snelle notities", creating it when needed. Retries once on a revision conflict. */
export const addQuickNote = async (database: WorkspaceDatabase, text: string, now = new Date()) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { items, revision } = await loadWorkspace(database);
    const existing = items.find((item): item is Page => item.kind === "page" && item.parentId === null && !item.trash && item.title === PAGE_TITLE);
    const page = existing ?? { ...createEmptyPage(null), title: PAGE_TITLE, icon: "📝", blocks: [] };
    const blocks = [...page.blocks, createBlock("paragraph", `${stamp(now)} ${lines[0]}`), ...lines.slice(1).map((line) => createBlock("paragraph", line))];
    const next = existing ? items.map((item) => item.id === page.id ? { ...page, blocks } : item) : [...items, { ...page, blocks }];
    if ((await saveWorkspace(database, next, revision)).ok) return true;
  }
  throw new Error("De workspace veranderde tijdens het opslaan. Probeer opnieuw.");
};

/** The small capture window. It talks to the main process through the preload bridge only. */
export const QUICK_NOTE_HTML = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Snelle notitie</title>
<style>
  :root { color-scheme: light dark; font: 14px -apple-system, system-ui, sans-serif; }
  body { margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 8px; height: 100vh; box-sizing: border-box; }
  textarea { flex: 1; resize: none; border: 1px solid #8884; border-radius: 8px; padding: 10px; font: inherit; background: transparent; color: inherit; }
  textarea:focus { outline: 2px solid #0c79d8; }
  small { opacity: .6; }
</style></head>
<body>
  <textarea id="note" placeholder="Snelle notitie..." autofocus></textarea>
  <small>Cmd+Enter bewaart, Esc sluit.</small>
  <script>
    const note = document.getElementById("note");
    addEventListener("keydown", async (event) => {
      if (event.key === "Escape") window.quickNote.close();
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        const saved = await window.quickNote.save(note.value);
        if (saved) { note.value = ""; window.quickNote.close(); }
      }
    });
  </script>
</body></html>`;
