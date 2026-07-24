import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Page } from '../api';
import { usePagesStore } from '../store/pages';
import PageTree from './PageTree';
import DeleteConfirmDialog from './DeleteConfirmDialog';

interface PageTreeNodeProps {
  page: Page;
  depth: number;
}

export default function PageTreeNode({ page, depth }: PageTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(page.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { renamePage, removePage, addPage } = usePagesStore();
  const isActive = location.pathname === `/page/${page.id}`;
  const hasChildren = page.children && page.children.length > 0;

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== page.title) {
      await renamePage(page.id, renameValue.trim());
    }
    setRenaming(false);
  };

  const handleDelete = async () => {
    await removePage(page.id);
    setShowDeleteConfirm(false);
  };

  const handleAddChild = async () => {
    const child = await addPage({ title: 'Untitled', parent_id: page.id });
    navigate(`/page/${child.id}`);
  };

  const handleClick = () => {
    navigate(`/page/${page.id}`);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 4px',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          background: isActive ? 'var(--sidebar-active)' : 'transparent',
          fontSize: 14,
          marginLeft: depth * 16,
          userSelect: 'none',
          position: 'relative',
        }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(true);
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {hasChildren && (
          <span
            style={{
              fontSize: 10,
              width: 16,
              textAlign: 'center',
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition)',
              flexShrink: 0,
            }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            ▶
          </span>
        )}
        {!hasChildren && <span style={{ width: 16, flexShrink: 0 }} />}
        <span style={{ marginRight: 6, fontSize: 16 }}>{page.icon || '📄'}</span>
        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              padding: '1px 4px',
              fontSize: 14,
              outline: 'none',
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text)',
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenameValue(page.title);
              setRenaming(true);
            }}
          >
            {page.title}
          </span>
        )}
        {showContextMenu && !renaming && (
          <div
            style={{
              position: 'absolute',
              right: 4,
              top: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
              minWidth: 140,
              padding: 4,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: 13,
                borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setRenaming(true); setRenameValue(page.title); setShowContextMenu(false); }}
            >
              Rename
            </button>
            <button
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: 13,
                borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { handleAddChild(); setShowContextMenu(false); }}
            >
              New sub-page
            </button>
            <button
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                fontSize: 13,
                borderRadius: 4,
                color: '#ef4444',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setShowDeleteConfirm(true); setShowContextMenu(false); }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <PageTree pages={page.children} depth={depth + 1} />
      )}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          title={page.title}
          hasChildren={hasChildren}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}