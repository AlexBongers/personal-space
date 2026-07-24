import { Page } from '../api';
import PageTree from './PageTree';
import AddPageButton from './AddPageButton';

interface SidebarProps {
  pages: Page[];
  loading: boolean;
}

export default function Sidebar({ pages, loading }: SidebarProps) {
  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100%',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 16px 8px',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Personal Space
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
        {loading ? (
          <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <PageTree pages={pages} />
        )}
      </div>
      <AddPageButton />
    </aside>
  );
}