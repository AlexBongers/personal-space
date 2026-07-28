import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DatabaseView from "../pages/DatabaseView";
import type { Database, View, Row } from "shared/types";

const mockProperties = [
  {
    id: "status",
    name: "Status",
    type: "select",
    options: [
      { id: "opt1", value: "Backlog", color: "gray" },
      { id: "opt2", value: "In Progress", color: "blue" },
    ],
  },
  { id: "completed", name: "Completed", type: "checkbox" },
];

const mockDatabase: Database = {
  id: "db1",
  pageId: "page1",
  name: "Task Tracker",
  properties: mockProperties,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockRows: Row[] = [
  {
    id: "r1",
    databaseId: "db1",
    pageId: "p1",
    title: "Task 1",
    data: { status: "In Progress", completed: false },
    index: 1,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "r2",
    databaseId: "db1",
    pageId: "p2",
    title: "Task 2",
    data: { status: "Backlog", completed: true },
    index: 2,
    createdAt: "",
    updatedAt: "",
  },
];

const mockViews: View[] = [
  {
    id: "v1",
    databaseId: "db1",
    type: "table" as const,
    name: "Table View",
    filters: [],
    sortField: null,
    sortDirection: "asc" as const,
    groupField: null,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "v2",
    databaseId: "db1",
    type: "board" as const,
    name: "Board View",
    filters: [],
    sortField: null,
    sortDirection: "asc" as const,
    groupField: "status",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "v3",
    databaseId: "db1",
    type: "list" as const,
    name: "List View",
    filters: [],
    sortField: null,
    sortDirection: "asc" as const,
    groupField: null,
    createdAt: "",
    updatedAt: "",
  },
];

vi.mock("../api", () => ({
  getViews: vi.fn().mockResolvedValue([
    {
      id: "v1", databaseId: "db1", type: "table" as const, name: "Table View",
      filters: [], sortField: null, sortDirection: "asc" as const, groupField: null,
      createdAt: "", updatedAt: "",
    },
    {
      id: "v2", databaseId: "db1", type: "board" as const, name: "Board View",
      filters: [], sortField: null, sortDirection: "asc" as const, groupField: "status",
      createdAt: "", updatedAt: "",
    },
    {
      id: "v3", databaseId: "db1", type: "list" as const, name: "List View",
      filters: [], sortField: null, sortDirection: "asc" as const, groupField: null,
      createdAt: "", updatedAt: "",
    },
  ]),
  getRows: vi.fn().mockResolvedValue([
    {
      id: "r1", databaseId: "db1", pageId: "p1", title: "Task 1",
      data: { status: "In Progress", completed: false }, index: 1,
      createdAt: "", updatedAt: "",
    },
    {
      id: "r2", databaseId: "db1", pageId: "p2", title: "Task 2",
      data: { status: "Backlog", completed: true }, index: 2,
      createdAt: "", updatedAt: "",
    },
  ]),
  getFilteredRows: vi.fn().mockResolvedValue([
    {
      id: "r1", databaseId: "db1", pageId: "p1", title: "Task 1",
      data: { status: "In Progress", completed: false }, index: 1,
      createdAt: "", updatedAt: "",
    },
  ]),
  updateView: vi.fn().mockResolvedValue({}),
  updateRow: vi.fn().mockResolvedValue({}),
  createRow: vi.fn().mockResolvedValue({}),
  deleteRow: vi.fn().mockResolvedValue(undefined),
  updateProperties: vi.fn().mockResolvedValue({}),
  addSelectOption: vi.fn().mockResolvedValue({}),
  updateSelectOption: vi.fn().mockResolvedValue({}),
  deleteSelectOption: vi.fn().mockResolvedValue(undefined),
  createView: vi.fn().mockImplementation((_dbId, data: Partial<View>) =>
    Promise.resolve({
      id: "v_" + data.type,
      databaseId: "db1",
      ...data,
      createdAt: "",
      updatedAt: "",
    } as View)
  ),
  getBlocks: vi.fn().mockResolvedValue([]),
}));

describe("DatabaseView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the view switcher after loading", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText("Table View")).toBeInTheDocument();
    });
  });

  it("renders views after data loads", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText("Table View")).toBeInTheDocument();
      expect(screen.getByText("Board View")).toBeInTheDocument();
      expect(screen.getByText("List View")).toBeInTheDocument();
    });
  });

  it("shows row count and property count", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText(/2 rows/)).toBeInTheDocument();
      expect(screen.getByText(/2 properties/)).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    render(<DatabaseView database={mockDatabase} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("switches to board view when clicking board tab", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText("Board View")).toBeInTheDocument();
    });
    const { getFilteredRows } = await import("../api");
    await userEvent.click(screen.getByText("Board View"));
    await waitFor(() => {
      expect(getFilteredRows).toHaveBeenCalled();
    });
  });

  it("switches to list view when clicking list tab", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText("List View")).toBeInTheDocument();
    });
    const { getFilteredRows } = await import("../api");
    await userEvent.click(screen.getByText("List View"));
    await waitFor(() => {
      expect(getFilteredRows).toHaveBeenCalled();
    });
  });

  it("opens row page when a row is clicked", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText("Task 1")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Task 1"));
    await waitFor(() => {
      expect(screen.getByText(/Back to/)).toBeInTheDocument();
    });
  });

  it("goes back from row page", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText("Task 1")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Task 1"));
    await waitFor(() => {
      expect(screen.getByText(/Back to/)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText(/Back to/));
    await waitFor(() => {
      expect(screen.getByText("Table View")).toBeInTheDocument();
    });
  });

  it("calls onViewChange via filter sort bar", async () => {
    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(screen.getByText("Table View")).toBeInTheDocument();
    });
    const { updateView } = await import("../api");
    vi.mocked(updateView).mockClear();
    await userEvent.click(screen.getByText("Sort"));
    const select = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(select, "__title");
    await waitFor(() => {
      expect(updateView).toHaveBeenCalled();
    });
  });

  it("creates default views when none exist", async () => {
    const { getViews, createView } = await import("../api");
    vi.mocked(getViews).mockRejectedValueOnce(new Error("none"));
    vi.mocked(createView).mockClear();

    render(<DatabaseView database={mockDatabase} />);
    await waitFor(() => {
      expect(createView).toHaveBeenCalledTimes(3);
    });
  });
});
