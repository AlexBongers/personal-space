import type { BlockType } from '@shared';

export interface BlockSpec {
  type: BlockType;
  label: string;
  hint: string;
  glyph: string;
  keywords: string[];
}

/** Slash-menu entries, in the order they are offered. */
export const BLOCK_SPECS: BlockSpec[] = [
  {
    type: 'paragraph',
    label: 'Text',
    hint: 'Plain paragraph',
    glyph: 'T',
    keywords: ['paragraph', 'plain', 'body'],
  },
  {
    type: 'heading1',
    label: 'Heading 1',
    hint: 'Big section title',
    glyph: 'H1',
    keywords: ['title', 'large', 'h1'],
  },
  {
    type: 'heading2',
    label: 'Heading 2',
    hint: 'Medium section title',
    glyph: 'H2',
    keywords: ['subtitle', 'h2'],
  },
  {
    type: 'heading3',
    label: 'Heading 3',
    hint: 'Small section title',
    glyph: 'H3',
    keywords: ['h3', 'minor'],
  },
  {
    type: 'bulleted',
    label: 'Bulleted list',
    hint: 'A simple bullet',
    glyph: '•',
    keywords: ['bullet', 'unordered', 'ul', 'list'],
  },
  {
    type: 'numbered',
    label: 'Numbered list',
    hint: 'Steps in order',
    glyph: '1.',
    keywords: ['number', 'ordered', 'ol', 'list', 'steps'],
  },
  {
    type: 'todo',
    label: 'To-do',
    hint: 'Track it with a checkbox',
    glyph: '☑',
    keywords: ['task', 'todo', 'checkbox', 'check'],
  },
  {
    type: 'quote',
    label: 'Quote',
    hint: 'Set a passage apart',
    glyph: '❝',
    keywords: ['quote', 'citation', 'blockquote'],
  },
  {
    type: 'divider',
    label: 'Divider',
    hint: 'A line between sections',
    glyph: '—',
    keywords: ['divider', 'line', 'rule', 'separator', 'hr'],
  },
  {
    type: 'code',
    label: 'Code',
    hint: 'Monospaced, as typed',
    glyph: '{ }',
    keywords: ['code', 'snippet', 'mono', 'pre'],
  },
  {
    type: 'callout',
    label: 'Callout',
    hint: 'Make it stand out',
    glyph: '★',
    keywords: ['callout', 'note', 'info', 'aside'],
  },
];

export const SPEC_BY_TYPE: Record<BlockType, BlockSpec> = Object.fromEntries(
  BLOCK_SPECS.map((spec) => [spec.type, spec]),
) as Record<BlockType, BlockSpec>;

/** Slash-menu entries matching a query, ranked by where the match lands. */
export function filterSpecs(query: string): BlockSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return BLOCK_SPECS;
  return BLOCK_SPECS.filter(
    (spec) =>
      spec.label.toLowerCase().includes(q) || spec.keywords.some((word) => word.includes(q)),
  ).sort((a, b) => rank(a, q) - rank(b, q));
}

function rank(spec: BlockSpec, q: string): number {
  const label = spec.label.toLowerCase();
  if (label.startsWith(q)) return 0;
  if (label.includes(q)) return 1;
  if (spec.keywords.some((word) => word.startsWith(q))) return 2;
  return 3;
}

/** Blocks that carry no text of their own. */
export const VOID_TYPES: BlockType[] = ['divider'];

export const LIST_TYPES: BlockType[] = ['bulleted', 'numbered', 'todo'];
