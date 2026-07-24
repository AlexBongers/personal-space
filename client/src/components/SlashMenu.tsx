import { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/core';

export interface SlashMenuItem {
  title: string;
  description: string;
  icon: string;
  command: (editor: Editor) => void;
}

export const ITEMS: SlashMenuItem[] = [
  { title: 'Text', description: 'Just start typing', icon: 'A', command: (e) => e.chain().focus().setParagraph().run() },
  { title: 'Heading 1', description: 'Big section heading', icon: 'H1', command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', description: 'Medium section heading', icon: 'H2', command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Heading 3', description: 'Small section heading', icon: 'H3', command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: 'Bullet List', description: 'Create a simple bullet list', icon: '\u2022', command: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered List', description: 'Create a numbered list', icon: '1.', command: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: 'To-do List', description: 'Track tasks with checkboxes', icon: '\u2611', command: (e) => e.chain().focus().toggleTaskList().run() },
  { title: 'Quote', description: 'Capture a quote', icon: '\u201C', command: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: 'Divider', description: 'Insert a horizontal divider', icon: '\u2014', command: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: 'Code Block', description: 'Capture a code snippet', icon: '<>', command: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: 'Callout', description: 'Make it stand out', icon: '!', command: (e) => e.chain().focus().toggleCallout().run() },
];

interface SlashMenuProps {
  items: SlashMenuItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export default function SlashMenu({ items, selectedIndex, onSelect, onClose, position }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y + 24,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)',
        maxHeight: 320,
        overflow: 'auto',
        width: 260,
        padding: 4,
        zIndex: 1000,
      }}
    >
      {items.length === 0 ? (
        <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13 }}>No results</div>
      ) : (
        items.map((item, index) => (
          <div
            key={item.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              background: index === selectedIndex ? 'var(--bg-hover)' : 'transparent',
            }}
            onClick={() => onSelect(index)}
            onMouseEnter={() => {}}
          >
            <span style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 14, fontWeight: 600,
              color: 'var(--accent)',
            }}>
              {item.icon}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.description}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}