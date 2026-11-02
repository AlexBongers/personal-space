import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Block, CellValue, Database, Item, Page, Property } from "../app/personal-space/types.ts";

const fileName = (title: string, used: Set<string>) => {
  const base = (title.replace(/[\\/:*?"<>|\n\r]/g, " ").trim() || "Zonder titel").slice(0, 80);
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} ${n}`;
  used.add(name.toLowerCase());
  return name;
};

const blockToMarkdown = (block: Block, number: number) => {
  switch (block.type) {
    case "heading1": return `# ${block.text}`;
    case "heading2": return `## ${block.text}`;
    case "heading3": return `### ${block.text}`;
    case "bulleted": return `- ${block.text}`;
    case "numbered": return `${number}. ${block.text}`;
    case "todo": return `- [${block.checked ? "x" : " "}] ${block.text}`;
    case "quote":
    case "callout": return `> ${block.text}`;
    case "divider": return "---";
    case "code": return `\`\`\`\n${block.text}\n\`\`\``;
    default: return block.text;
  }
};

export const blocksToMarkdown = (blocks: Block[]) => {
  let number = 0;
  return blocks.map((block) => {
    number = block.type === "numbered" ? number + 1 : 0;
    return blockToMarkdown(block, number);
  }).join("\n\n");
};

const cellText = (property: Property, value: CellValue) => {
  if (value === null || value === "") return "";
  const label = (id: string) => property.options?.find((option) => option.id === id)?.label ?? id;
  return Array.isArray(value) ? value.map(label).join(", ") : property.type === "select" ? label(String(value)) : String(value);
};

const writeDatabase = (database: Database, dir: string) => {
  mkdirSync(dir, { recursive: true });
  const used = new Set<string>();
  for (const row of database.rows.filter((candidate) => !candidate.trash)) {
    const properties = database.properties.map((property) => `${property.name}: ${JSON.stringify(cellText(property, row.values[property.id] ?? null))}`);
    const body = blocksToMarkdown(row.blocks);
    writeFileSync(join(dir, `${fileName(row.title, used)}.md`), `---\n${properties.join("\n")}\n---\n\n# ${row.title}\n\n${body}\n`);
  }
};

/** Writes the workspace as Markdown files: pages nest in folders under their parent, databases become folders of rows. Returns the file count. */
export const exportMarkdown = (items: Item[], targetDir: string) => {
  const live = items.filter((item) => !item.trash);
  let count = 0;
  const writeLevel = (parentId: string | null, dir: string) => {
    mkdirSync(dir, { recursive: true });
    const used = new Set<string>();
    for (const item of live.filter((candidate) => candidate.parentId === parentId)) {
      const name = fileName(item.title, used);
      const children = live.filter((candidate) => candidate.parentId === item.id);
      if (item.kind === "page") {
        writeFileSync(join(dir, `${name}.md`), `# ${item.title}\n\n${blocksToMarkdown((item as Page).blocks)}\n`);
        count++;
      } else {
        writeDatabase(item, join(dir, name));
        count += item.rows.filter((row) => !row.trash).length;
      }
      if (children.length) writeLevel(item.id, join(dir, name));
    }
  };
  writeLevel(null, targetDir);
  return count;
};
