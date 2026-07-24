import { useEffect, useState } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { usePagesStore } from './store/pages';
import { useThemeStore } from './store/theme';
import Sidebar from './components/Sidebar';
import PageEditor from './components/PageEditor';
import DatabaseView from './components/DatabaseView';
import RowPage from './components/RowPage';
import { fetchPage } from './api';
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
    return <DatabaseView pageId={pageId} />;
  }

  if (page.type === 'row') {
    return <RowPage pageId={pageId} />;
  }

  return <PageEditor pageId={pageId} />;
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
  const { theme } = useThemeStore();

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  return (
    <div className={theme} style={{ display: 'flex', height: '100%' }}>
      <Sidebar pages={pages} loading={loading} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<EmptyState />} />
          <Route path="/page/:id" element={<PageViewWrapper />} />
        </Routes>
      </main>
    </div>
  );
}

function PageViewWrapper() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <PageView pageId={id} />;
}