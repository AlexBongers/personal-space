import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RowPage from "../components/RowPage";
import type { Row, Database, Block, Property } from "shared/types";

const mockProperties: Property[] = [
  { id: "status", name: "Status", type: "select", options: [
    { id: "opt1", value: "In Progress", color: "blue" },
  ]},
  { id: "priority", name: "Priority", type: "select", options: [
    { id: "opt2", value: "High", color: "red" },
  ]},
  { id: "dueDate", name: "Due Date", type: "date" },
  { id: "completed", name: "Completed", type: "checkbox" },
  { id: "url", name: "URL", type: "url" },
];

const mockDatabase: Database = {
  id: "db1",
  pageId: "page1",
  name: "Task Tracker",
  properties: mockProperties,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockRow: Row = {
  id: "r1",
  databaseId: "db1",
  pageId: "rp1",
  title: "Design new onboarding",
  index: 1,
  data: {
    status: "In Progress",
    priority: "High",
    dueDate: "2025-04-15",
    completed: false,
    url: "https://figma.com/onboarding",
  },
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockBlocks: Block[] = [
  {
    id: "b1",
    pageId: "rp1",
    type: "paragraph",
    content: "Requirements",
    position: 0,
    checked: undefined,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "b2",
    pageId: "rp1",
    type: "todo",
    content: "Simplify step count",
    position: 1,
    checked: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

vi.mock("../api", () => ({
  getBlocks: vi.fn().mockResolvedValue([]),
  updateBlock: vi.fn(),
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
}));

describe("RowPage", () => {
  let onBack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onBack = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderRowPage(row: Row = mockRow, db: Database = mockDatabase) {
    return render(
      <RowPage row={row} database={db} onBack={onBack} />
    );
  }

  it("renders row title", () => {
    renderRowPage();
    expect(screen.getByText("Design new onboarding")).toBeInTheDocument();
  });

  it("renders properties section", () => {
    renderRowPage();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Due Date")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("URL")).toBeInTheDocument();
  });

  it("renders property values", () => {
    renderRowPage();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("2025-04-15")).toBeInTheDocument();
    expect(screen.getByText("☐ No")).toBeInTheDocument();
    expect(screen.getByText("https://figma.com/onboarding")).toBeInTheDocument();
  });

  it("shows back button", () => {
    renderRowPage();
    expect(screen.getByText("← Back to Task Tracker")).toBeInTheDocument();
  });

  it("clicking back calls onBack", async () => {
    renderRowPage();
    const backBtn = screen.getByText("← Back to Task Tracker");
    await userEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("fetches blocks when pageId exists", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    renderRowPage();

    expect(getBlocks).toHaveBeenCalledWith("rp1");

    await waitFor(() => {
      expect(screen.getByText("Requirements")).toBeInTheDocument();
    });
  });

  it("renders blocks content after fetching", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    renderRowPage();

    await waitFor(() => {
      expect(screen.getByText("Simplify step count")).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching blocks", async () => {
    const { getBlocks } = await import("../api");
    let resolveBlocks!: (blocks: Block[]) => void;
    const promise = new Promise<Block[]>((resolve) => {
      resolveBlocks = resolve;
    });
    vi.mocked(getBlocks).mockReturnValue(promise);

    renderRowPage();

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolveBlocks(mockBlocks);
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  it("shows error message when pageId is missing", () => {
    const rowWithoutPage: Row = {
      ...mockRow,
      pageId: undefined,
    };

    render(
      <RowPage row={rowWithoutPage} database={mockDatabase} onBack={onBack} />
    );

    expect(screen.getByText("Unable to load row content.")).toBeInTheDocument();
  });

  it("renders boolean true as Yes", () => {
    const rowWithTrue: Row = {
      ...mockRow,
      data: {
        ...mockRow.data,
        completed: true,
      },
    };

    render(<RowPage row={rowWithTrue} database={mockDatabase} onBack={onBack} />);
    expect(screen.getByText("☑ Yes")).toBeInTheDocument();
  });

  it("renders empty string as Empty", () => {
    const rowWithEmpty: Row = {
      ...mockRow,
      data: {
        ...mockRow.data,
        url: "",
      },
    };

    render(<RowPage row={rowWithEmpty} database={mockDatabase} onBack={onBack} />);
    const emptyElements = screen.getAllByText("Empty");
    expect(emptyElements.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onEnter to create new block", async () => {
    const { getBlocks, createBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);
    const newBlock: Block = {
      id: "b_new",
      pageId: "rp1",
      type: "paragraph",
      content: "",
      position: 2,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(createBlock).mockResolvedValue(newBlock);

    renderRowPage();

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b1")).toBeInTheDocument();
    });

    const el = screen.getByTestId("block-content-b1");
    fireEvent.keyDown(el, { key: "Enter" });

    await waitFor(() => {
      expect(createBlock).toHaveBeenCalled();
    });
  });

  it("calls onDelete on backspace at empty block", async () => {
    const { getBlocks, deleteBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue([{ ...mockBlocks[0], content: "" }]);
    vi.mocked(deleteBlock).mockResolvedValue(undefined);

    renderRowPage();

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b1")).toBeInTheDocument();
    });

    const el = screen.getByTestId("block-content-b1");
    fireEvent.input(el, { target: { textContent: "" } });
    fireEvent.keyDown(el, { key: "Backspace" });

    await waitFor(() => {
      expect(deleteBlock).toHaveBeenCalledWith("b1");
    });
  });

  it("toggles todo block", async () => {
    const { getBlocks, updateBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);
    vi.mocked(updateBlock).mockResolvedValue(mockBlocks[1]);

    renderRowPage();

    await waitFor(() => {
      expect(screen.getByTestId("block-checkbox-b2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("block-checkbox-b2"));

    await waitFor(() => {
      expect(updateBlock).toHaveBeenCalledWith("b2", { checked: true });
    });
  });

  it("calls type change via slash menu", async () => {
    const { getBlocks, updateBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue([mockBlocks[0]]);
    vi.mocked(updateBlock).mockResolvedValue({});

    renderRowPage();

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b1")).toBeInTheDocument();
    });

    const el = screen.getByTestId("block-content-b1");
    fireEvent.input(el, { target: { textContent: "/" } });

    await waitFor(() => {
      const slashMenu = document.querySelector('[class*="slashMenu"]');
      expect(slashMenu).toBeInTheDocument();
    });

    const headingItem = document.querySelector('[data-command="heading1"]');
    if (headingItem) {
      fireEvent.click(headingItem);
      await waitFor(() => {
        expect(updateBlock).toHaveBeenCalled();
      });
    }
  });

  it("handles rename block via save timer", async () => {
    const { getBlocks, updateBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);
    vi.mocked(updateBlock).mockResolvedValue({});

    renderRowPage();

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b1")).toBeInTheDocument();
    });

    const el = screen.getByTestId("block-content-b1");
    fireEvent.input(el, { target: { textContent: "Updated content" } });

    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(updateBlock).toHaveBeenCalledWith("b1", { content: "Updated content" });
    });
  });

  it("renders title as Untitled when missing", () => {
    const rowNoTitle: Row = { ...mockRow, title: "" };
    renderRowPage(rowNoTitle);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("does not render properties section when none exist", () => {
    const dbNoProps: Database = { ...mockDatabase, properties: [] };
    render(<RowPage row={mockRow} database={dbNoProps} onBack={onBack} />);
    expect(screen.queryByText("Properties")).not.toBeInTheDocument();
  });
});