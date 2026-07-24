import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePagesStore } from '../store/pages';

export default function AddPageButton() {
  const [adding, setAdding] = useState(false);
  const { addPage } = usePagesStore();
  const navigate = useNavigate();

  const handleAdd = async () => {
    const page = await addPage({ title: 'Untitled' });
    setAdding(false);
    navigate(`/page/${page.id}`);
  };

  return (
    <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          borderRadius: 'var(--radius)',
          fontSize: 14,
          color: 'var(--text-secondary)',
          transition: 'background var(--transition)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onClick={handleAdd}
      >
        <span style={{ fontSize: 16 }}>+</span>
        <span>Add page</span>
      </button>
    </div>
  );
}