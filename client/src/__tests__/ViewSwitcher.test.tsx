import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewSwitcher from "../components/ViewSwitcher";
import type { View } from "shared/types";

const mockViews: View[] = [
  { id: "v1", databaseId: "db1", type: "table", name: "Table View", filters: [], sortField: null, sortDirection: "asc", groupField: null, createdAt: "", updatedAt: "" },
  { id: "v2", databaseId: "db1", type: "board", name: "Board View", filters: [], sortField: null, sortDirection: "asc", groupField: "status", createdAt: "", updatedAt: "" },
  { id: "v3", databaseId: "db1", type: "list", name: "List View", filters: [], sortField: null, sortDirection: "asc", groupField: null, createdAt: "", updatedAt: "" },
];

describe("ViewSwitcher", () => {
  it("renders null for empty views", () => {
    const { container } = render(
      <ViewSwitcher views={[]} activeViewId={null} onSwitchView={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all views as buttons", () => {
    render(
      <ViewSwitcher views={mockViews} activeViewId={null} onSwitchView={vi.fn()} />
    );
    expect(screen.getByText("Table View")).toBeInTheDocument();
    expect(screen.getByText("Board View")).toBeInTheDocument();
    expect(screen.getByText("List View")).toBeInTheDocument();
  });

  it("highlights the active view", () => {
    render(
      <ViewSwitcher views={mockViews} activeViewId="v1" onSwitchView={vi.fn()} />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].style.color).toBe("var(--amber)");
    expect(buttons[1].style.color).toBe("var(--text-muted)");
  });

  it("calls onSwitchView when a view is clicked", () => {
    const onSwitch = vi.fn();
    render(
      <ViewSwitcher views={mockViews} activeViewId={null} onSwitchView={onSwitch} />
    );
    fireEvent.click(screen.getByText("Board View"));
    expect(onSwitch).toHaveBeenCalledWith(mockViews[1]);
  });
});
