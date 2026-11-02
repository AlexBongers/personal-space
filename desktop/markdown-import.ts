import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { createBlock, createEmptyPage } from "../app/personal-space/model.ts";
import type { Block, Page } from "../app/personal-space/types.ts";

const stripFrontMatter = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n/, "");

/** Turns Markdown into blocks, one block per line; fenced code stays together. */
export const markdownToBlocks = (markdown: string, title = ""): Block[] => {
  const blocks: Block[] = [];
  const lines = stripFrontMatter(markdown.replaceAll("\r\n", "\n")).split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (line.startsWith("```")) {
      const code: string[] = [];
      for (index++; index < lines.length && !lines[index].startsWith("```"); index++) code.push(lines[index]);
      blocks.push(createBlock("code", code.join("\n")));
    } else if (/^###\s/.test(line)) blocks.push(createBlock("heading3", line.slice(4)));
    else if (/^##\s/.test(line)) blocks.push(createBlock("heading2", line.slice(3)));
    else if (/^#\s/.test(line)) { if (!(blocks.length === 0 && line.slice(2).trim() === title)) blocks.push(createBlock("heading1", line.slice(2))); }
    else if (/^[-*]\s\[[ xX]\]\s/.test(line)) blocks.push(createBlock("todo", line.slice(6), /\[[xX]\]/.test(line.slice(0, 6))));
    else if (/^[-*]\s/.test(line)) blocks.push(createBlock("bulleted", line.slice(2)));
    else if (/^\d+\.\s/.test(line)) blocks.push(createBlock("numbered", line.replace(/^\d+\.\s/, "")));
    else if (/^>\s?/.test(line)) blocks.push(createBlock("quote", line.replace(/^>\s?/, "")));
    else if (/^(---|\*\*\*)$/.test(line.trim())) blocks.push(createBlock("divider"));
    else blocks.push(createBlock("paragraph", line));
  }
  return blocks.length ? blocks : [createBlock("paragraph")];
};

/** Reads a folder of Markdown files into pages. A folder next to a file of the same name holds that page's children. */
export const importMarkdown = (dir: string, parentId: string | null): Page[] => {
  const entries = readdirSync(dir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith(".")).sort((a, b) => a.name.localeCompare(b.name));
  const folders = new Map(entries.filter((entry) => entry.isDirectory()).map((entry) => [entry.name, entry]));
  const pages: Page[] = [];
  for (const entry of entries.filter((candidate) => candidate.isFile() && extname(candidate.name).toLowerCase() === ".md")) {
    const title = basename(entry.name, extname(entry.name));
    const page: Page = { ...createEmptyPage(parentId), title, icon: "📄", blocks: markdownToBlocks(readFileSync(join(dir, entry.name), "utf8"), title) };
    pages.push(page);
    if (folders.has(title)) { pages.push(...importMarkdown(join(dir, title), page.id)); folders.delete(title); }
  }
  for (const name of folders.keys()) {
    const page: Page = { ...createEmptyPage(parentId), title: name, icon: "📁", blocks: [createBlock("paragraph")] };
    pages.push(page, ...importMarkdown(join(dir, name), page.id));
  }
  return pages;
};
