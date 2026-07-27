import type { DatabaseDetail, ViewKind } from '@shared';
import { useStored } from '../hooks.ts';
import { applyView, groupRows } from '../query.ts';
import { useDatabase } from '../useDatabase.ts';
import { BoardView } from './BoardView.tsx';
import { ListView } from './ListView.tsx';
import { TableView } from './TableView.tsx';
import { ViewToolbar } from './ViewToolbar.tsx';

interface DatabaseViewProps {
  detail: DatabaseDetail;
  onOpenRow: (id: string) => void;
}

export function DatabaseView({ detail, onOpenRow }: DatabaseViewProps) {
  const store = useDatabase(detail);
  const [kind, setKind] = useStored<ViewKind>(`ps.view.${detail.page.id}`, 'table');

  const view = store.views.find((v) => v.kind === kind) ?? store.views[0];
  const visible = applyView(store.rows, store.properties, view.filters, view.sort);
  const grouping = store.properties.find((p) => p.id === view.groupPropertyId) ?? null;

  return (
    <section className="database" data-testid="database">
      <ViewToolbar
        views={store.views}
        view={view}
        properties={store.properties}
        visibleCount={visible.length}
        totalCount={store.rows.length}
        onSwitch={setKind}
        onPatch={(patch) => store.patchView(view.id, patch)}
      />

      {view.kind === 'table' && <TableView store={store} rows={visible} onOpenRow={onOpenRow} />}
      {view.kind === 'board' && (
        <BoardView
          store={store}
          columns={groupRows(visible, grouping)}
          grouping={grouping}
          onOpenRow={onOpenRow}
        />
      )}
      {view.kind === 'list' && (
        <ListView rows={visible} properties={store.properties} onOpenRow={onOpenRow} />
      )}
    </section>
  );
}
