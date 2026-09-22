import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Slider } from "../src/components/ui/slider.js";
import { Tabs, TabsList, TabsTrigger } from "../src/components/ui/tabs.js";
import { parseLineRange } from "../src/lines.js";
import { parseDiffHl } from "../src/ui/diff-parse.js";
import { DiffStat } from "../src/ui/diffstat.js";
import { folderIcon } from "../src/ui/file-icon.js";
import { parseDuration } from "../src/ui/tests.js";

describe("primitive control boundaries", () => {
  it.each([{ value: 25 }, { defaultValue: 25 }])(
    "renders one slider thumb for a scalar value (%j)",
    (props) => {
      const html = renderToStaticMarkup(createElement(Slider, props));
      expect(html.match(/data-slot="slider-thumb"/gu)).toHaveLength(1);
      expect(html).toContain('aria-valuenow="25"');
    }
  );

  it("keeps both thumbs for a range slider", () => {
    const html = renderToStaticMarkup(
      createElement(Slider, { defaultValue: [20, 80] })
    );
    expect(html.match(/data-slot="slider-thumb"/gu)).toHaveLength(2);
  });

  it("communicates vertical tabs to assistive technology", () => {
    const html = renderToStaticMarkup(
      createElement(
        Tabs,
        { orientation: "vertical" },
        createElement(
          TabsList,
          {},
          createElement(TabsTrigger, { value: "first" }, "First")
        )
      )
    );
    expect(html).toContain('aria-orientation="vertical"');
  });
});

describe("code annotation boundaries", () => {
  it("preserves diff proportions when finite counts overflow their sum", () => {
    const html = renderToStaticMarkup(
      createElement(DiffStat, { adds: 1e308, dels: 1e308 })
    );
    expect(html.match(/width:50%/gu)).toHaveLength(2);
  });

  it("bounds diff bar widths for negative counts", () => {
    const html = renderToStaticMarkup(
      createElement(DiffStat, { adds: -1, dels: 2 })
    );
    expect(html).not.toMatch(/width:-/u);
    expect(html).toContain("width:100%");
  });

  it("recognizes Windows directory names with trailing separators", () => {
    expect(folderIcon("project\\src\\")).toBe(folderIcon("project/src/"));
  });

  it.each(["9".repeat(400), `${"9".repeat(306)}s`, `${"9".repeat(304)}m`])(
    "rejects duration overflow (%s)",
    (value) => {
      expect(parseDuration(value)).toBeUndefined();
    }
  );

  it.each([
    "[null]",
    "[[null]]",
    "[[[1]]]",
    "[[[[null]]]]",
    '[[[[{"t":1}]]]]',
    '[[[[{"t":"x","s":1}]]]]',
  ])("discards malformed highlighting payloads: %s", (raw) => {
    expect(parseDiffHl(raw)).toBeUndefined();
  });

  it("preserves valid highlighting and plain rows", () => {
    const highlights = [[[[{ s: "--shiki-light:#fff", t: "x" }], null]]];
    expect(parseDiffHl(JSON.stringify(highlights))).toStrictEqual(highlights);
  });

  it.each(["9".repeat(400), `1-${"9".repeat(400)}`, "9007199254740992"])(
    "rejects unrepresentable line ranges: %s",
    (range) => {
      expect(parseLineRange(range)).toBeUndefined();
    }
  );
});
