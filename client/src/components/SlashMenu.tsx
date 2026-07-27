import { useEffect, useRef } from 'react';
import type { BlockType } from '@shared';
import type { BlockSpec } from '../blocks.ts';
import { Popover, type AnchorSource } from './Popover.tsx';

interface SlashMenuProps {
  anchor: AnchorSource;
  specs: BlockSpec[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (type: BlockType) => void;
  onClose: () => void;
}

/**
 * The `/` block picker. Keyboard handling lives in the editing block so that
 * arrows and Enter work without the menu ever taking focus.
 */
export function SlashMenu({ anchor, specs, activeIndex, onHover, onPick, onClose }: SlashMenuProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Scrolls the list itself. `scrollIntoView` would walk up and scroll the page
   * behind the menu, which shifts the very block being typed into.
   */
  useEffect(() => {
    const list = listRef.current;
    const item = activeRef.current;
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [activeIndex]);

  return (
    <Popover anchor={anchor} onClose={onClose} className="menu slash" label="Insert block">
      <div className="menu__label">Blocks</div>
      {specs.length === 0 && <div className="slash__empty">No blocks match</div>}
      <div ref={listRef} className="slash__list" data-testid="slash-menu">
        {specs.map((spec, index) => (
          <button
            key={spec.type}
            ref={index === activeIndex ? activeRef : undefined}
            role="menuitem"
            aria-label={spec.label}
            className={`slash__item${index === activeIndex ? ' slash__item--active' : ''}`}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(spec.type)}
          >
            <span className="slash__glyph">{spec.glyph}</span>
            <span className="slash__text">
              <span className="slash__label">{spec.label}</span>
              <span className="slash__hint">{spec.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
