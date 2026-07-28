import { useState, useEffect, useCallback, useMemo } from "react";
import type { Database, Row, View, Filter } from "shared/types";
import * as api from "../api";
import TableView from "../components/TableView";
import BoardView from "../components/BoardView";
import ListView from "../components/ListView";
import ViewSwitcher from "../components/ViewSwitcher";
import FilterSortBar from "../components/FilterSortBar";
import RowPage from "../components/RowPage";

interface DatabaseViewProps {
  database: Database;
}

function applyFilters(rows: Row[], filters: Filter[], properties: Database["properties"]): Row[] {
  if (!filters || filters.length === 0) return rows;

  return rows.filter((row) => {
    return filters.every((f) => {
      const prop = properties.find((p) => p.id === f.field);
      if (!prop) return true;

      const rawVal = row.data ? (row.data as Record<string, unknown>)[f.field] : undefined;

      if (f.operator === "is_empty") {
        return rawVal === null || rawVal === undefined || rawVal === "" || (Array.isArray(rawVal) && rawVal.length === 0) || rawVal === false;
      }
      if (f.operator === "is_not_empty") {
        return !(rawVal === null || rawVal === undefined || rawVal === "" || (Array.isArray(rawVal) && rawVal.length === 0) || rawVal === false);
      }

      const cellStr = rawVal !== null && rawVal !== undefined ? String(rawVal) : "";

      if (prop.type === "select" || prop.type === "multi-select") {
        const vals = prop.type === "select"
          ? [cellStr]
          : cellStr ? cellStr.split(",").map((v) => v.trim()).filter(Boolean) : [];
        if (f.operator === "is") {
          return vals.includes(String(f.value));
        }
        if (f.operator === "is_not") {
          return !vals.includes(String(f.value));
        }
      }

      if (prop.type === "checkbox") {
        const boolVal = Boolean(rawVal);
        if (f.operator === "is") return boolVal === Boolean(f.value);
        if (f.operator === "is_not") return boolVal !== Boolean(f.value);
        return true;
      }

      if (prop.type === "number") {
        const numVal = rawVal !== null && rawVal !== undefined && rawVal !== "" ? Number(rawVal) : NaN;
        const filterVal = Number(f.value);
        if (f.operator === "is") return numVal === filterVal;
        if (f.operator === "is_not") return numVal !== filterVal;
        if (f.operator === "greater_than") return numVal > filterVal;
        if (f.operator === "less_than") return numVal < filterVal;
        if (f.operator === "greater_than_equal") return numVal >= filterVal;
        if (f.operator === "less_than_equal") return numVal <= filterVal;
        return true;
      }

      if (prop.type === "date") {
        const dateVal = cellStr.substring(0, 10);
        const filterVal = String(f.value).substring(0, 10);
        if (f.operator === "is") return dateVal === filterVal;
        if (f.operator === "is_before") return dateVal < filterVal;
        if (f.operator === "is_after") return dateVal > filterVal;
        return true;
      }

      if (f.operator === "is") return cellStr === String(f.value);
      if (f.operator === "is_not") return cellStr !== String(f.value);
      if (f.operator === "contains") return cellStr.toLowerCase().includes(String(f.value).toLowerCase());
      if (f.operator === "does_not_contain") return !cellStr.toLowerCase().includes(String(f.value).toLowerCase());
      if (f.operator === "starts_with") return cellStr.toLowerCase().startsWith(String(f.value).toLowerCase());
      if (f.operator === "ends_with") return cellStr.toLowerCase().endsWith(String(f.value).toLowerCase());

      return true;
    });
  });
}

function applySort(rows: Row[], sortField: string | null, sortDirection: "asc" | "desc", properties: Database["properties"]): Row[] {
  if (!sortField) return rows;

  return [...rows].sort((a, b) => {
    let aVal: string;
    let bVal: string;

    if (sortField === "__title") {
      aVal = a.title || "";
      bVal = b.title || "";
    } else {
      const aRaw = a.data ? (a.data as Record<string, unknown>)[sortField] : undefined;
      const bRaw = b.data ? (b.data as Record<string, unknown>)[sortField] : undefined;
      aVal = aRaw !== null && aRaw !== undefined ? String(aRaw) : "";
      bVal = bRaw !== null && bRaw !== undefined ? String(bRaw) : "";
    }

    const prop = properties.find((p) => p.id === sortField);
    if (prop && prop.type === "number") {
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }
    }

    return sortDirection === "asc"
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  });
}

export default function DatabaseView({ database }: DatabaseViewProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<Database>(database);
  const [views, setViews] = useState<View[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) || null,
    [views, activeViewId]
  );

  const fetchRows = useCallback(async () => {
    try {
      const data = await api.getRows(database.id);
      setRows(data);
    } catch (err) {
      console.error("Failed to fetch rows:", err);
    } finally {
      setLoading(false);
    }
  }, [database.id]);

  const fetchViews = useCallback(async () => {
    try {
      const data = await api.getViews(database.id);
      setViews(data);
      if (data.length > 0 && !activeViewId) {
        setActiveViewId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch views:", err);
      createDefaultViews();
    }
  }, [database.id]);

  const createDefaultViews = useCallback(async () => {
    try {
      const table = await api.createView(database.id, {
        type: "table",
        name: "Table View",
        filters: [],
        sortField: null,
        sortDirection: "asc",
        groupField: null,
      });
      const board = await api.createView(database.id, {
        type: "board",
        name: "Board View",
        filters: [],
        sortField: null,
        sortDirection: "asc",
        groupField: null,
      });
      const list = await api.createView(database.id, {
        type: "list",
        name: "List View",
        filters: [],
        sortField: null,
        sortDirection: "asc",
        groupField: null,
      });
      const newViews = [table, board, list];
      setViews(newViews);
      if (!activeViewId) {
        setActiveViewId(newViews[0].id);
      }
    } catch (err) {
      console.error("Failed to create default views:", err);
    }
  }, [database.id]);

  useEffect(() => {
    fetchRows();
    fetchViews();
  }, [fetchRows, fetchViews]);

  useEffect(() => {
    setDb(database);
  }, [database]);

  const handleDatabaseChanged = useCallback((updated: Database) => {
    setDb(updated);
  }, []);

  const handleOpenRow = useCallback((row: Row) => {
    setSelectedRow(row);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedRow(null);
    fetchRows();
  }, [fetchRows]);

  const handleSwitchView = useCallback(
    async (view: View) => {
      setActiveViewId(view.id);
      try {
        const data = await api.getFilteredRows(database.id, {
          sortField: view.sortField || undefined,
          sortDir: view.sortDirection,
        });
        setRows(data);
      } catch {
        fetchRows();
      }
    },
    [database.id, fetchRows]
  );

  const handleViewChange = useCallback(
    async (updatedView: View) => {
      setViews((prev) => prev.map((v) => (v.id === updatedView.id ? updatedView : v)));
      try {
        await api.updateView(updatedView.id, {
          filters: updatedView.filters,
          sortField: updatedView.sortField,
          sortDirection: updatedView.sortDirection,
          groupField: updatedView.groupField,
        });
      } catch (err) {
        console.error("Failed to save view:", err);
      }
    },
    []
  );

  const filteredRows = useMemo(() => {
    if (!activeView) return rows;
    let result = applyFilters(rows, activeView.filters, db.properties);
    result = applySort(result, activeView.sortField, activeView.sortDirection, db.properties);
    return result;
  }, [rows, activeView, db.properties]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "16px 32px 0", maxWidth: "100%", margin: "0 auto", width: "100%" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            {database.name}
          </h1>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Loading...
        </div>
      </div>
    );
  }

  if (selectedRow) {
    return (
      <RowPage
        row={selectedRow}
        database={db}
        onBack={handleBack}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 32px 0", flexShrink: 0 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          {database.name}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {(database.properties || []).length} propert{(database.properties || []).length !== 1 ? "ies" : "y"}
          </span>
        </div>
      </div>

      <ViewSwitcher
        views={views}
        activeViewId={activeViewId}
        onSwitchView={handleSwitchView}
      />

      <div
        style={{
          padding: "4px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          minHeight: 40,
        }}
      >
        {activeView && (
          <FilterSortBar
            database={db}
            view={activeView}
            onViewChange={handleViewChange}
          />
        )}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!activeView ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No view selected
          </div>
        ) : activeView.type === "table" ? (
          <div style={{ padding: "0 16px 16px", flex: 1, overflow: "hidden", display: "flex" }}>
            <TableView
              database={db}
              rows={filteredRows}
              onRowsChanged={fetchRows}
              onDatabaseChanged={handleDatabaseChanged}
              onOpenRow={handleOpenRow}
            />
          </div>
        ) : activeView.type === "board" ? (
          <BoardView
            database={db}
            rows={filteredRows}
            groupField={activeView.groupField}
            onRowsChanged={fetchRows}
            onOpenRow={handleOpenRow}
          />
        ) : activeView.type === "list" ? (
          <ListView
            database={db}
            rows={filteredRows}
            onOpenRow={handleOpenRow}
          />
        ) : null}
      </div>
    </div>
  );
}
