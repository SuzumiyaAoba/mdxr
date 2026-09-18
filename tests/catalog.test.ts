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
