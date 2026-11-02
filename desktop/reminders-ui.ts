/** The reminders window: a form plus the list. It talks to the main process through the preload bridge only. */
export const REMINDERS_HTML = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Herinneringen</title>
<style>
  :root { color-scheme: light dark; font: 14px -apple-system, system-ui, sans-serif; }
  body { margin: 0; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  input, select, button { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid #8886; background: transparent; color: inherit; }
  button { cursor: pointer; } button.primary { background: #0c79d8; color: white; border-color: #0c79d8; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  #text { flex: 1; min-width: 200px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #8884; border-radius: 8px; }
  small { opacity: .65; } #error { color: #d33; min-height: 1em; }
</style></head>
<body>
  <div class="row"><input id="text" placeholder="Waaraan moet ik je herinneren?" autofocus></div>
  <div class="row">
    <input id="at" type="datetime-local">
    <button data-in="10">+10 min</button><button data-in="60">+1 uur</button><button data-tomorrow>Morgen 09:00</button>
  </div>
  <div class="row">
    <select id="repeat"><option value="none">Eenmalig</option><option value="daily">Elke dag</option><option value="weekly">Elke week</option></select>
    <label><input id="popup" type="checkbox"> Pop-up die blijft staan</label>
    <button class="primary" id="add">Toevoegen</button>
  </div>
  <div id="error"></div>
  <ul id="list"></ul>
  <script>
    const $ = (id) => document.getElementById(id);
    const local = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const setIn = (minutes) => { $("at").value = local(new Date(Date.now() + minutes * 60000)); };
    const labels = { none: "", daily: " (dagelijks)", weekly: " (wekelijks)" };
    const render = (reminders) => {
      $("list").replaceChildren(...reminders.map((reminder) => {
        const li = document.createElement("li");
        const info = document.createElement("span");
        info.textContent = reminder.text;
        const small = document.createElement("small");
        small.textContent = " " + new Date(reminder.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" }) + labels[reminder.repeat] + (reminder.popup ? " - pop-up" : "");
        info.append(small);
        const remove = document.createElement("button");
        remove.textContent = "Verwijder";
        remove.onclick = async () => render(await window.reminders.remove(reminder.id));
        li.append(info, remove);
        return li;
      }));
    };
    document.querySelectorAll("[data-in]").forEach((button) => button.onclick = () => setIn(Number(button.dataset.in)));
    document.querySelector("[data-tomorrow]").onclick = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); $("at").value = local(d); };
    $("add").onclick = async () => {
      $("error").textContent = "";
      const result = await window.reminders.add({ text: $("text").value, at: $("at").value, repeat: $("repeat").value, popup: $("popup").checked });
      if (result.error) { $("error").textContent = result.error; return; }
      $("text").value = ""; render(result.reminders);
    };
    addEventListener("keydown", (event) => { if (event.key === "Enter") $("add").click(); if (event.key === "Escape") window.reminders.close(); });
    setIn(60);
    window.reminders.list().then(render);
  </script>
</body></html>`;
