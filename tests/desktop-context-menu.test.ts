import assert from "node:assert/strict";
import test from "node:test";
import { contextMenuTemplate } from "../desktop/context-menu.ts";

const flags = { canCut: true, canCopy: true, canPaste: true, canUndo: false, canRedo: false, canDelete: true, canSelectAll: true, canEditRichly: false };
const base = { misspelledWord: "", dictionarySuggestions: [], isEditable: false, selectionText: "", linkURL: "", editFlags: flags };
const calls: string[] = [];
const actions = {
  replaceMisspelling: (word: string) => calls.push(`replace:${word}`),
  addToDictionary: (word: string) => calls.push(`add:${word}`),
  openExternal: (url: string) => calls.push(`open:${url}`),
  copyText: (text: string) => calls.push(`copy:${text}`),
};

test("a misspelled word offers suggestions and the dictionary", () => {
  const items = contextMenuTemplate({ ...base, isEditable: true, misspelledWord: "afsrpaak", dictionarySuggestions: ["afspraak", "afspraken"] }, actions);
  assert.deepEqual(items.slice(0, 3).map((item) => item.label), ["afspraak", "afspraken", "Voeg toe aan woordenboek"]);
  items[0].click?.({} as never, undefined, {} as never);
  items[2].click?.({} as never, undefined, {} as never);
  assert.deepEqual(calls.splice(0), ["replace:afspraak", "add:afsrpaak"]);
  assert.ok(items.some((item) => item.role === "paste"));
});

test("a link can be opened in the browser or copied", () => {
  const items = contextMenuTemplate({ ...base, linkURL: "https://nos.nl" }, actions);
  assert.deepEqual(items.map((item) => item.label), ["Open link in browser", "Kopieer link"]);
  items[1].click?.({} as never, undefined, {} as never);
  assert.deepEqual(calls.splice(0), ["copy:https://nos.nl"]);
});

test("selected text can be copied and an empty spot shows no menu", () => {
  assert.deepEqual(contextMenuTemplate({ ...base, selectionText: "tekst" }, actions).map((item) => item.role), ["copy"]);
  assert.deepEqual(contextMenuTemplate(base, actions), []);
});
