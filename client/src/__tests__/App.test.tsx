import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

vi.mock("../api", () => ({
  getPages: vi.fn().mockResolvedValue([
    { id: "p1", title: "Home", parentId: null, icon: "🏠", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "p2", title: "Projects", parentId: null, icon: "📋", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  ]),
  getRowByRowId: vi.fn().mockResolvedValue({ pageId: "p1" }),
  search: vi.fn().mockResolvedValue([]),
  getSetting: vi.fn().mockResolvedValue({ value: "dark" }),
  updateSetting: vi.fn().mockResolvedValue({}),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the layout and sidebar", async () => {
    render(<App />);
    expect(screen.getByText("Personal Space")).toBeInTheDocument();
  });

  it("renders theme toggle button", async () => {
    render(<App />);
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders search button with shortcut hint", async () => {
    render(<App />);
    expect(screen.getByTestId("search-btn")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("opens search modal when clicking search button", async () => {
    render(<App />);
    await userEvent.click(screen.getByTestId("search-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("search-modal")).toBeInTheDocument();
    });
  });

  it("opens search modal on Ctrl+K", async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByTestId("search-modal")).toBeInTheDocument();
    });
  });

  it("shows select a page message when no page selected", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Select a page")).toBeInTheDocument();
    });
  });

  it("fetches pages on mount", async () => {
    const { getPages } = await import("../api");
    vi.mocked(getPages).mockClear();
    render(<App />);
    expect(getPages).toHaveBeenCalled();
  });

  it("closes search modal with Escape", async () => {
    render(<App />);
    await userEvent.click(screen.getByTestId("search-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("search-modal")).toBeInTheDocument();
    });
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("search-modal")).not.toBeInTheDocument();
    });
  });
});
