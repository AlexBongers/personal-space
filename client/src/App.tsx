import { useEffect, useState } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { usePagesStore } from './store/pages';
import { useThemeStore } from './store/theme';
import Sidebar from './components/Sidebar';
import PageEditor from './components/PageEditor';
import DatabaseView from './components/DatabaseView';
import RowPage from './components/RowPage';
import QuickFind from './components/QuickFind';
import { fetchPage, fetchTheme } from './api';
import type { Page } from './api';
import './styles/light.css';
import './styles/dark.css';

function PageView({ pageId }: { pageId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPage(pageId).then(p => {
      setPage(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pageId]);

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  if (!page) {
    return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Page not found</div>;
  }

  if (page.type === 'database') {
    return <DatabaseView key={pageId} pageId={pageId} />;
  }

  if (page.type === 'row') {
    return <RowPage key={pageId} pageId={pageId} />;
  }

  return <PageEditor key={pageId} pageId={pageId} />;
}

function EmptyState() {
  return (
    <div style={{ padding: '32px 48px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-secondary)' }}>Select a page from the sidebar</h1>
    </div>
  );
}

export default function App() {
  const { pages, loading, loadPages } = usePagesStore();
  const { theme, setTheme } = useThemeStore();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    fetchTheme().then(serverTheme => {
      if (serverTheme && serverTheme !== theme) {
        setTheme(serverTheme as 'light' | 'dark');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  return (
    <div className={theme} style={{ display: 'flex', height: '100%' }}>
      <Sidebar pages={pages} loading={loading} onSearchOpen={() => setSearchOpen(true)} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<EmptyState />} />
          <Route path="/page/:id" element={<PageViewWrapper />} />
        </Routes>
      </main>
      <QuickFind open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function PageViewWrapper() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <PageView pageId={id} />;
}