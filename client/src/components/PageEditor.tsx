import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';
import { CalloutExtension } from './CalloutExtension';
import { DragHandleExtension } from './DragHandleExtension';
import { fetchPage, updatePage } from '../api';
import SlashMenu, { ITEMS } from './SlashMenu';

const lowlight = createLowlight(common);

interface PageEditorProps {
  pageId: string;
}

export default function PageEditor({ pageId }: PageEditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');

  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const slashMenuOpenRef = useRef(false);
  const slashQueryRef = useRef('');
  const selectedIndexRef = useRef(0);

  const closeSlashMenu = useCallback(() => {
    setSlashMenuOpen(false);
    setSlashQuery('');
    setSelectedIndex(0);
    slashMenuOpenRef.current = false;
    slashQueryRef.current = '';
    selectedIndexRef.current = 0;
  }, []);

  const filteredItems = useMemo(() => {
    if (!slashMenuOpen) return [];
    return ITEMS.filter(item =>
      item.title.toLowerCase().includes(slashQuery.toLowerCase())
    );
  }, [slashMenuOpen, slashQuery]);

  const saveContent = useCallback(async (json: any) => {
    const contentStr = JSON.stringify(json);
    if (contentStr === lastSavedContentRef.current) return;
    try {
      await updatePage(pageId, { content: json });
      lastSavedContentRef.current = contentStr;
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, [pageId]);

  const debouncedSave = useCallback((json: any) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveContent(json), 500);
  }, [saveContent]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      DragHandleExtension,
      Placeholder.configure({ placeholder: 'Type / for commands, or start typing...' }),
      CalloutExtension,
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: ed }) => {
      debouncedSave(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'prose-editor',
        style: 'min-height: 200px; outline: none; line-height: 1.7; font-size: 15px;',
      },
      handleKeyDown: (view, event) => {
        if (slashMenuOpenRef.current) {
          if (event.key === 'Escape') {
            closeSlashMenu();
            return true;
          }
          if (event.key === 'Enter') {
            const items = ITEMS.filter(item =>
              item.title.toLowerCase().includes(slashQueryRef.current.toLowerCase())
            );
            if (items[selectedIndexRef.current]) {
              items[selectedIndexRef.current].command(editor);
              closeSlashMenu();
            }
            return true;
          }
          if (event.key === 'ArrowDown') {
            const items = ITEMS.filter(item =>
              item.title.toLowerCase().includes(slashQueryRef.current.toLowerCase())
            );
            setSelectedIndex(i => {
              const next = Math.min(i + 1, items.length - 1);
              selectedIndexRef.current = next;
              return next;
            });
            return true;
          }
          if (event.key === 'ArrowUp') {
            setSelectedIndex(i => {
              const next = Math.max(i - 1, 0);
              selectedIndexRef.current = next;
              return next;
            });
            return true;
          }
          if (event.key === 'Backspace') {
            if (slashQueryRef.current.length === 0) {
              closeSlashMenu();
            } else {
              const newQuery = slashQueryRef.current.slice(0, -1);
              slashQueryRef.current = newQuery;
              setSlashQuery(newQuery);
            }
            return true;
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const newQuery = slashQueryRef.current + event.key;
            slashQueryRef.current = newQuery;
            setSlashQuery(newQuery);
            setSelectedIndex(0);
            selectedIndexRef.current = 0;
            return true;
          }
          return true;
        }

        if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const { $from } = view.state.selection;
          if ($from.parent.type.name === 'paragraph' && $from.parentOffset === 0) {
            const coords = view.coordsAtPos($from.pos);
            setMenuPosition({ x: coords.left, y: coords.top });
            setSlashMenuOpen(true);
            setSlashQuery('');
            setSelectedIndex(0);
            slashMenuOpenRef.current = true;
            slashQueryRef.current = '';
            selectedIndexRef.current = 0;
            return true;
          }
        }

        return false;
      },
    },
  });

  useEffect(() => {
    if (!pageId || !editor) return;
    (async () => {
      try {
        const page = await fetchPage(pageId);
        if (page.content && JSON.stringify(page.content) !== JSON.stringify(editor.getJSON())) {
          editor.commands.setContent(page.content);
          lastSavedContentRef.current = JSON.stringify(page.content);
        }
      } catch (e) {
        console.error('Failed to load page content:', e);
      }
    })();
  }, [pageId, editor]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  if (!editor) return null;

  return (
    <div style={{ padding: '32px 48px', maxWidth: 800, margin: '0 auto', position: 'relative' }}>
      {slashMenuOpen && (
        <SlashMenu
          items={filteredItems}
          selectedIndex={selectedIndex}
          onSelect={(index) => {
            filteredItems[index].command(editor);
            closeSlashMenu();
          }}
          onClose={closeSlashMenu}
          position={menuPosition}
        />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}