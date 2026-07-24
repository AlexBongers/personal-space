import { type ViewType } from './DatabaseView';

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const VIEWS: { key: ViewType; label: string }[] = [
  { key: 'table', label: 'Table' },
  { key: 'board', label: 'Board' },
  { key: 'list', label: 'List' },
];

export default function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
      {VIEWS.map(view => (
        <button
          key={view.key}
          onClick={() => onViewChange(view.key)}
          style={{
            padding: '6px 16px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: activeView === view.key ? 600 : 400,
            color: activeView === view.key ? 'var(--text)' : 'var(--text-secondary)',
            background: activeView === view.key ? 'var(--bg-hover)' : 'transparent',
            border: '1px solid var(--border)',
            borderRight: view.key !== VIEWS[VIEWS.length - 1].key ? 'none' : '1px solid var(--border)',
            borderTopLeftRadius: view.key === 'table' ? 6 : 0,
            borderBottomLeftRadius: view.key === 'table' ? 6 : 0,
            borderTopRightRadius: view.key === 'list' ? 6 : 0,
            borderBottomRightRadius: view.key === 'list' ? 6 : 0,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}