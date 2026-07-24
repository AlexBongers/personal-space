import { Page } from '../api';
import PageTree from './PageTree';
import AddPageButton from './AddPageButton';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  pages: Page[];
  loading: boolean;
  onSearchOpen: () => void;
}

export default function Sidebar({ pages, loading, onSearchOpen }: SidebarProps) {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Personal Space
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onSearchOpen}
            title="Search (Ctrl+K)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius)',
              color: 'var(--text-secondary)',
              transition: 'background var(--transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <ThemeToggle />
        </div>
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