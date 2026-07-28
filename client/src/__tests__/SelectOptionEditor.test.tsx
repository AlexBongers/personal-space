import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectOptionEditor from "../components/SelectOptionEditor";
import type { Property } from "shared/types";

const mockProperty: Property = {
  id: "prop1",
  name: "Status",
  type: "select",
  options: [
    { id: "opt1", value: "Backlog", color: "gray" },
    { id: "opt2", value: "In Progress", color: "blue" },
    { id: "opt3", value: "Done", color: "green" },
  ],
};

vi.mock("../api", () => ({
  addSelectOption: vi.fn().mockResolvedValue({}),
  deleteSelectOption: vi.fn().mockResolvedValue(undefined),
}));

describe("SelectOptionEditor", () => {
  let onOptionsChanged: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onOptionsChanged = vi.fn();
    onClose = vi.fn();
  });

  it("renders existing options", () => {
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders header with property name", () => {
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    expect(screen.getByText("Options for Status")).toBeInTheDocument();
  });

  it("shows empty state when no options", () => {
    const emptyProp: Property = { id: "prop1", name: "Status", type: "select", options: [] };
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={emptyProp}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    expect(screen.getByText(/No options yet/i)).toBeInTheDocument();
  });

  it("renders add input and button", () => {
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    expect(screen.getByPlaceholderText("Option name...")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("calls onClose when X button is clicked", async () => {
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    const closeBtns = screen.getAllByText("✕");
    await userEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("adds a new option", async () => {
    const { addSelectOption } = await import("../api");
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    const input = screen.getByPlaceholderText("Option name...");
    await userEvent.type(input, "New Option");
    await userEvent.click(screen.getByText("Add"));

    expect(addSelectOption).toHaveBeenCalled();
    expect(onOptionsChanged).toHaveBeenCalled();
  });

  it("does not add empty option", async () => {
    const { addSelectOption } = await import("../api");
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    await userEvent.click(screen.getByText("Add"));

    expect(addSelectOption).not.toHaveBeenCalled();
  });

  it("removes an option", async () => {
    const { deleteSelectOption } = await import("../api");
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    const removeBtns = screen.getAllByTitle("Remove option");
    await userEvent.click(removeBtns[0]);

    expect(deleteSelectOption).toHaveBeenCalledWith("opt1");
    expect(onOptionsChanged).toHaveBeenCalled();
  });

  it("adds option on Enter key", async () => {
    const { addSelectOption } = await import("../api");
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    const input = screen.getByPlaceholderText("Option name...");
    await userEvent.type(input, "Enter Option");
    await userEvent.keyboard("{Enter}");

    expect(addSelectOption).toHaveBeenCalled();
  });

  it("renders color picker buttons", () => {
    render(
      <SelectOptionEditor
        databaseId="db1"
        property={mockProperty}
        onOptionsChanged={onOptionsChanged}
        onClose={onClose}
      />
    );
    const colorBtns = screen.getAllByRole("button");
    expect(colorBtns.length).toBeGreaterThan(5);
  });
});
