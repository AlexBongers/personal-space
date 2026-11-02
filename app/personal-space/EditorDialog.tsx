"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLanguage } from "./i18n";

type EditorDialogProps = {
  title: string;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
  onOpenDetails?: () => void;
  children: ReactNode;
};

/**
 * The shared shell of the task and appointment editors: a compact dialog above the list or calendar.
 * Escape cancels, Cmd/Ctrl+Enter saves, and clicking outside cancels.
 */
export function EditorDialog({ title, canSave, onSave, onClose, onDelete, onOpenDetails, children }: EditorDialogProps) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLFormElement>(null);

  useEffect(() => {
    dialog.current?.querySelector<HTMLInputElement>("[data-autofocus]")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", keys, true);
    return () => window.removeEventListener("keydown", keys, true);
  }, [onClose]);

  return (
    <div className="editor-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form
        ref={dialog}
        className="editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event) => { event.preventDefault(); if (canSave) onSave(); }}
        onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSave) { event.preventDefault(); onSave(); } }}
      >
        <div className="editor-dialog-header">
          <span className="editor-dialog-title">{title}</span>
          <button type="button" className="dialog-close" aria-label={t("editor.cancel")} onClick={onClose}>×</button>
        </div>
        <div className="editor-dialog-body">{children}</div>
        <div className="editor-dialog-footer">
          {onDelete && <button type="button" className="quiet-danger-button" onClick={onDelete}>{t("editor.delete")}</button>}
          {onOpenDetails && <button type="button" className="text-link-button" onClick={onOpenDetails}>{t("editor.allDetails")}</button>}
          <span className="editor-dialog-spacer" />
          <button type="button" className="small-button" onClick={onClose}>{t("editor.cancel")}</button>
          <button type="submit" className="primary-button" disabled={!canSave} title="⌘↵">{t("editor.save")}</button>
        </div>
      </form>
    </div>
  );
}

/** A row of choices that behaves like radio buttons. */
export function ChoiceChips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="choice-chips" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button type="button" role="radio" aria-checked={option.value === value} className={option.value === value ? "is-selected" : ""} key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>
      ))}
    </div>
  );
}
