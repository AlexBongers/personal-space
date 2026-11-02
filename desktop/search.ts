import type { Block, Item } from "../app/personal-space/types.ts";

export type SearchHit = { id: string; rowId?: string; label: string; context: string; snippet: string; icon: string };

type Candidate = { id: string; rowId?: string; title: string; text: string; context: string; icon: string };

const blockText = (blocks: Block[]) => blocks.map((block) => block.text).join(" ").replace(/\s+/g, " ");

const snippetAround = (text: string, word: string) => {
  const at = text.toLowerCase().indexOf(word);
  if (at < 0) return "";
  const start = Math.max(0, at - 40);
  return `${start > 0 ? "..." : ""}${text.slice(start, at + word.length + 60).trim()}${at + word.length + 60 < text.length ? "..." : ""}`;
};

/** Every word must appear in the title or the content. Title matches rank first, then title prefixes, then content. */
export const searchWorkspace = (items: Item[], query: string, limit = 20): SearchHit[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const live = items.filter((item) => !item.trash);
  const titles = new Map(live.map((item) => [item.id, item.title]));
  const candidates = live.flatMap((item): Candidate[] => {
    const own: Candidate = { id: item.id, title: item.title, text: item.kind === "page" ? blockText(item.blocks) : "", context: item.parentId ? titles.get(item.parentId) || "" : "", icon: item.icon };
    const rows = item.kind === "database" ? item.rows.filter((row) => !row.trash).map((row) => ({
      id: item.id, rowId: row.id, title: row.title, context: item.title, icon: item.icon,
      text: `${blockText(row.blocks)} ${Object.values(row.values).flat().filter((value) => typeof value === "string").join(" ")}`,
    })) : [];
    return [own, ...rows];
  });
  const scored = candidates.flatMap((candidate) => {
    const title = candidate.title.toLowerCase();
    const all = `${title} ${candidate.text.toLowerCase()}`;
    if (!words.every((word) => all.includes(word))) return [];
    const inTitle = words.filter((word) => title.includes(word)).length;
    const score = inTitle * 10 + (title.startsWith(words[0]) ? 5 : 0);
    const contentWord = words.find((word) => !title.includes(word)) ?? words[0];
    return [{ candidate, score, snippet: inTitle === words.length ? "" : snippetAround(candidate.text, contentWord) }];
  });
  return scored
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .slice(0, limit)
    .map(({ candidate, snippet }) => ({ id: candidate.id, rowId: candidate.rowId, label: candidate.title || "Zonder titel", context: candidate.context, snippet, icon: candidate.icon }));
};
