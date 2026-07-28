import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TreeItem from "../components/TreeItem";
import { Page } from "shared/types";

const buildPage = (overrides: Partial<Page> = {}): Page => ({
  id: overrides.id ?? "p1",
  title: overrides.title ?? "Test Page",
  parentId: overrides.parentId ?? null,
  icon: overrides.icon ?? null,
  createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2024-01-01T00:00:00.000Z",
});

describe("TreeItem", () => {
  it("renders page title and icon", () => {
    const node = {
      page: buildPage({ id: "p1", title: "Home", icon: "🏠" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("🏠")).toBeInTheDocument();
  });

  it("renders default icon when none provided", () => {
    const node = {
      page: buildPage({ id: "p1", title: "Notes", icon: null }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("📄")).toBeInTheDocument();
  });

  it("toggles expand/collapse on chevron click", async () => {
    const childPage = buildPage({ id: "p2", title: "Child" });
    const node = {
      page: buildPage({ id: "p1", title: "Parent" }),
      children: [
        { page: childPage, children: [] },
      ],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Child")).toBeInTheDocument();

    const chevron = screen.getByText("▶");
    await userEvent.click(chevron);

    expect(screen.queryByText("Child")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("▶"));
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("calls onSelect when row is clicked", async () => {
    const onSelect = vi.fn();
    const node = {
      page: buildPage({ id: "p1", title: "Home" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={onSelect}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const row = screen.getByText("Home").closest('[class*="row"]')!;
    await userEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("shows action buttons on hover", () => {
    const node = {
      page: buildPage({ id: "p1", title: "Home" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const row = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(row);

    expect(screen.getByTitle("Rename")).toBeInTheDocument();
    expect(screen.getByTitle("Delete")).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const onDelete = vi.fn();
    const node = {
      page: buildPage({ id: "p1", title: "Home" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
      />
    );

    const row = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(row);

    await userEvent.click(screen.getByTitle("Delete"));
    expect(onDelete).toHaveBeenCalledWith("p1");
  });

  it("rename input works - clicking rename enters edit mode", async () => {
    const node = {
      page: buildPage({ id: "p1", title: "Home" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const row = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(row);

    await userEvent.click(screen.getByTitle("Rename"));

    const input = screen.getByDisplayValue("Home");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("rename submit calls onRename with new title", async () => {
    const onRename = vi.fn();
    const node = {
      page: buildPage({ id: "p1", title: "Home" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />
    );

    const row = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(row);
    await userEvent.click(screen.getByTitle("Rename"));

    const input = screen.getByDisplayValue("Home");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed");
    await userEvent.keyboard("{Enter}");

    expect(onRename).toHaveBeenCalledWith("p1", "Renamed");
  });

  it("rename with Escape key cancels without calling onRename", async () => {
    const onRename = vi.fn();
    const node = {
      page: buildPage({ id: "p1", title: "Home" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId={null}
        onSelect={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />
    );

    const row = screen.getByText("Home").closest('[class*="row"]')!;
    fireEvent.mouseOver(row);
    await userEvent.click(screen.getByTitle("Rename"));

    const input = screen.getByDisplayValue("Home");
    await userEvent.clear(input);
    await userEvent.type(input, "Cancelled");
    await userEvent.keyboard("{Escape}");

    expect(onRename).not.toHaveBeenCalled();
  });

  it("applies selected class when selectedId matches", () => {
    const node = {
      page: buildPage({ id: "p1", title: "Home" }),
      children: [],
    };

    render(
      <TreeItem
        node={node}
        depth={0}
        selectedId="p1"
        onSelect={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const row = screen.getByText("Home").closest('[class*="row"]')!;
    expect(row.className).toContain("selected");
  });
});