import type { ContextMenuParams, MenuItemConstructorOptions } from "electron";

export type ContextMenuActions = {
  replaceMisspelling: (word: string) => void;
  addToDictionary: (word: string) => void;
  openExternal: (url: string) => void;
  copyText: (text: string) => void;
};

type Params = Pick<ContextMenuParams, "misspelledWord" | "dictionarySuggestions" | "isEditable" | "selectionText" | "linkURL" | "editFlags">;

/** The right-click menu Electron lacks by default: spelling suggestions, editing and links. */
export const contextMenuTemplate = (params: Params, actions: ContextMenuActions): MenuItemConstructorOptions[] => {
  const items: MenuItemConstructorOptions[] = [];
  if (params.misspelledWord) {
    const suggestions = params.dictionarySuggestions.slice(0, 5);
    items.push(...suggestions.map((word) => ({ label: word, click: () => actions.replaceMisspelling(word) })));
    if (!suggestions.length) items.push({ label: "Geen suggesties", enabled: false });
    items.push({ label: "Voeg toe aan woordenboek", click: () => actions.addToDictionary(params.misspelledWord) }, { type: "separator" });
  }
  if (params.linkURL) {
    items.push(
      { label: "Open link in browser", click: () => actions.openExternal(params.linkURL) },
      { label: "Kopieer link", click: () => actions.copyText(params.linkURL) },
      { type: "separator" },
    );
  }
  if (params.isEditable) {
    items.push(
      { label: "Knippen", role: "cut", enabled: params.editFlags.canCut },
      { label: "Kopieer", role: "copy", enabled: params.editFlags.canCopy },
      { label: "Plak", role: "paste", enabled: params.editFlags.canPaste },
      { label: "Plak als tekst", role: "pasteAndMatchStyle", enabled: params.editFlags.canPaste },
      { label: "Selecteer alles", role: "selectAll" },
    );
  } else if (params.selectionText.trim()) {
    items.push({ label: "Kopieer", role: "copy" });
  }
  while (items.at(-1)?.type === "separator") items.pop();
  return items;
};
