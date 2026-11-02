/** The quick search window. It talks to the main process through the preload bridge only. */
export const SEARCH_HTML = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Zoeken in Personal Space</title>
<style>
  :root { color-scheme: light dark; font: 14px -apple-system, system-ui, sans-serif; }
  body { margin: 0; display: flex; flex-direction: column; height: 100vh; }
  input { font-size: 18px; padding: 14px 16px; border: 0; border-bottom: 1px solid #8884; background: transparent; color: inherit; outline: none; }
  ul { list-style: none; margin: 0; padding: 6px; overflow-y: auto; flex: 1; }
  li { padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
  li.active { background: #0c79d8; color: white; }
  .label { font-weight: 600; } .meta, .snippet { font-size: 12px; opacity: .7; }
  .empty { padding: 16px; opacity: .6; }
</style></head>
<body>
  <input id="query" placeholder="Zoek pagina's, notities en rijen..." autofocus>
  <ul id="results"></ul>
  <script>
    const input = document.getElementById("query");
    const list = document.getElementById("results");
    let hits = [];
    let active = 0;
    const render = () => {
      if (!hits.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = input.value.trim() ? "Niets gevonden." : "Typ om te zoeken. Enter opent, Esc sluit.";
        list.replaceChildren(empty);
        return;
      }
      list.replaceChildren(...hits.map((hit, index) => {
        const li = document.createElement("li");
        if (index === active) li.className = "active";
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = hit.icon + "  " + hit.label;
        li.append(label);
        if (hit.context) { const meta = document.createElement("span"); meta.className = "meta"; meta.textContent = "in " + hit.context; li.append(meta); }
        if (hit.snippet) { const snippet = document.createElement("span"); snippet.className = "snippet"; snippet.textContent = hit.snippet; li.append(snippet); }
        li.onclick = () => window.search.open(hit);
        return li;
      }));
      list.children[active]?.scrollIntoView({ block: "nearest" });
    };
    input.addEventListener("input", async () => { hits = await window.search.query(input.value); active = 0; render(); });
    addEventListener("keydown", (event) => {
      if (event.key === "Escape") window.search.close();
      if (event.key === "ArrowDown") { active = Math.min(active + 1, hits.length - 1); render(); event.preventDefault(); }
      if (event.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); event.preventDefault(); }
      if (event.key === "Enter" && hits[active]) window.search.open(hits[active]);
    });
    window.search.initial().then(async (query) => { input.value = query; hits = query ? await window.search.query(query) : []; render(); });
  </script>
</body></html>`;
