import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterSortBar from "../components/FilterSortBar";
import type { Database, View } from "shared/types";

const mockDatabase: Database = {
  id: "db1",
  pageId: "p1",
  name: "Tasks",
  properties: [
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
    { id: "title_prop", name: "Title", type: "text" },
    { id: "score", name: "Score", type: "number" },
    { id: "due_date", name: "Due Date", type: "date" },
    { id: "website", name: "Website", type: "url" },
    {
      id: "tags",
      name: "Tags",
      type: "multi-select",
      options: [
        { id: "tag1", value: "Frontend", color: "blue" },
      ],
    },
  ],
  createdAt: "",
  updatedAt: "",
};

const baseView: View = {
  id: "v1",
  databaseId: "db1",
  type: "table",
  name: "Table View",
  filters: [],
  sortField: null,
  sortDirection: "asc",
  groupField: null,
  createdAt: "",
  updatedAt: "",
};

describe("FilterSortBar", () => {
  let onViewChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onViewChange = vi.fn();
  });

  function renderBar(view: View = baseView) {
    return render(
      <FilterSortBar
        database={mockDatabase}
        view={view}
        onViewChange={onViewChange}
      />
    );
  }

  it("renders filter and sort buttons", () => {
    renderBar();
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("Sort")).toBeInTheDocument();
  });

  it("shows active filter count when filters exist", () => {
    const view: View = {
      ...baseView,
      filters: [{ id: "f1", field: "status", operator: "is", value: "Backlog" }],
    };
    renderBar(view);
    expect(screen.getByText(/Filter.*1/)).toBeInTheDocument();
  });

  it("opens filter panel on click", async () => {
    renderBar();
    await userEvent.click(screen.getByText("Filter"));
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("+ Add filter")).toBeInTheDocument();
  });

  it("opens sort panel on click", async () => {
    renderBar();
    const sortBtn = screen.getByText("Sort");
    await userEvent.click(sortBtn);
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("closes filter panel when clicking Done", async () => {
    renderBar();
    await userEvent.click(screen.getByText("Filter"));
    expect(screen.getByText("+ Add filter")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Done"));
    await waitFor(() => {
      expect(screen.queryByText("+ Add filter")).not.toBeInTheDocument();
    });
  });

  it("closes sort panel when clicking Done", async () => {
    renderBar();
    await userEvent.click(screen.getByText("Sort"));
    const doneBtns = screen.getAllByText("Done");
    await userEvent.click(doneBtns[doneBtns.length - 1]);
    await waitFor(() => {
      expect(screen.queryByText("None")).not.toBeInTheDocument();
    });
  });

  it("switches between panels - sort closes filter", async () => {
    renderBar();
    await userEvent.click(screen.getByText("Filter"));
    expect(screen.getByText("+ Add filter")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Sort"));
    await waitFor(() => {
      expect(screen.queryByText("+ Add filter")).not.toBeInTheDocument();
    });
  });

  it("adds a new filter via '+ Add filter' button", async () => {
    renderBar();
    await userEvent.click(screen.getByText("Filter"));
    await userEvent.click(screen.getByText("+ Add filter"));
    expect(onViewChange).toHaveBeenCalled();
    const updatedView: View = onViewChange.mock.calls[0][0];
    expect(updatedView.filters).toHaveLength(1);
    expect(updatedView.filters[0].field).toBe("status");
  });

  it("shows no filters message when panel open and no filters", async () => {
    renderBar();
    await userEvent.click(screen.getByText("Filter"));
    expect(screen.getByText(/No filters applied/i)).toBeInTheDocument();
  });

  it("renders filter pills for active filters outside panel", () => {
    const view: View = {
      ...baseView,
      filters: [
        { id: "f1", field: "status", operator: "is", value: "Backlog" },
        { id: "f2", field: "completed", operator: "is", value: true },
      ],
    };
    renderBar(view);
    expect(screen.getByText(/Status/)).toBeInTheDocument();
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  it("removes a filter when clicking pill remove button", async () => {
    const view: View = {
      ...baseView,
      filters: [{ id: "f1", field: "status", operator: "is", value: "Backlog" }],
    };
    renderBar(view);
    const removeBtns = document.querySelectorAll('[class*="filterPillRemove"]');
    await userEvent.click(removeBtns[0]);
    expect(onViewChange).toHaveBeenCalled();
    const updated: View = onViewChange.mock.calls[0][0];
    expect(updated.filters).toHaveLength(0);
  });

  it("removes a filter from panel via remove button", async () => {
    const view: View = {
      ...baseView,
      filters: [{ id: "f1", field: "status", operator: "is", value: "Backlog" }],
    };
    renderBar(view);
    await userEvent.click(screen.getByText(/Filter/));
    const removeBtns = document.querySelectorAll('[class*="removeBtn"]');
    await userEvent.click(removeBtns[0]);
    expect(onViewChange).toHaveBeenCalled();
    const updated: View = onViewChange.mock.calls[0][0];
    expect(updated.filters).toHaveLength(0);
  });

  it("selects sort property from dropdown", async () => {
    renderBar();
    await userEvent.click(screen.getByText("Sort"));
    const select = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(select, "title_prop");
    expect(onViewChange).toHaveBeenCalled();
    const updated: View = onViewChange.mock.calls[0][0];
    expect(updated.sortField).toBe("title_prop");
  });

  it("clears sort when selecting None", async () => {
    const view: View = { ...baseView, sortField: "title_prop", sortDirection: "asc" };
    renderBar(view);
    await userEvent.click(screen.getByText(/Sort:/));
    const select = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(select, "");
    expect(onViewChange).toHaveBeenCalled();
    const updated: View = onViewChange.mock.calls[0][0];
    expect(updated.sortField).toBeNull();
  });

  it("toggles sort direction button", async () => {
    const view: View = { ...baseView, sortField: "title_prop", sortDirection: "asc" };
    renderBar(view);
    await userEvent.click(screen.getByText(/Sort:/));
    const toggleBtn = screen.getByText("↑ Asc");
    await userEvent.click(toggleBtn);
    expect(onViewChange).toHaveBeenCalled();
    const updated: View = onViewChange.mock.calls[0][0];
    expect(updated.sortDirection).toBe("desc");
  });

  it("shows sort direction as desc when sort is desc", async () => {
    const view: View = { ...baseView, sortField: "title_prop", sortDirection: "desc" };
    renderBar(view);
    // The sort button shows a down arrow when direction is desc
    expect(screen.getByText("↓")).toBeInTheDocument();
  });

  it("shows filter pills with values for non-empty non-checkbox", () => {
    const view: View = {
      ...baseView,
      filters: [{ id: "f1", field: "title_prop", operator: "contains", value: "test" }],
    };
    renderBar(view);
    expect(screen.getByText(/= test/)).toBeInTheDocument();
  });

  it("does not show = value for is_empty operators", () => {
    const view: View = {
      ...baseView,
      filters: [{ id: "f1", field: "title_prop", operator: "is_empty", value: "" }],
    };
    renderBar(view);
    // pills should not contain "= " for is_empty
    const pills = document.querySelectorAll('[class*="filterPill"]');
    const pillText = Array.from(pills).map(p => p.textContent).join("");
    expect(pillText).not.toContain("= ");
  });

  it("changing filter property resets operator", async () => {
    const view: View = {
      ...baseView,
      filters: [{ id: "f1", field: "status", operator: "is", value: "Backlog" }],
    };
    renderBar(view);
    await userEvent.click(screen.getByText(/Filter/));
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "completed");
    expect(onViewChange).toHaveBeenCalled();
    const updated: View = onViewChange.mock.calls[0][0];
    const updatedFilter = updated.filters[0];
    expect(updatedFilter.field).toBe("completed");
    expect(updatedFilter.value).toBe(false);
  });

  it("does not add filter when no properties exist", async () => {
    const emptyDb: Database = {
      ...mockDatabase,
      properties: [],
    };
    render(
      <FilterSortBar
        database={emptyDb}
        view={baseView}
        onViewChange={onViewChange}
      />
    );
    await userEvent.click(screen.getByText("Filter"));
    await userEvent.click(screen.getByText("+ Add filter"));
    expect(onViewChange).not.toHaveBeenCalled();
  });
});
