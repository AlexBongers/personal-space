import assert from "node:assert/strict";
import test from "node:test";
import {
  compactText,
  createEmptyDatabase,
  createEmptyPage,
  defaultFilterOperator,
  descendantIds,
  emptyView,
  getValue,
  makeSeed,
  matchesFilter,
  normalizeItems,
  optionForValue,
  valueText,
} from "../app/personal-space/model.ts";
import type { Database, Filter, Property, Row } from "../app/personal-space/types.ts";

test("seed showcases every block and property type", () => {
  const items = makeSeed();
  const secondSeed = makeSeed();
  const blockTypes = new Set(items.flatMap((item) => item.kind === "page" ? item.blocks.map((block) => block.type) : []));
  const propertyTypes = new Set(items.flatMap((item) => item.kind === "database" ? item.properties.map((property) => property.type) : []));

  assert.equal(items.length, 7);
  assert.deepEqual(
    items.map((item) => item.kind === "page" ? item.blocks.map((block) => block.id) : item.properties.flatMap((property) => property.options?.map((option) => option.id) || [])),
    secondSeed.map((item) => item.kind === "page" ? item.blocks.map((block) => block.id) : item.properties.flatMap((property) => property.options?.map((option) => option.id) || [])),
  );
  assert.deepEqual(
    [...blockTypes].sort(),
    ["bulleted", "callout", "code", "divider", "heading1", "heading2", "heading3", "numbered", "paragraph", "quote", "todo"].sort(),
  );
  assert.deepEqual(
    [...propertyTypes].sort(),
    ["checkbox", "date", "multi-select", "number", "select", "text", "url"].sort(),
  );
});

test("page hierarchy deletion resolves every descendant", () => {
  const descendants = descendantIds(makeSeed(), "work");
  assert.deepEqual([...descendants].sort(), ["launch", "projects", "work"]);
  assert.deepEqual([...descendantIds(makeSeed(), "travel")], ["travel"]);
});

test("new pages and databases start with usable content and views", () => {
  const page = createEmptyPage("home");
  const database = createEmptyDatabase();

  assert.equal(page.parentId, "home");
  assert.equal(page.blocks[0].type, "paragraph");
  assert.equal(database.properties[0].type, "select");
  assert.equal(database.views?.board?.mode, "board");
  assert.equal(database.views?.list?.mode, "list");
  assert.equal(database.view.groupBy, database.properties[0].id);
});

test("database filters cover text, select, checkbox, and date operators", () => {
  const row: Row = {
    id: "row",
    title: "A row",
    values: { text: "Quiet workspace", stage: "Review", complete: true, due: "2026-08-20" },
    blocks: [],
  };
  const properties: Record<string, Property> = {
    text: { id: "text", name: "Text", type: "text" },
    stage: { id: "stage", name: "Stage", type: "select", options: [{ id: "review", label: "Review", color: "#ecad0a" }] },
    complete: { id: "complete", name: "Complete", type: "checkbox" },
    due: { id: "due", name: "Due", type: "date" },
  };
  const filter = (propertyId: string, operator: Filter["operator"], query = ""): Filter => ({ propertyId, operator, query });

  assert.equal(matchesFilter(row, properties.text, filter("text", "contains", "workspace")), true);
  assert.equal(matchesFilter(row, properties.text, filter("text", "is-not", "elsewhere")), true);
  assert.equal(matchesFilter(row, properties.stage, filter("stage", "is", "review")), true);
  assert.equal(matchesFilter(row, properties.complete, filter("complete", "checked")), true);
  assert.equal(matchesFilter(row, properties.complete, filter("complete", "unchecked")), false);
  assert.equal(matchesFilter(row, properties.due, filter("due", "before", "2026-09-01")), true);
  assert.equal(matchesFilter(row, properties.due, filter("due", "after", "2026-08-01")), true);
  assert.equal(matchesFilter(row, properties.text, filter("text", "contains", "")), true);
});

test("view normalization preserves independent settings and fills legacy defaults", () => {
  const database = makeSeed().find((item): item is Database => item.id === "projects");
  assert.ok(database);
  const legacy = {
    ...database,
    view: { ...emptyView("board"), filters: [{ propertyId: "complete", query: "", operator: undefined }] },
    views: undefined,
  } as unknown as Database;
  const [normalized] = normalizeItems([legacy]);
  assert.equal(normalized.kind, "database");
  if (normalized.kind !== "database") return;
  assert.equal(normalized.views?.table?.mode, "table");
  assert.equal(normalized.views?.board?.filters[0].operator, "checked");
  assert.equal(normalized.views?.list?.sortDir, "asc");
});

test("value helpers and defaults return predictable values", () => {
  const row: Row = { id: "row", title: "Row", values: { tags: ["Build", "Writing"], count: 3 }, blocks: [] };
  const select: Property = { id: "stage", name: "Stage", type: "select", options: [{ id: "review", label: "Review", color: "#ecad0a" }] };

  assert.deepEqual(getValue(row, "tags"), ["Build", "Writing"]);
  assert.equal(getValue(row, "missing"), null);
  assert.equal(valueText(getValue(row, "tags")), "Build, Writing");
  assert.equal(valueText(null), "");
  assert.equal(compactText("Heading 1"), "heading1");
  assert.equal(defaultFilterOperator({ id: "done", name: "Done", type: "checkbox" }), "checked");
  assert.equal(defaultFilterOperator({ id: "due", name: "Due", type: "date" }), "after");
  assert.equal(defaultFilterOperator(select), "is");
  assert.equal(defaultFilterOperator(undefined), "contains");
  assert.equal(optionForValue(select, "Review")?.color, "#ecad0a");
});
