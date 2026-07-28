import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TableView from "../components/TableView";
import type { Row, Property, Database } from "shared/types";

const mockProperties: Property[] = [
  { id: "status", name: "Status", type: "select", options: [
    { id: "opt1", value: "Backlog", color: "gray" },
    { id: "opt2", value: "In Progress", color: "blue" },
    { id: "opt3", value: "Done", color: "green" },
  ]},
  { id: "priority", name: "Priority", type: "select", options: [
    { id: "opt4", value: "High", color: "red" },
    { id: "opt5", value: "Medium", color: "amber" },
  ]},
  { id: "dueDate", name: "Due Date", type: "date" },
  { id: "completed", name: "Completed", type: "checkbox" },
  { id: "url", name: "URL", type: "url" },
  { id: "score", name: "Score", type: "number" },
  { id: "tags", name: "Tags", type: "multi-select", options: [
    { id: "opt6", value: "Frontend", color: "blue" },
    { id: "opt7", value: "Backend", color: "green" },
  ]},
];

const mockRows: Row[] = [
  {
    id: "r1",
    databaseId: "db1",
    pageId: "p1",
    title: "Design new onboarding",
    index: 1,
    data: {
      status: "In Progress",
      priority: "High",
      dueDate: "2025-04-15",
      completed: false,
      url: "https://figma.com/file",
      score: 42,
      tags: ["Frontend"],
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "r2",
    databaseId: "db1",
    pageId: "p2",
    title: "Set up CI/CD",
    index: 2,
    data: {
      status: "Done",
      priority: "High",
      dueDate: "2025-03-20",
      completed: true,
      url: "",
      score: 100,
      tags: ["Frontend", "Backend"],
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

const mockDatabase: Database = {
  id: "db1",
  pageId: "page1",
  name: "Task Tracker",
  properties: mockProperties,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

vi.mock("../api", () => ({
  updateRow: vi.fn().mockResolvedValue({}),
  createRow: vi.fn().mockResolvedValue({ id: "r3", title: "Untitled" }),
  deleteRow: vi.fn().mockResolvedValue(undefined),
  updateProperties: vi.fn().mockResolvedValue({}),
  addSelectOption: vi.fn(),
  deleteSelectOption: vi.fn(),
}));

describe("TableView", () => {
  let onRowsChanged: ReturnType<typeof vi.fn>;
  let onDatabaseChanged: ReturnType<typeof vi.fn>;
  let onOpenRow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onRowsChanged = vi.fn();
    onDatabaseChanged = vi.fn();
    onOpenRow = vi.fn();
  });

  function renderTable() {
    return render(
      <TableView
        database={mockDatabase}
        rows={mockRows}
        onRowsChanged={onRowsChanged}
        onDatabaseChanged={onDatabaseChanged}
        onOpenRow={onOpenRow}
      />
    );
  }

  it("renders rows in a table", () => {
    renderTable();
    expect(screen.getByText("Design new onboarding")).toBeInTheDocument();
    expect(screen.getByText("Set up CI/CD")).toBeInTheDocument();
  });

  it("renders property headers", () => {
    renderTable();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Due Date")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("renders row index numbers", () => {
    renderTable();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("clicking 'New Row' creates a row", async () => {
    const { createRow } = await import("../api");
    renderTable();
    const newRowBtn = screen.getByText("New Row");
    await userEvent.click(newRowBtn);
    await waitFor(() => {
      expect(createRow).toHaveBeenCalledWith("db1", { title: "Untitled" });
    });
    expect(onRowsChanged).toHaveBeenCalled();
  });

  it("clicking delete removes a row", async () => {
    const { deleteRow } = await import("../api");
    renderTable();
    const deleteBtns = screen.getAllByTitle("Delete row");
    await userEvent.click(deleteBtns[0]);
    await waitFor(() => {
      expect(deleteRow).toHaveBeenCalledWith("r1");
    });
    expect(onRowsChanged).toHaveBeenCalled();
  });

  it("clicking '+' opens property editor", async () => {
    renderTable();
    const addBtn = screen.getByTitle("Add property");
    await userEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Property" })).toBeInTheDocument();
    });
  });

  it("closes property editor when clicking Cancel", async () => {
    renderTable();
    const addBtn = screen.getByTitle("Add property");
    await userEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Property" })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add Property" })).not.toBeInTheDocument();
    });
  });

  it("renders checkbox for checkbox-type cells", () => {
    renderTable();
    const checkboxes = document.querySelectorAll('[class*="checkboxInput"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it("renders select tags for select-type cells", () => {
    renderTable();
    const selectTags = document.querySelectorAll('[class*="selectTag"]');
    expect(selectTags.length).toBeGreaterThan(0);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    const highTags = screen.getAllByText("High");
    expect(highTags.length).toBe(2);
  });

  it("renders url links for url-type cells", () => {
    renderTable();
    const link = screen.getByText("https://figma.com/file");
    expect(link.tagName).toBe("A");
  });

  it("renders date values for date-type cells", () => {
    renderTable();
    expect(screen.getByText("2025-04-15")).toBeInTheDocument();
    expect(screen.getByText("2025-03-20")).toBeInTheDocument();
  });

  it("renders number values for number-type cells", () => {
    renderTable();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders multi-select tags for multi-select-type cells", () => {
    renderTable();
    const frontendTags = screen.getAllByText("Frontend");
    expect(frontendTags.length).toBe(2);
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("editing a text cell shows an input", async () => {
    renderTable();
    const emptySpans = screen.getAllByText("Empty");
    const urlEmptyCell = emptySpans.find(
      (el) => el.closest('[class*="cell"]') !== null
    );
    expect(urlEmptyCell).toBeDefined();
    await userEvent.click(urlEmptyCell!);
    const inputs = document.querySelectorAll('[class*="cellInput"]');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("clicking checkbox toggles the value", async () => {
    const { updateRow } = await import("../api");
    renderTable();
    const checkboxes = document.querySelectorAll('[class*="checkboxInput"]');
    await userEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(updateRow).toHaveBeenCalled();
    });
  });

  it("clicking row title calls onOpenRow", async () => {
    renderTable();
    const titleSpan = screen.getByText("Design new onboarding");
    await userEvent.click(titleSpan);
    expect(onOpenRow).toHaveBeenCalledWith(mockRows[0]);
  });

  it("opens select dropdown when clicking a select cell", async () => {
    renderTable();
    // Find select cell for Status column (In Progress)
    const statusCell = screen.getByText("In Progress");
    await userEvent.click(statusCell);
    // Dropdown should appear with options
    await waitFor(() => {
      const dropdown = document.querySelector('[class*="selectDropdown"]');
      expect(dropdown).toBeInTheDocument();
    });
  });

  it("opens multi-select dropdown when clicking a multi-select cell", async () => {
    renderTable();
    const tags = screen.getAllByText("Frontend");
    await userEvent.click(tags[0]);
    await waitFor(() => {
      const dropdown = document.querySelector('[class*="selectDropdown"]');
      expect(dropdown).toBeInTheDocument();
    });
  });

  it("closes multi-select dropdown when clicking outside", async () => {
    renderTable();
    const tags = screen.getAllByText("Frontend");
    await userEvent.click(tags[0]);
    await waitFor(() => {
      const dropdown = document.querySelector('[class*="selectDropdown"]');
      expect(dropdown).toBeInTheDocument();
    });
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      const dropdown = document.querySelector('[class*="selectDropdown"]');
      expect(dropdown).not.toBeInTheDocument();
    });
  });

  it("starts editing date cell on click", async () => {
    renderTable();
    const dateCell = screen.getByText("2025-04-15");
    await userEvent.click(dateCell);
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThan(0);
  });

  it("starts editing number cell on click", async () => {
    renderTable();
    const numCell = screen.getByText("42");
    await userEvent.click(numCell);
    const numInputs = document.querySelectorAll('input[type="number"]');
    expect(numInputs.length).toBeGreaterThan(0);
  });

  it("opens property rename on header rename click", async () => {
    renderTable();
    const renameBtns = screen.getAllByTitle("Rename");
    await userEvent.click(renameBtns[0]);
    // An input should appear for rename
    await waitFor(() => {
      const renameInputs = document.querySelectorAll('[class*="headerRename"]');
      expect(renameInputs.length).toBeGreaterThan(0);
    });
  });

  it("deletes property on header delete click", async () => {
    const { updateProperties } = await import("../api");
    vi.mocked(updateProperties).mockResolvedValue({
      ...mockDatabase,
      properties: mockProperties.slice(1),
    });

    renderTable();
    const removeBtns = screen.getAllByTitle("Remove property");
    // Click the first remove button (Status)
    await userEvent.click(removeBtns[0]);

    await waitFor(() => {
      expect(updateProperties).toHaveBeenCalled();
    });
  });

  it("adds property via property editor", async () => {
    const { updateProperties } = await import("../api");
    const mockDb: Database = {
      ...mockDatabase,
      properties: [...mockProperties, { id: "new_p", name: "New Prop", type: "text" }],
    };
    vi.mocked(updateProperties).mockResolvedValue(mockDb);

    renderTable();

    const addBtn = screen.getByTitle("Add property");
    await userEvent.click(addBtn);

    // Wait for modal to appear with the title
    const submitBtn = await screen.findByRole("button", { name: "Add Property" });
    expect(submitBtn).toBeInTheDocument();

    const modal = screen.getByTestId("modal-dialog");
    const nameInput = within(modal).getByPlaceholderText("Property name...");
    await userEvent.type(nameInput, "New Prop");
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateProperties).toHaveBeenCalled();
    });
  });
});