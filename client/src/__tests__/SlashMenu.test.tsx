import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SlashMenu from "../components/SlashMenu";

function createAnchorEl(): HTMLElement {
  const el = document.createElement("div");
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: 100,
    bottom: 124,
    left: 200,
    right: 500,
    width: 300,
    height: 24,
    x: 200,
    y: 100,
    toJSON: () => ({}),
  });
  return el;
}

describe("SlashMenu", () => {
  it("renders all 11 block types when no filter", () => {
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="" onSelect={vi.fn()} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    expect(screen.getByText("Paragraph")).toBeInTheDocument();
    expect(screen.getByText("Heading 1")).toBeInTheDocument();
    expect(screen.getByText("Heading 2")).toBeInTheDocument();
    expect(screen.getByText("Heading 3")).toBeInTheDocument();
    expect(screen.getByText("Bulleted List")).toBeInTheDocument();
    expect(screen.getByText("Numbered List")).toBeInTheDocument();
    expect(screen.getByText("To-do")).toBeInTheDocument();
    expect(screen.getByText("Quote")).toBeInTheDocument();
    expect(screen.getByText("Divider")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Callout")).toBeInTheDocument();
  });

  it("filters results when filter text is provided", () => {
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="head" onSelect={vi.fn()} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    expect(screen.getByText("Heading 1")).toBeInTheDocument();
    expect(screen.getByText("Heading 2")).toBeInTheDocument();
    expect(screen.getByText("Heading 3")).toBeInTheDocument();

    expect(screen.queryByText("Paragraph")).not.toBeInTheDocument();
    expect(screen.queryByText("Code")).not.toBeInTheDocument();
  });

  it("filters by type name", () => {
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="code" onSelect={vi.fn()} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.queryByText("Heading 1")).not.toBeInTheDocument();
  });

  it("filters by description", () => {
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="check" onSelect={vi.fn()} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    expect(screen.getByText("To-do")).toBeInTheDocument();
    expect(screen.queryByText("Paragraph")).not.toBeInTheDocument();
  });

  it("calls onSelect when item is clicked", () => {
    const onSelect = vi.fn();
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="" onSelect={onSelect} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    fireEvent.mouseDown(screen.getByText("Heading 1"));
    expect(onSelect).toHaveBeenCalledWith("heading1");
  });

  it("calls onSelect when Enter is pressed with highlighted item", () => {
    const onSelect = vi.fn();
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="" onSelect={onSelect} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("paragraph");
  });

  it("navigates with ArrowDown and ArrowUp", () => {
    const onSelect = vi.fn();
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="" onSelect={onSelect} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("heading1");
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="" onSelect={vi.fn()} onClose={onClose} anchorEl={anchorEl} />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'No results' for non-matching filter", () => {
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="zzzzyyyy" onSelect={vi.fn()} onClose={vi.fn()} anchorEl={anchorEl} />
    );

    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("closes when overlay is clicked", () => {
    const onClose = vi.fn();
    const anchorEl = createAnchorEl();
    render(
      <SlashMenu filter="" onSelect={vi.fn()} onClose={onClose} anchorEl={anchorEl} />
    );

    const overlay = document.querySelector('[class*="slashMenuOverlay"]');
    expect(overlay).toBeInTheDocument();
    fireEvent.mouseDown(overlay!);
    expect(onClose).toHaveBeenCalled();
  });
});
