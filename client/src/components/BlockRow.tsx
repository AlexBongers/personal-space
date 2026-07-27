import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type KeyboardEvent } from 'react';
import type { Block, BlockType } from '@shared';
import { BLOCK_SPECS, SPEC_BY_TYPE } from '../blocks.ts';
import { Editable } from './Editable.tsx';
import { MenuItem, Popover, anchorBelow, type Anchor } from './Popover.tsx';
import { Grip, Plus, Trash } from './icons.tsx';

interface BlockRowProps {
  block: Block;
  /** 1-based position within a run of numbered blocks. */
  ordinal: number;
  focused: boolean;
  onText: (text: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onToggleCheck: () => void;
  onInsertBelow: () => void;
  onSetType: (type: BlockType) => void;
  onDelete: () => void;
}

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  paragraph: "Type '/' for blocks",
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bulleted: 'List item',
  numbered: 'List item',
  todo: 'To-do',
  quote: 'Quote',
  code: 'Code',
  callout: 'Callout',
};

export function BlockRow(props: BlockRowProps) {
  const { block } = props;
  const [menu, setMenu] = useState<Anchor | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  const text = (
    <Editable
      className="block__text"
      value={block.text}
      onChange={props.onText}
      onKeyDown={props.onKeyDown}
      onFocus={props.onFocus}
      autoFocus={props.focused}
      placeholder={PLACEHOLDER[block.type]}
      ariaLabel={`${SPEC_BY_TYPE[block.type].label} block`}
      testId={`block-text-${block.id}`}
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`block block--${block.type}`}
      data-testid={`block-${block.id}`}
      data-block-type={block.type}
    >
      <div className="block__gutter">
        <button
          className="block__handle"
          aria-label="Insert block below"
          onClick={props.onInsertBelow}
        >
          <Plus />
        </button>
        <button
          className="block__handle"
          aria-label={`Block options and drag handle for ${SPEC_BY_TYPE[block.type].label}`}
          {...attributes}
          {...listeners}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ ...anchorBelow(r, 4), x: r.right + 6 });
          }}
        >
          <Grip />
        </button>
      </div>

      <div className="block__body">
        {block.type === 'divider' ? (
          <hr className="block__divider" aria-label="Divider block" />
        ) : block.type === 'todo' ? (
          /* Deliberately not a <label>: clicking the text must place the caret. */
          <div className="block__todo">
            <input
              type="checkbox"
              checked={block.checked}
              onChange={props.onToggleCheck}
              aria-label={`To-do: ${block.text || 'empty'}`}
            />
            {text}
          </div>
        ) : block.type === 'bulleted' ? (
          <div className="block__marked">
            <span className="block__marker" aria-hidden>
              •
            </span>
            {text}
          </div>
        ) : block.type === 'numbered' ? (
          <div className="block__marked">
            <span className="block__marker block__marker--num" aria-hidden>
              {props.ordinal}.
            </span>
            {text}
          </div>
        ) : block.type === 'callout' ? (
          <div className="block__callout">
            <span className="block__callout-mark" aria-hidden>
              ★
            </span>
            {text}
          </div>
        ) : block.type === 'quote' ? (
          <div className="block__quote">
            <span className="block__quote-mark" aria-hidden>
              ❝
            </span>
            {text}
          </div>
        ) : (
          text
        )}
      </div>

      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} label="Block options">
          <div className="menu__label">Turn into</div>
          <div className="menu__scroll">
            {BLOCK_SPECS.map((spec) => (
              <MenuItem
                key={spec.type}
                label={spec.label}
                active={spec.type === block.type}
                onClick={() => {
                  setMenu(null);
                  props.onSetType(spec.type);
                }}
              >
                <span className="slash__glyph">{spec.glyph}</span>
                {spec.label}
              </MenuItem>
            ))}
          </div>
          <div className="menu__sep" />
          <MenuItem
            label="Delete block"
            danger
            onClick={() => {
              setMenu(null);
              props.onDelete();
            }}
          >
            <Trash /> Delete block
          </MenuItem>
        </Popover>
      )}
    </div>
  );
}
