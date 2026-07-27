import { useEffect, useRef, type KeyboardEvent } from 'react';

interface EditableProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  testId?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

/**
 * A plain-text contentEditable. The DOM is only written when it drifts from
 * `value`, so typing never moves the caret.
 */
export function Editable({
  value,
  onChange,
  className,
  placeholder,
  ariaLabel,
  testId,
  onKeyDown,
  onFocus,
  onBlur,
  autoFocus,
}: EditableProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [autoFocus]);

  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      spellCheck={false}
      data-placeholder={placeholder}
      data-testid={testId}
      aria-label={ariaLabel}
      onInput={(e) => onChange(e.currentTarget.textContent ?? '')}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ');
        document.execCommand('insertText', false, text);
      }}
    />
  );
}
