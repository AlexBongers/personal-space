import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardView from "../components/BoardView";
import type { Database, Row } from "shared/types";

const mockProperties = [
  {
    id: "status",
    name: "Status",
    type: "select" as const,
    options: [
      { id: "opt1", value: "Backlog", color: "gray" },
      { id: "opt2", value: "In Progress", color: "blue" },
      { id: "opt3", value: "Done", color: "green" },
    ],
  },
  { id: "priority", name: "Priority", type: "select" as const, options: [
    { id: "p1", value: "High", color: "#ecad0a" },
  ]},
  { id: "due_date", name: "Due Date", type: "date" as const },
  {
    id: "tags",
    name: "Tags",
    type: "multi-select" as const,
    options: [
      { id: "t1", value: "Frontend", color: "blue" },
      { id: "t2", value: "Backend", color: "green" },
      { id: "t3", value: "Design", color: "purple" },
    ],
  },
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
  { id: "r1", databaseId: "db1", pageId: "p1", title: "Design onboarding", index: 1, data: { status: "In Progress", priority: "High", due_date: "2025-04-15", tags: "Frontend,Backend" }, createdAt: "", updatedAt: "" },
  { id: "r2", databaseId: "db1", pageId: "p2", title: "Setup CI/CD", index: 2, data: { status: "Done", priority: "", due_date: "2025-03-20", tags: "" }, createdAt: "", updatedAt: "" },
  { id: "r3", databaseId: "db1", pageId: "p3", title: "Write docs", index: 3, data: { status: "Backlog", due_date: "" }, createdAt: "", updatedAt: "" },
  { id: "r4", databaseId: "db1", pageId: "p4", title: "Unassigned task", index: 4, data: {}, createdAt: "", updatedAt: "" },
];

vi.mock("../api", () => ({
  updateRow: vi.fn().mockResolvedValue({}),
}));

describe("BoardView", () => {
  let onRowsChanged: ReturnType<typeof vi.fn>;
  let onOpenRow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onRowsChanged = vi.fn();
    onOpenRow = vi.fn();
  });

  function renderBoard(groupField: string | null = "status") {
    return render(
      <BoardView
        database={mockDatabase}
        rows={mockRows}
        groupField={groupField}
        onRowsChanged={onRowsChanged}
        onOpenRow={onOpenRow}
      />
    );
  }

  it("shows message when no group field", () => {
    renderBoard(null);
    expect(screen.getByText(/Choose a Select or Multi-select property/i)).toBeInTheDocument();
  });

  it("shows message for non-select group field", () => {
    renderBoard("due_date");
    expect(screen.getByText(/Choose a Select or Multi-select property/i)).toBeInTheDocument();
  });

  it("renders board columns grouped by select property", () => {
    renderBoard();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows row cards under each column", () => {
    renderBoard();
    expect(screen.getByText("Design onboarding")).toBeInTheDocument();
    expect(screen.getByText("Setup CI/CD")).toBeInTheDocument();
    expect(screen.getByText("Write docs")).toBeInTheDocument();
  });

  it("shows 'No Status' column for ungrouped rows", () => {
    renderBoard();
    expect(screen.getByText("No Status")).toBeInTheDocument();
    expect(screen.getByText("Unassigned task")).toBeInTheDocument();
  });

  it("shows column count", () => {
    renderBoard();
    // ColumnCount elements should exist for each column
    const counts = document.querySelectorAll('[class*="columnCount"]');
    expect(counts.length).toBe(4);
  });

  it("renders card priority badges", () => {
    renderBoard("status");
    // r1 has priority "High" and data includes it
    const badges = document.querySelectorAll('[class*="cardBadge"]');
    expect(badges.length).toBeGreaterThan(0);
  });

  it("renders card date badges", () => {
    renderBoard("status");
    // r1 has due_date 2025-04-15, r2 has 2025-03-20
    expect(screen.getByText("2025-04-15")).toBeInTheDocument();
    expect(screen.getByText("2025-03-20")).toBeInTheDocument();
  });

  it("groups rows correctly for multi-select", () => {
    renderBoard("tags");
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    // r1 has both Frontend and Backend
    // r1 should appear under Frontend and Backend columns
  });

  it("shows Untitled for rows without title", () => {
    renderBoard();
    expect(screen.getByText("Design onboarding")).toBeInTheDocument();
  });

  it("clicking a card calls onOpenRow", async () => {
    // Mock elementFromPoint for the pointer up handler
    const origFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => null;
    renderBoard();
    await userEvent.click(screen.getByText("Design onboarding"));
    expect(onOpenRow).toHaveBeenCalledWith(mockRows[0]);
    document.elementFromPoint = origFromPoint;
  });
});
