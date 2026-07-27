import { useEffect, useRef, useState } from 'react';
import type { Property, PropertyValue, SelectOption } from '@shared';
import { optionsFor, selectedIds } from '../db.ts';
import { Popover, anchorBelow, type Anchor } from './Popover.tsx';
import { Check, Close } from './icons.tsx';

export interface CellProps {
  property: Property;
  value: PropertyValue;
  /** Used to build unique accessible names, e.g. "Due for Ship the board view". */
  rowTitle: string;
  onChange: (value: PropertyValue) => void;
  onAddOption: (name: string) => void;
}

export function Chip({ option }: { option: SelectOption }) {
  return (
    <span className={`chip chip--${option.color}`} data-testid={`chip-${option.name}`}>
      {option.name}
    </span>
  );
}

/** The right editor for a property's type. */
export function Cell(props: CellProps) {
  switch (props.property.type) {
    case 'checkbox':
      return <CheckboxCell {...props} />;
    case 'select':
    case 'multi_select':
      return <SelectCell {...props} />;
    case 'number':
      return <TextCell {...props} inputType="number" />;
    case 'date':
      return <TextCell {...props} inputType="date" />;
    case 'url':
      return <TextCell {...props} inputType="url" />;
    default:
      return <TextCell {...props} inputType="text" />;
  }
}

function label(property: Property, rowTitle: string): string {
  return `${property.name} for ${rowTitle}`;
}

function TextCell({
  property,
  value,
  rowTitle,
  onChange,
  inputType,
}: CellProps & { inputType: 'text' | 'number' | 'date' | 'url' }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const committed = useRef(draft);
  /** Set by Escape, so the blur it causes does not save the abandoned draft. */
  const abandoned = useRef(false);

  useEffect(() => {
    const next = value === null ? '' : String(value);
    if (next !== committed.current) {
      committed.current = next;
      setDraft(next);
    }
  }, [value]);

  return (
    <input
      className={`cell__input cell__input--${inputType}`}
      type={inputType}
      value={draft}
      aria-label={label(property, rowTitle)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (abandoned.current) {
          abandoned.current = false;
          setDraft(committed.current);
          return;
        }
        if (draft === committed.current) return;
        committed.current = draft;
        onChange(draft === '' ? null : draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          abandoned.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function CheckboxCell({ property, value, rowTitle, onChange }: CellProps) {
  return (
    <input
      className="cell__checkbox"
      type="checkbox"
      checked={value === true}
      aria-label={label(property, rowTitle)}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function SelectCell({ property, value, rowTitle, onChange, onAddOption }: CellProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [draft, setDraft] = useState('');
  const multi = property.type === 'multi_select';
  const chosen = optionsFor(property, value);
  const ids = selectedIds(value);

  const toggle = (option: SelectOption) => {
    if (!multi) {
      onChange(ids[0] === option.id ? null : option.id);
      setAnchor(null);
      return;
    }
    onChange(ids.includes(option.id) ? ids.filter((id) => id !== option.id) : [...ids, option.id]);
  };

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    setDraft('');
    onAddOption(name);
  };

  return (
    <>
      <button
        className="cell__select"
        aria-label={label(property, rowTitle)}
        onClick={(e) => {
          setAnchor(anchorBelow(e.currentTarget.getBoundingClientRect(), 4));
        }}
      >
        {chosen.length === 0 ? (
          <span className="cell__empty">Empty</span>
        ) : (
          chosen.map((option) => <Chip key={option.id} option={option} />)
        )}
      </button>

      {anchor && (
        <Popover
          anchor={anchor}
          onClose={() => setAnchor(null)}
          label={`Choose ${property.name}`}
          role="dialog"
        >
          <div className="menu__label">{multi ? 'Select any' : 'Select one'}</div>
          <div className="menu__scroll">
            {property.options.length === 0 && <div className="slash__empty">No options yet</div>}
            {property.options.map((option) => (
              <button
                key={option.id}
                role="menuitem"
                aria-label={option.name}
                className="menu__item"
                onClick={() => toggle(option)}
              >
                <span className="menu__tick">{ids.includes(option.id) ? <Check /> : null}</span>
                <Chip option={option} />
              </button>
            ))}
          </div>
          {chosen.length > 0 && (
            <>
              <div className="menu__sep" />
              <button
                role="menuitem"
                className="menu__item"
                aria-label="Clear value"
                onClick={() => {
                  onChange(multi ? [] : null);
                  setAnchor(null);
                }}
              >
                <Close /> Clear
              </button>
            </>
          )}
          <div className="menu__sep" />
          <form
            className="menu__form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="field"
              placeholder="New option"
              aria-label={`New ${property.name} option`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn btn--blue" type="submit">
              Add
            </button>
          </form>
        </Popover>
      )}
    </>
  );
}
