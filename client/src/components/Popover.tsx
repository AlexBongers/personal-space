import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface Anchor {
  x: number;
  /** Preferred top edge, normally just below whatever opened the panel. */
  y: number;
  /** Bottom edge to use when the panel does not fit below, so it flips above. */
  flipY?: number;
}

/** An anchor that opens below a rectangle and flips above it when space runs out. */
export function anchorBelow(rect: DOMRect, gap = 6): Anchor {
  return { x: rect.left, y: rect.bottom + gap, flipY: rect.top - gap };
}

/** A point, or a way to measure one once the panel is in the DOM. */
export type AnchorSource = Anchor | (() => Anchor);

interface PopoverProps {
  anchor: AnchorSource;
  onClose: () => void;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  role?: string;
  label?: string;
}

/** A fixed-position panel that closes on outside click or Escape. */
export function Popover({
  anchor,
  onClose,
  children,
  align = 'left',
  className,
  role = 'menu',
  label,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fixed = typeof anchor === 'function' ? null : anchor;
  const [pos, setPos] = useState({ left: fixed?.x ?? 0, top: fixed?.y ?? 0 });

  // Held in a ref so an inline arrow does not restart the effect every render.
  const source = useRef(anchor);
  source.current = anchor;

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const point = typeof source.current === 'function' ? source.current() : source.current;
      const { width, height } = el.getBoundingClientRect();
      const left = align === 'right' ? point.x - width : point.x;

      const overflowsBelow = point.y + height > window.innerHeight - 8;
      const top = overflowsBelow && point.flipY !== undefined ? point.flipY - height : point.y;

      setPos({
        left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
      });
    };

    measure();
    // Opening can scroll the anchor into view; that lands on the next frame.
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
    // A fixed anchor re-measures when it moves; a lazy one measures on open.
  }, [fixed?.x, fixed?.y, fixed?.flipY, align]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={className ?? 'menu'} style={pos} role={role} aria-label={label}>
      {children}
    </div>
  );
}

interface MenuItemProps {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  label?: string;
}

export function MenuItem({ children, onClick, danger, active, label }: MenuItemProps) {
  const classes = ['menu__item'];
  if (danger) classes.push('menu__item--danger');
  if (active) classes.push('menu__item--active');
  return (
    <button role="menuitem" aria-label={label} className={classes.join(' ')} onClick={onClick}>
      {children}
    </button>
  );
}
