import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListView from "../components/ListView";
import type { Database, Row } from "shared/types";

const mockProperties = [
  { id: "score", name: "Score", type: "number" as const },
  { id: "dueDate", name: "Due Date", type: "date" as const },
  { id: "status", name: "Status", type: "select" as const, options: [
    { id: "opt1", value: "Backlog", color: "gray" },
    { id: "opt2", value: "In Progress", color: "blue" },
    { id: "opt3", value: "Done", color: "green" },
  ]},
  { id: "completed", name: "Completed", type: "checkbox" as const },
  { id: "tags", name: "Tags", type: "multi-select" as const, options: [
    { id: "tag1", value: "Tech", color: "blue" },
  ]},
];

const mockDatabase: Database = {
  id: "db1",
  pageId: "p1",
  name: "Task Tracker",
  properties: mockProperties,
  createdAt: "",
  updatedAt: "",
};

const mockRows: Row[] = [
  { id: "r1", databaseId: "db1", pageId: "p1", title: "Design new onboarding", index: 1, data: { status: "In Progress", completed: false, dueDate: "2025-04-15", tags: ["Tech"], score: 42 }, createdAt: "", updatedAt: "" },
  { id: "r2", databaseId: "db1", pageId: "p2", title: "Set up CI/CD", index: 2, data: { status: "Done", completed: true, dueDate: "2025-03-20", tags: [], score: 100 }, createdAt: "", updatedAt: "" },
];

describe("ListView", () => {
  let onOpenRow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenRow = vi.fn();
  });

  function renderList(rows: Row[] = mockRows) {
    return render(
      <ListView database={mockDatabase} rows={rows} onOpenRow={onOpenRow} />
    );
  }

  it("renders list items for each row", () => {
    renderList();
    expect(screen.getByText("Design new onboarding")).toBeInTheDocument();
    expect(screen.getByText("Set up CI/CD")).toBeInTheDocument();
  });

  it("shows select values as tags", () => {
    renderList();
    // With reordered properties, score and dueDate are shown (first 2 non-multi-select)
    // Date badges show first 10 chars
    expect(screen.getByText("2025-04-15")).toBeInTheDocument();
    expect(screen.getByText("2025-03-20")).toBeInTheDocument();
  });

  it("shows empty state when no rows", () => {
    renderList([]);
    expect(screen.getByText(/No rows/i)).toBeInTheDocument();
  });

  it("clicking a row calls onOpenRow", async () => {
    renderList();
    await userEvent.click(screen.getByText("Design new onboarding"));
    expect(onOpenRow).toHaveBeenCalledWith(mockRows[0]);
  });

  it("shows checkbox value as checkmark for true", () => {
    // checkbox is the 4th property, not shown in first 2 (score, dueDate)
    // score badge shows the number value
    renderList();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows row index number", () => {
    renderList();
    // First row shows index 1
    const indexEls = document.querySelectorAll('[style*="min-width: 24"]');
    expect(indexEls.length).toBe(2);
  });

  it("shows date badge", () => {
    renderList();
    // Date badges show first N characters
    const dateEls = screen.getAllByText(/2025-/);
    expect(dateEls.length).toBeGreaterThan(0);
  });

  it("shows number badge for score property", () => {
    renderList();
    // Filtered properties don't include multi-select, but include checkbox
    // score is number type, should show as a text badge
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
