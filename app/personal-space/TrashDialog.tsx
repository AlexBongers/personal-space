"use client";

import { useLanguage } from "./i18n";

export type TrashDialogEntry = {
  id: string;
  title: string;
  kind: string;
  deletedAt: string;
  descendantCount: number;
  batchId: string;
};

type TrashDialogProps = {
  entries: TrashDialogEntry[];
  onRestore: (batchId: string) => void;
  onPurge: (batchId: string) => void;
  onClose: () => void;
};

/** Presentation-only trash surface. Mutations stay with the page controller. */
export function TrashDialog({ entries, onRestore, onPurge, onClose }: TrashDialogProps) {
  const { t } = useLanguage();
  return (
    <div className="google-tasks-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="google-tasks-dialog trash-dialog" role="dialog" aria-modal="true" aria-labelledby="trash-dialog-title">
        <div className="google-tasks-heading">
          <div>
            <span className="page-kicker">{t("workspaceActions.trash")}</span>
            <h2 id="trash-dialog-title">{t("trash.title")}</h2>
          </div>
          <button className="dialog-close" aria-label={t("workspaceActions.close")} onClick={onClose}>×</button>
        </div>
        {!entries.length && <p className="google-tasks-muted">{t("trash.empty")}</p>}
        {entries.length > 0 && (
          <ul className="trash-list">
            {entries.map((entry) => (
              <li className="trash-row" key={entry.batchId}>
                <span className="trash-row-copy"><strong>{entry.title}</strong><small>{entry.kind} · {entry.deletedAt} · {entry.descendantCount}</small></span>
                <span className="trash-row-actions">
                  <button type="button" className="small-button" onClick={() => onRestore(entry.batchId)}>{t("trash.restore")}</button>
                  <button type="button" className="quiet-danger-button" onClick={() => onPurge(entry.batchId)}>{t("trash.purge")}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
