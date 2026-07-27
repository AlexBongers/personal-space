import { useCallback, useEffect, useState } from 'react';
import type { PageDetail, PageKind, PageNode } from '@shared';
import { api } from './api.ts';
import { ConfirmDialog } from './components/ConfirmDialog.tsx';
import { PageView } from './components/PageView.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Moon, Search, Sun } from './components/icons.tsx';
import { QuickFind } from './components/QuickFind.tsx';
import { useDebounced, useHashRoute, useStored, useTheme } from './hooks.ts';

function countSubtree(node: PageNode): number {
  return 1 + node.children.reduce((total, child) => total + countSubtree(child), 0);
}

export default function App() {
  const [tree, setTree] = useState<PageNode[]>([]);
  const [detail, setDetail] = useState<PageDetail | null>(null);
  const [activeId, navigate] = useHashRoute();
  const [expandedIds, setExpandedIds] = useStored<string[]>('ps.expanded', []);
  const [deleteTarget, setDeleteTarget] = useState<PageNode | null>(null);
  const [ready, setReady] = useState(false);
  const [finding, setFinding] = useState(false);
  const [theme, toggleTheme] = useTheme();

  const expanded = new Set(expandedIds);

  const refreshTree = useCallback(async () => {
    const next = await api.tree();
    setTree(next);
    return next;
  }, []);

  useEffect(() => {
    refreshTree().then((next) => {
      setReady(true);
      if (!window.location.hash && next.length) window.location.hash = `#/p/${next[0].id}`;
    });
  }, [refreshTree]);

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    let stale = false;
    api
      .page(activeId)
      .then((next) => {
        if (stale) return;
        setDetail(next);
        revealInTree(next.breadcrumb.map((crumb) => crumb.id));
      })
      .catch(() => !stale && setDetail(null));
    return () => {
      stale = true;
    };
    // Reveal uses the expanded set captured at load time, which is what we want.
  }, [activeId]);

  /** Opens every ancestor so the current page is visible in the sidebar. */
  const revealInTree = (ancestorIds: string[]) => {
    const missing = ancestorIds.filter((id) => !expandedIds.includes(id));
    if (missing.length) setExpandedIds([...expandedIds, ...missing]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setFinding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds([...next]);
  };

  const expand = (id: string) => {
    if (!expandedIds.includes(id)) setExpandedIds([...expandedIds, id]);
  };

  const createPage = async (parentId: string | null, kind: PageKind = 'page') => {
    const isDatabase = kind === 'database';
    const page = await api.createPage({
      parentId,
      kind,
      title: isDatabase ? 'Untitled database' : 'Untitled',
      icon: isDatabase ? '🗄️' : '📄',
    });
    await refreshTree();
    if (parentId) expand(parentId);
    navigate(page.id);
  };

  const renamePage = async (id: string, title: string) => {
    await api.updatePage(id, { title });
    await refreshTree();
    if (id === activeId) setDetail((d) => (d ? { ...d, page: { ...d.page, title } } : d));
  };

  const saveTitle = useDebounced((id: string, title: string) => {
    api.updatePage(id, { title }).then(refreshTree);
  });

  const changeIcon = async (icon: string | null) => {
    if (!detail) return;
    const page = await api.updatePage(detail.page.id, { icon });
    setDetail({ ...detail, page });
    await refreshTree();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { removed } = await api.deletePage(deleteTarget.id);
    setDeleteTarget(null);
    const next = await refreshTree();
    if (activeId && removed.includes(activeId)) {
      if (next.length) navigate(next[0].id);
      else window.location.hash = '';
    }
  };

  return (
    <div className="app">
      <Sidebar
        tree={tree}
        activeId={activeId}
        expanded={expanded}
        onToggle={toggle}
        onSelect={navigate}
        onCreate={createPage}
        onRename={renamePage}
        onRequestDelete={setDeleteTarget}
        tools={
          <>
            <button className="btn btn--wide" onClick={() => setFinding(true)}>
              <Search /> Search
              <kbd className="kbd">⌘K</kbd>
            </button>
            <button
              className="btn btn--icon"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon /> : <Sun />}
            </button>
          </>
        }
      />

      <main className="app__main">
        {detail ? (
          <PageView
            detail={detail}
            onNavigate={navigate}
            onIconChange={changeIcon}
            onTitleChange={(title) => {
              setDetail((d) => (d ? { ...d, page: { ...d.page, title } } : d));
              saveTitle(detail.page.id, title);
            }}
          />
        ) : (
          <div className="center-note">
            <h2>{ready ? 'Nothing selected' : 'Loading your space…'}</h2>
            {ready && <p>Pick a page from the sidebar, or create a new one.</p>}
          </div>
        )}
      </main>

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.title}"?`}
          body={
            countSubtree(deleteTarget) > 1
              ? `This also deletes ${countSubtree(deleteTarget) - 1} nested page(s). This cannot be undone.`
              : 'This cannot be undone.'
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {finding && (
        <QuickFind
          onClose={() => setFinding(false)}
          onPick={navigate}
        />
      )}
    </div>
  );
}
