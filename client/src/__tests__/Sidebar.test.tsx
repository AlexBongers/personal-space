import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "../pages/Sidebar";
import { Page } from "shared/types";

const buildPage = (overrides: Partial<Page> = {}): Page => ({
  id: overrides.id ?? "p1",
  title: overrides.title ?? "Test Page",
  parentId: overrides.parentId ?? null,
  icon: overrides.icon ?? null,
  createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2024-01-01T00:00:00.000Z",
});

vi.mock("../api", () => ({
  getPages: vi.fn(),
  getPage: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
}));

describe("Sidebar", () => {
  let pages: Page[];
  let onSelectPage: ReturnType<typeof vi.fn>;
  let onPagesChanged: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const { createPage } = await import("../api");
    vi.clearAllMocks();
    pages = [buildPage({ id: "p1", title: "Home" }), buildPage({ id: "p2", title: "Projects" })];
    onSelectPage = vi.fn();
    onPagesChanged = vi.fn();
    vi.mocked(createPage).mockResolvedValue(
      buildPage({ id: "p3", title: "New Page" })
    );
  });

  it("renders tree items from pages data", () => {
    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Personal Space")).toBeInTheDocument();
  });

  it("clicking a page calls onSelectPage", async () => {
    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    await userEvent.click(screen.getByText("Home"));
    expect(onSelectPage).toHaveBeenCalledWith("p1");
  });

  it("clicking New Page button calls createPage API", async () => {
    const { createPage } = await import("../api");

    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    await userEvent.click(screen.getByText("New Page"));

    await waitFor(() => {
      expect(createPage).toHaveBeenCalledWith({
        title: "New Page",
        parentId: null,
        icon: "📄",
      });
    });
    expect(onPagesChanged).toHaveBeenCalled();
  });

  it("clicking rename triggers inline edit", async () => {
    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    const homeRow = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(homeRow);

    const renameBtn = screen.getAllByTitle("Rename")[0];
    await userEvent.click(renameBtn);

    expect(screen.getByDisplayValue("Home")).toBeInTheDocument();
  });

  it("clicking rename button calls updatePage with new title", async () => {
    const { updatePage } = await import("../api");
    vi.mocked(updatePage).mockResolvedValue(buildPage({ id: "p1", title: "New Name" }));

    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    const homeRow = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(homeRow);

    const renameBtn = screen.getAllByTitle("Rename")[0];
    await userEvent.click(renameBtn);

    const input = screen.getByDisplayValue("Home");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(updatePage).toHaveBeenCalledWith("p1", { title: "New Name" });
    });
    expect(onPagesChanged).toHaveBeenCalled();
  });

  it("clicking delete shows confirmation modal", async () => {
    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    const homeRow = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(homeRow);

    const deleteBtn = screen.getAllByTitle("Delete")[0];
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("Delete Page")).toBeInTheDocument();
    });
    expect(screen.getByText('Delete "Home"?')).toBeInTheDocument();
  });

  it("confirming delete calls deletePage API", async () => {
    const { deletePage } = await import("../api");
    vi.mocked(deletePage).mockResolvedValue(undefined);

    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    const homeRow = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(homeRow);

    const deleteBtn = screen.getAllByTitle("Delete")[0];
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("Delete Page")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deletePage).toHaveBeenCalledWith("p1");
    });
    expect(onPagesChanged).toHaveBeenCalled();
  });

  it("cancelling delete does not call deletePage API", async () => {
    const { deletePage } = await import("../api");

    render(
      <Sidebar
        pages={pages}
        selectedId={null}
        onSelectPage={onSelectPage}
        onPagesChanged={onPagesChanged}
      />
    );

    const homeRow = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(homeRow);
    const deleteBtn = screen.getAllByTitle("Delete")[0];
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText("Delete Page")).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await userEvent.click(cancelBtn);

    expect(deletePage).not.toHaveBeenCalled();
    expect(onPagesChanged).not.toHaveBeenCalled();
  });
});