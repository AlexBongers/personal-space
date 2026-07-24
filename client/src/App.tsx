import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { usePagesStore } from './store/pages';
import { useThemeStore } from './store/theme';
import Sidebar from './components/Sidebar';
import './styles/light.css';
import './styles/dark.css';

function PageView({ pageId }: { pageId: string }) {
  return (
    <div style={{ padding: '32px 48px', maxWidth: 800, margin: '0 auto' }}>
      <h1>Page: {pageId}</h1>
    </div>
  );
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
  const params = { id: window.location.pathname.split('/page/')[1] };
  return <PageView pageId={params.id} />;
}