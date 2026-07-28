import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlockRenderer from "../components/BlockRenderer";
import { Block } from "shared/types";

function buildBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: overrides.id ?? "block-1",
    pageId: overrides.pageId ?? "page-1",
    type: overrides.type ?? "paragraph",
    content: overrides.content ?? "Test content",
    position: overrides.position ?? 0,
    checked: overrides.checked,
    createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2024-01-01T00:00:00.000Z",
  };
}

function renderBlock(block: Block, props: Partial<Parameters<typeof BlockRenderer>[0]> = {}) {
  return render(
    <BlockRenderer
      block={block}
      focusId={null}
      onClearFocus={vi.fn()}
      onChange={vi.fn()}
      onEnter={vi.fn()}
      onDelete={vi.fn()}
      onTypeChange={vi.fn()}
      onToggleTodo={vi.fn()}
      {...props}
    />
  );
}

function typeInContentEditable(
  element: HTMLElement,
  text: string,
) {
  element.textContent = text;
  fireEvent.input(element);
}

describe("BlockRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders paragraph block with content", () => {
    const block = buildBlock({ type: "paragraph", content: "Hello world" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("Hello world");
  });

  it("renders heading1 with large text", () => {
    const block = buildBlock({ type: "heading1", content: "My Heading" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("My Heading");
    expect(el.className).toContain("heading1");
  });

  it("renders heading2", () => {
    const block = buildBlock({ type: "heading2", content: "Subheading" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toHaveTextContent("Subheading");
    expect(el.className).toContain("heading2");
  });

  it("renders heading3", () => {
    const block = buildBlock({ type: "heading3", content: "Small heading" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toHaveTextContent("Small heading");
    expect(el.className).toContain("heading3");
  });

  it("renders todo with checkbox (unchecked)", () => {
    const block = buildBlock({ type: "todo", content: "Buy milk", checked: false });
    renderBlock(block);

    const content = screen.getByTestId("block-content-block-1");
    expect(content).toHaveTextContent("Buy milk");

    const checkbox = screen.getByTestId("block-checkbox-block-1");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("renders todo with checkbox (checked)", () => {
    const block = buildBlock({ type: "todo", content: "Done task", checked: true });
    renderBlock(block);

    const checkbox = screen.getByTestId("block-checkbox-block-1");
    expect(checkbox).toBeChecked();
  });

  it("renders bulleted list with content", () => {
    const block = buildBlock({ type: "bulleted_list", content: "List item" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toHaveTextContent("List item");
    expect(el.className).toContain("bulletContent");
  });

  it("renders numbered list with content and number", () => {
    const block = buildBlock({ type: "numbered_list", content: "First" });
    renderBlock(block, { number: 3 });

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toHaveTextContent("First");
    expect(el.className).toContain("numberContent");

    expect(screen.getByText("3.")).toBeInTheDocument();
  });

  it("renders quote block with content", () => {
    const block = buildBlock({ type: "quote", content: "A wise saying" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toHaveTextContent("A wise saying");
    expect(el.className).toContain("quote");
  });

  it("renders code block with content", () => {
    const block = buildBlock({ type: "code", content: "console.log('hi')" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toHaveTextContent("console.log('hi')");
    expect(el.className).toContain("code");
  });

  it("renders divider block (no content editable)", () => {
    const block = buildBlock({ type: "divider", content: "" });
    renderBlock(block);

    expect(screen.queryByTestId("block-content-block-1")).not.toBeInTheDocument();

    const dividerLine = document.querySelector('[class*="dividerLine"]');
    expect(dividerLine).toBeInTheDocument();
  });

  it("renders callout block with content", () => {
    const block = buildBlock({ type: "callout", content: "Note this" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    expect(el).toHaveTextContent("Note this");
    expect(el.className).toContain("calloutContent");
  });

  it("shows drag handle", () => {
    const block = buildBlock({ type: "paragraph", content: "Hi" });
    renderBlock(block);

    const handle = screen.getByTestId("drag-handle-block-1");
    expect(handle).toBeInTheDocument();
  });

  it("calls onChange when typing in text block", () => {
    const onChange = vi.fn();
    const block = buildBlock({ type: "paragraph", content: "" });
    renderBlock(block, { onChange });

    const el = screen.getByTestId("block-content-block-1");
    typeInContentEditable(el, "new text");

    expect(onChange).toHaveBeenCalledWith("block-1", "new text");
  });

  it("calls onToggleTodo when checkbox is clicked", () => {
    const onToggleTodo = vi.fn();
    const block = buildBlock({ type: "todo", content: "Task", checked: false });
    renderBlock(block, { onToggleTodo });

    const checkbox = screen.getByTestId("block-checkbox-block-1");
    fireEvent.click(checkbox);

    expect(onToggleTodo).toHaveBeenCalledWith("block-1", true);
  });

  it("calls onToggleTodo with false when checked todo is clicked", () => {
    const onToggleTodo = vi.fn();
    const block = buildBlock({ type: "todo", content: "Task", checked: true });
    renderBlock(block, { onToggleTodo });

    const checkbox = screen.getByTestId("block-checkbox-block-1");
    fireEvent.click(checkbox);

    expect(onToggleTodo).toHaveBeenCalledWith("block-1", false);
  });

  it("calls onEnter when Enter is pressed", () => {
    const onEnter = vi.fn();
    const block = buildBlock({ type: "paragraph", content: "some text" });
    renderBlock(block, { onEnter });

    const el = screen.getByTestId("block-content-block-1");
    fireEvent.keyDown(el, { key: "Enter" });

    expect(onEnter).toHaveBeenCalledWith("block-1", 0);
  });

  it("calls onDelete when Backspace is pressed on empty block", () => {
    const onDelete = vi.fn();
    const block = buildBlock({ type: "paragraph", content: "" });
    renderBlock(block, { onDelete });

    const el = screen.getByTestId("block-content-block-1");
    fireEvent.keyDown(el, { key: "Backspace" });

    expect(onDelete).toHaveBeenCalledWith("block-1");
  });

  it("does not call onDelete when Backspace is pressed on non-empty block", () => {
    const onDelete = vi.fn();
    const block = buildBlock({ type: "paragraph", content: "text" });
    renderBlock(block, { onDelete });

    const el = screen.getByTestId("block-content-block-1");
    fireEvent.keyDown(el, { key: "Backspace" });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows slash menu when '/' is typed at start", () => {
    const block = buildBlock({ type: "paragraph", content: "" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    typeInContentEditable(el, "/");

    expect(document.querySelector('[class*="slashMenu"]')).toBeInTheDocument();
  });

  it("does not show slash menu for normal typing", () => {
    const block = buildBlock({ type: "paragraph", content: "" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    typeInContentEditable(el, "hello");

    expect(document.querySelector('[class*="slashMenu"]')).not.toBeInTheDocument();
  });

  it("closes slash menu when slash is removed", () => {
    const block = buildBlock({ type: "paragraph", content: "" });
    renderBlock(block);

    const el = screen.getByTestId("block-content-block-1");
    typeInContentEditable(el, "/");

    expect(document.querySelector('[class*="slashMenu"]')).toBeInTheDocument();

    typeInContentEditable(el, "a");

    expect(document.querySelector('[class*="slashMenu"]')).not.toBeInTheDocument();
  });
});
