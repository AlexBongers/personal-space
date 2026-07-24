interface DeleteConfirmDialogProps {
  title: string;
  hasChildren: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({ title, hasChildren, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 8,
          padding: 24,
          maxWidth: 380,
          width: '90%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
          Delete &ldquo;{title}&rdquo;
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          {hasChildren
            ? 'This page and all its sub-pages will be permanently deleted. This cannot be undone.'
            : 'This page will be permanently deleted. This cannot be undone.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              background: 'var(--bg-hover)',
              color: 'var(--text)',
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              background: '#ef4444',
              color: '#fff',
              fontWeight: 500,
            }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}