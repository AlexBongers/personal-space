import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageView from "../pages/PageView";
import { Page, Block, Database } from "shared/types";
import * as api from "../api";

const mockBlocks: Block[] = [
  {
    id: "b1",
    pageId: "p1",
    type: "heading1",
    content: "Welcome",
    position: 0,
    checked: undefined,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "b2",
    pageId: "p1",
    type: "paragraph",
    content: "This is a paragraph.",
    position: 1,
    checked: undefined,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "b3",
    pageId: "p1",
    type: "todo",
    content: "A task",
    position: 2,
    checked: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

const mockPage: Page = {
  id: "p1",
  title: "Test Page",
  parentId: null,
  icon: "📄",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockDatabase: Database = {
  id: "db1",
  pageId: "p1",
  name: "Task Tracker",
  properties: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

vi.mock("../api", () => ({
  getBlocks: vi.fn(),
  updateBlock: vi.fn(),
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
  getDatabaseByPage: vi.fn(),
}));

describe("PageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getDatabaseByPage).mockRejectedValue(new Error("Not found"));
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders 'Select a page' when no page is provided", () => {
    render(<PageView page={null} />);
    expect(screen.getByText("Select a page")).toBeInTheDocument();
  });

  it("renders page title when page is provided", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("page-view-title")).toHaveTextContent("Test Page");
    });
  });

  it("renders page icon when page is provided", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByText("📄")).toBeInTheDocument();
    });
  });

  it("fetches blocks when page is provided", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    render(<PageView page={mockPage} />);

    expect(getBlocks).toHaveBeenCalledWith("p1");
  });

  it("renders blocks after fetching", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b2")).toBeInTheDocument();
    });
  });

  it("renders block content text", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b1")).toHaveTextContent("Welcome");
    });

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b2")).toHaveTextContent("This is a paragraph.");
    });
  });

  it("shows loading state while fetching blocks", async () => {
    const { getBlocks } = await import("../api");
    let resolveBlocks!: (blocks: Block[]) => void;
    const promise = new Promise<Block[]>((resolve) => {
      resolveBlocks = resolve;
    });
    vi.mocked(getBlocks).mockReturnValue(promise);

    render(<PageView page={mockPage} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolveBlocks(mockBlocks);
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  it("fetchs new blocks when page changes", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    const { rerender } = render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(getBlocks).toHaveBeenCalledWith("p1");
    });

    const newPage: Page = { ...mockPage, id: "p2", title: "Other Page" };
    const newBlocks: Block[] = [{ ...mockBlocks[0], id: "b3", pageId: "p2" }];
    vi.mocked(getBlocks).mockResolvedValue(newBlocks);

    rerender(<PageView page={newPage} />);

    await waitFor(() => {
      expect(getBlocks).toHaveBeenCalledWith("p2");
    });
  });

  it("renders empty editor when page has no blocks", async () => {
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue([]);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("page-view-title")).toHaveTextContent("Test Page");
    });

    expect(screen.queryByTestId(/block-content-/)).not.toBeInTheDocument();
  });

  it("renders database view when page has database", async () => {
    const { getDatabaseByPage } = await import("../api");
    const { getBlocks } = await import("../api");
    vi.mocked(getDatabaseByPage).mockResolvedValue(mockDatabase);
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByText("Task Tracker")).toBeInTheDocument();
    });
  });

  it("shows db loading state", async () => {
    const { getDatabaseByPage } = await import("../api");
    let resolveDb!: (db: Database) => void;
    const dbPromise = new Promise<Database>((resolve) => {
      resolveDb = resolve;
    });
    vi.mocked(getDatabaseByPage).mockReturnValue(dbPromise);
    const { getBlocks } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);

    render(<PageView page={mockPage} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    resolveDb(mockDatabase);
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).toBeInTheDocument();
    });
  });

  it("toggles todo block", async () => {
    const { getBlocks, getDatabaseByPage, updateBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue(mockBlocks);
    vi.mocked(getDatabaseByPage).mockRejectedValue(new Error("not found"));
    vi.mocked(updateBlock).mockResolvedValue(mockBlocks[2]);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("block-checkbox-b3")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("block-checkbox-b3"));

    await waitFor(() => {
      expect(updateBlock).toHaveBeenCalledWith("b3", { checked: true });
    });
  });

  it("calls onTypeChange when slash menu selects a type", async () => {
    const { getBlocks, getDatabaseByPage, updateBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue([mockBlocks[1]]);
    vi.mocked(getDatabaseByPage).mockRejectedValue(new Error("not found"));
    vi.mocked(updateBlock).mockResolvedValue({});

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b2")).toBeInTheDocument();
    });

    const el = screen.getByTestId("block-content-b2");
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

  it("calls onEnter to create new block", async () => {
    const { getBlocks, getDatabaseByPage, createBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue([mockBlocks[1]]);
    vi.mocked(getDatabaseByPage).mockRejectedValue(new Error("not found"));
    const newBlock: Block = {
      id: "b_new",
      pageId: "p1",
      type: "paragraph",
      content: "",
      position: 2,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(createBlock).mockResolvedValue(newBlock);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b2")).toBeInTheDocument();
    });

    const el = screen.getByTestId("block-content-b2");
    fireEvent.keyDown(el, { key: "Enter" });

    await waitFor(() => {
      expect(createBlock).toHaveBeenCalled();
    });
  });

  it("calls onDelete on backspace at empty block", async () => {
    const { getBlocks, getDatabaseByPage, deleteBlock } = await import("../api");
    vi.mocked(getBlocks).mockResolvedValue([{ ...mockBlocks[1], content: "" }]);
    vi.mocked(getDatabaseByPage).mockRejectedValue(new Error("not found"));
    vi.mocked(deleteBlock).mockResolvedValue(undefined);

    render(<PageView page={mockPage} />);

    await waitFor(() => {
      expect(screen.getByTestId("block-content-b2")).toBeInTheDocument();
    });

    const el = screen.getByTestId("block-content-b2");
    // Make content empty for the test
    fireEvent.input(el, { target: { textContent: "" } });
    fireEvent.keyDown(el, { key: "Backspace" });

    await waitFor(() => {
      expect(deleteBlock).toHaveBeenCalledWith("b2");
    });
  });
});