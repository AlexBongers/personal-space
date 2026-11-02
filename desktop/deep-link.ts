export const URL_SCHEME = "personal-space";

export type DeepLink =
  | { action: "note"; text: string }
  | { action: "reminder"; text: string; at?: string }
  | { action: "open"; id: string; rowId?: string }
  | { action: "search"; query: string }
  | { action: "show" };

/**
 * Links for Shortcuts, Siri, Raycast or a browser bookmark, for example
 * personal-space://note?text=Melk%20kopen or personal-space://reminder?text=morgen%209:00%20bellen.
 * Unknown links just show the app.
 */
export const parseDeepLink = (link: string): DeepLink => {
  let url: URL;
  try { url = new URL(link); } catch { return { action: "show" }; }
  if (url.protocol !== `${URL_SCHEME}:`) return { action: "show" };
  const action = (url.hostname || url.pathname.replace(/^\/+/, "")).toLowerCase();
  const get = (name: string) => url.searchParams.get(name)?.trim() || "";
  if (action === "note" && get("text")) return { action: "note", text: get("text") };
  if (action === "reminder" && get("text")) return get("at") ? { action: "reminder", text: get("text"), at: get("at") } : { action: "reminder", text: get("text") };
  if (action === "open" && get("id")) return get("row") ? { action: "open", id: get("id"), rowId: get("row") } : { action: "open", id: get("id") };
  if (action === "search") return { action: "search", query: get("q") };
  return { action: "show" };
};
