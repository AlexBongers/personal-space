import { useState } from 'react';
import type { PageDetail } from '@shared';
import { displayTitle } from '../db.ts';
import { BlockEditor } from './BlockEditor.tsx';
import { DatabaseView } from './DatabaseView.tsx';
import { Editable } from './Editable.tsx';
import { EmojiPicker } from './EmojiPicker.tsx';
import type { Anchor } from './Popover.tsx';
import { RowProperties } from './RowProperties.tsx';

interface PageViewProps {
  detail: PageDetail;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string | null) => void;
  onNavigate: (id: string) => void;
}

const KIND_LABEL = { page: 'Page', database: 'Database', row: 'Entry' } as const;

export function PageView({ detail, onTitleChange, onIconChange, onNavigate }: PageViewProps) {
  const [iconAnchor, setIconAnchor] = useState<Anchor | null>(null);
  const { page, breadcrumb } = detail;
  const wide = page.kind === 'database';

  return (
    <article className={`page${wide ? ' page--wide' : ''}`}>
      <nav className="page__crumbs" aria-label="Breadcrumb">
        {breadcrumb.map((crumb) => (
          <span key={crumb.id}>
            <button className="crumb" onClick={() => onNavigate(crumb.id)}>
              {crumb.icon ? `${crumb.icon} ` : ''}
              {displayTitle(crumb.title)}
            </button>
            <span aria-hidden> / </span>
          </span>
        ))}
        <span className="crumb crumb--current">{displayTitle(page.title)}</span>
      </nav>

      <header className="page__head">
        <button
          className="page__icon"
          aria-label="Change page icon"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setIconAnchor({ x: r.left, y: r.bottom + 6 });
          }}
        >
          {page.icon ?? '📄'}
        </button>
        <Editable
          key={page.id}
          className="page__title"
          value={page.title}
          onChange={onTitleChange}
          ariaLabel="Page title"
          testId="page-title"
        />
      </header>

      <div className="page__meta">
        <span className={`tag tag--${page.kind}`}>{KIND_LABEL[page.kind]}</span>
      </div>

      {/* The keys reset per page, and must differ from each other: two siblings
          sharing a key leaves React unable to remove one of them cleanly. */}
      {detail.row && (
        <RowProperties
          key={`props-${page.id}`}
          rowId={page.id}
          properties={detail.row.properties}
          values={detail.row.values}
        />
      )}

      {detail.database ? (
        <DatabaseView key={`db-${page.id}`} detail={detail.database} onOpenRow={onNavigate} />
      ) : (
        <BlockEditor key={`blocks-${page.id}`} pageId={page.id} initial={detail.blocks} />
      )}

      {iconAnchor && (
        <EmojiPicker
          anchor={iconAnchor}
          onClose={() => setIconAnchor(null)}
          onPick={(emoji) => {
            setIconAnchor(null);
            onIconChange(emoji);
          }}
        />
      )}
    </article>
  );
}
