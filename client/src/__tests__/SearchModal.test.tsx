import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchModal from "../components/SearchModal";

const mockSearchResults = [
  {
    id: "p1",
    title: "Projects",
    type: "page" as const,
    icon: "📋",
    parentChain: [{ id: "home", title: "Home" }],
  },
  {
    id: "p2",
    title: "Task Tracker",
    type: "page" as const,
    icon: "✅",
    parentChain: [
      { id: "home", title: "Home" },
      { id: "p1", title: "Projects" },
    ],
  },
  {
    id: "r1",
    title: "Design new onboarding flow",
    type: "row" as const,
    icon: "📋",
    parentChain: [
      { id: "home", title: "Home" },
      { id: "p1", title: "Projects" },
      { id: "p2", title: "Task Tracker" },
    ],
  },
];

vi.mock("../api", () => ({
  search: vi.fn(),
}));

describe("SearchModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onNavigateToPage: ReturnType<typeof vi.fn>;
  let onNavigateToRow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onNavigateToPage = vi.fn();
    onNavigateToRow = vi.fn();
  });

  it("renders nothing when closed", () => {
    render(
      <SearchModal
        open={false}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    expect(screen.queryByTestId("search-modal")).not.toBeInTheDocument();
  });

  it("renders search input when open", () => {
    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    expect(screen.getByTestId("search-modal")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search pages, databases, and rows...")).toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    const input = screen.getByTestId("search-input");
    await userEvent.click(input);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when overlay is clicked", async () => {
    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    const overlay = screen.getByTestId("search-overlay");
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows results when API returns data", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue(mockSearchResults);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    const input = screen.getByTestId("search-input");
    await userEvent.type(input, "project");

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith("project");
    });

    await waitFor(() => {
      const results = screen.getAllByTestId("search-result");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows result titles in results list", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue(mockSearchResults);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    const input = screen.getByTestId("search-input");
    await userEvent.type(input, "pro");

    await waitFor(() => {
      const elements = screen.getAllByText("Projects");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText("Design new onboarding flow")).toBeInTheDocument();
  });

  it("shows breadcrumb path", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue(mockSearchResults);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    await userEvent.type(screen.getByTestId("search-input"), "pro");

    await waitFor(() => {
      const elements = screen.getAllByTestId("search-result");
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    const homeElements = screen.getAllByText("Home");
    expect(homeElements.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking a page result navigates to page", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue(mockSearchResults);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    await userEvent.type(screen.getByTestId("search-input"), "pro");

    await waitFor(() => {
      const results = screen.getAllByTestId("search-result");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    const results = screen.getAllByTestId("search-result");
    const projectsResult = results.find((r) =>
      r.querySelector('[class*="resultTitle"]')?.textContent === "Projects"
    );
    expect(projectsResult).toBeDefined();
    await userEvent.click(projectsResult!);

    expect(onNavigateToPage).toHaveBeenCalledWith("p1");
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking a row result navigates to row", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue(mockSearchResults);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    await userEvent.type(screen.getByTestId("search-input"), "design");

    await waitFor(() => {
      expect(screen.getByText("Design new onboarding flow")).toBeInTheDocument();
    });

    const results = screen.getAllByTestId("search-result");
    const rowResult = results.find((r) => r.textContent?.includes("Design new onboarding"));
    expect(rowResult).toBeDefined();
    await userEvent.click(rowResult!);

    expect(onNavigateToRow).toHaveBeenCalledWith("r1");
    expect(onClose).toHaveBeenCalled();
  });

  it("supports keyboard navigation with arrow keys", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue(mockSearchResults);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    const input = screen.getByTestId("search-input");
    await userEvent.type(input, "pro");

    await waitFor(() => {
      const results = screen.getAllByTestId("search-result");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    await userEvent.keyboard("{ArrowDown}");

    const results = screen.getAllByTestId("search-result");
    expect(results[1].className).toContain("highlighted");
  });

  it("Enter on highlighted result navigates", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue(mockSearchResults);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    await userEvent.type(screen.getByTestId("search-input"), "pro");

    await waitFor(() => {
      const results = screen.getAllByTestId("search-result");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    await userEvent.keyboard("{Enter}");

    expect(onNavigateToPage).toHaveBeenCalledWith("p1");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows no results message when query has no matches", async () => {
    const { search } = await import("../api");
    vi.mocked(search).mockResolvedValue([]);

    render(
      <SearchModal
        open={true}
        onClose={onClose}
        onNavigateToPage={onNavigateToPage}
        onNavigateToRow={onNavigateToRow}
      />
    );

    await userEvent.type(screen.getByTestId("search-input"), "zzz");

    await waitFor(() => {
      expect(screen.getByText("No results found")).toBeInTheDocument();
    });
  });
});
