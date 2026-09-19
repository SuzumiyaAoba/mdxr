import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { catalogEntries, formatCatalog } from "../src/catalog.js";
import { defineComponent } from "../src/define.js";

const Custom = defineComponent(
  {
    description: "test component",
    schema: v.object({ label: v.string(), note: v.optional(v.string()) }),
  },
  () => null
);

describe(catalogEntries, () => {
  it("describes a builtin component's schema-derived props", () => {
    const callout = catalogEntries().find((e) => e.name === "Callout");
    expect(callout?.source).toBe("builtin");
    // kind: v.optional(v.picklist(CALLOUT_KINDS), "note")
    expect(callout?.props.kind).toMatchObject({
      default: "note",
      required: false,
    });
    expect(callout?.props.kind?.type).toContain('"note"');
    expect(callout?.props.title?.type).toBe("string");
  });

  it("only lists JSX-usable names (the lowercase `pre` override is hidden)", () => {
    const entries = catalogEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.name).toMatch(/^[A-Z]/u);
    }
  });

  it("describes the overriding component, not the builtin it replaces", () => {
    const entries = catalogEntries({ Callout: Custom });
    const callouts = entries.filter((e) => e.name === "Callout");
    expect(callouts).toHaveLength(1);
    expect(callouts[0]).toMatchObject({
      description: "test component",
      source: "project",
    });
    expect(callouts[0]?.props.label?.required).toBeTruthy();
  });

  it("lists project-only components alongside builtins", () => {
    const thing = catalogEntries({ CustomThing: Custom }).find(
      (e) => e.name === "CustomThing"
    );
    expect(thing).toMatchObject({
      description: "test component",
      source: "project",
    });
    expect(thing?.props.note?.required).toBeFalsy();
  });

  it("does not mistake prototype names for builtin overrides", () => {
    // A default-exported map can carry keys like `constructor` — `in` would
    // see the inherited Object.prototype member and drop it from the catalog.
    const entries = catalogEntries({ constructor: Custom });
    const ctor = entries.find((e) => e.name === "constructor");
    expect(ctor?.source).toBe("project");
  });

  it("shows the picklist inside a pipe, not just the base type", () => {
    // Endpoint method: v.pipe(v.string(), v.toUpperCase(), v.picklist(METHODS))
    const endpoint = catalogEntries().find((e) => e.name === "Endpoint");
    expect(endpoint?.props.method?.type).toContain('"GET"');
  });

  it("reports the outermost default of nested wrappers", () => {
    const Nested = defineComponent(
      {
        schema: v.object({
          // Absent prop resolves to "outer" — the inner default never applies.
          x: v.optional(v.nullable(v.string(), "inner"), "outer"),
        }),
      },
      () => null
    );
    const entry = catalogEntries({ Nested }).find((e) => e.name === "Nested");
    expect(entry?.props.x).toMatchObject({ default: "outer", required: false });
  });
});

describe(formatCatalog, () => {
  it("prints component signatures and the conventions list", () => {
    const out = formatCatalog(catalogEntries({ CustomThing: Custom }));
    expect(out).toContain("Components:");
    expect(out).toContain("<Callout");
    expect(out).toContain("<CustomThing label: string, note?: string>");
    expect(out).toContain("(project-defined)");
    expect(out).toContain(":::note");
  });
});
