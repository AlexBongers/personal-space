import { useEffect, useRef, useState } from 'react';
import type { PageNode } from '@shared';
import { displayTitle } from '../db.ts';
import { anchorBelow } from './Popover.tsx';
import { ChevronRight, Dots, Plus } from './icons.tsx';

export interface TreeRowProps {
  node: PageNode;
  depth: number;
  activeId: string | null;
  expanded: Set<string>;
  renamingId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
  onMenu: (id: string, at: { x: number; y: number }) => void;
  onRenameCommit: (id: string, title: string) => void;
  onRenameCancel: () => void;
  menuOpenId: string | null;
}

export function TreeRow(props: TreeRowProps) {
  const { node, depth, activeId, expanded, renamingId, menuOpenId } = props;
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isRenaming = renamingId === node.id;

  const classes = ['row'];
  if (activeId === node.id) classes.push('row--active');
  if (menuOpenId === node.id) classes.push('row--menu-open');

  return (
    <>
      <div
        className={classes.join(' ')}
        style={{ paddingLeft: 4 + depth * 14 }}
        data-testid={`tree-row-${node.title}`}
        onClick={() => !isRenaming && props.onSelect(node.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          props.onMenu(node.id, { x: e.clientX, y: e.clientY });
        }}
      >
        <button
          className={`row__twisty${isOpen ? ' row__twisty--open' : ''}`}
          aria-label={isOpen ? `Collapse ${node.title}` : `Expand ${node.title}`}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle(node.id);
          }}
        >
          <ChevronRight />
        </button>

        <span className="row__icon">{node.icon ?? '·'}</span>

        {isRenaming ? (
          <RenameInput
            initial={node.title}
            onCommit={(title) => props.onRenameCommit(node.id, title)}
            onCancel={props.onRenameCancel}
          />
        ) : (
          <span className="row__label">{displayTitle(node.title)}</span>
        )}

        {!isRenaming && (
          <span className="row__actions">
            <button
              className="row__action"
              aria-label={`Add page inside ${node.title}`}
              onClick={(e) => {
                e.stopPropagation();
                props.onAddChild(node.id);
              }}
            >
              <Plus />
            </button>
            <button
              className="row__action"
              aria-label={`Actions for ${node.title}`}
              onClick={(e) => {
                e.stopPropagation();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                props.onMenu(node.id, anchorBelow(r, 4));
              }}
            >
              <Dots />
            </button>
          </span>
        )}
      </div>

      {isOpen &&
        node.children.map((child) => (
          <TreeRow key={child.id} {...props} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(value.trim() || 'Untitled');
  };

  return (
    <input
      ref={ref}
      className="row__rename"
      aria-label="Page name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          done.current = true;
          onCancel();
        }
      }}
    />
  );
}
