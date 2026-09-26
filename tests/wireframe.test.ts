import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { catalogEntries } from "../src/catalog.js";
import { exportIndex } from "../src/hydrate/export-index.js";
import { buildCss } from "../src/tailwind.js";
import { WireframeFieldError } from "../src/ui/wireframe-library-file.js";
import registry from "../src/wireframe/registry.json";
import { renderDoc } from "./helpers.js";

describe("wireframe-ui document components", () => {
  it("renders the catalog examples without imports and preserves existing Card components", async () => {
    const source = await readFile("examples/catalog/wireframe.mdx", "utf-8");
    const { body } = await renderDoc(
      `${source}\n\n<Card><CardContent>Existing card</CardContent></Card>`
    );
    expect(body.match(/data-slot="wireframe"/gu)).toHaveLength(4);
    expect(body).toContain("Welcome back");
    expect(body).toContain("Existing card");
    expect(body).toContain('data-device="mobile"');
    expect(body).toContain('data-slot="wireframe-card-action"');
  });

  it("accepts numeric strings and applies placeholder semantics", async () => {
    const { body } = await renderDoc(
      '<WireframeHeading level="3" label="Title" /><WireframeParagraph lines="2" lastLineWidth="sm" /><WireframeList items="2" variant="number" /><WireframeMedia type="audio" label="Audio preview" />'
    );
    for (const content of [
      "<h3",
      "<ol",
      'aria-label="Audio preview"',
      'data-type="audio"',
    ]) {
      expect(body).toContain(content);
    }
    expect(body.match(/<li /gu)).toHaveLength(2);
    expect(body.match(/data-slot="wireframe-text"/gu)).toHaveLength(5);
  });

  it.each([
    '<WireframeParagraph lines="-1" />',
    '<WireframeParagraph lines="2.5" />',
    '<WireframeParagraph lines="Infinity" />',
    '<WireframeList items="1000000" />',
    '<WireframeHeading level="7" />',
    '<WireframeTextarea rows="0" />',
    '<WireframeText width="unknown" />',
    '<Wireframe device="watch" />',
  ])("reports invalid document attributes: %s", async (source) => {
    await expect(renderDoc(source)).rejects.toThrow("Invalid props");
  });

  it("normalizes string booleans, preserves default values, and rejects unsafe links", async () => {
    const { body } = await renderDoc(
      '<WireframeInput label="Email" disabled="false" required="true" defaultValue="a@example.com" /><WireframeTextarea label="Notes" readOnly="false" rows="2" /><WireframeButton disabled="false" href="#next">Next</WireframeButton><WireframeButton href="data:text/html,test">Unsafe</WireframeButton><WireframeButton disabled="true" href="#next">Disabled</WireframeButton>'
    );
    for (const content of [
      'value="a@example.com"',
      'required=""',
      'type="button"',
    ]) {
      expect(body).toContain(content);
    }
    for (const content of ['readOnly=""', "data:text/html"]) {
      expect(body).not.toContain(content);
    }
    expect(body.match(/disabled=""/gu)).toHaveLength(1);
    expect(body.match(/href="#next"/gu)).toHaveLength(1);
  });

  it("keeps text color out of emphasized placeholders", async () => {
    const { body } = await renderDoc(
      '<WireframeText color="primary" emphasis="subtle" />'
    );
    expect(body).toContain("bg-muted-foreground/5");
    expect(body).not.toContain("bg-primary/20");
  });

  it("keeps heading anchors when placeholder content is replaced with real text", async () => {
    const { body } = await renderDoc(
      '<WireframeHeading id="screen-title" level="2">Screen title</WireframeHeading>'
    );
    expect(body).toMatch(/<h2[^>]*id="screen-title"/u);
    expect(body).toContain("Screen title");
  });

  it("validates chart configuration and rejects raw HTML in JSON tooltip props", async () => {
    await expect(
      renderDoc(`<WireframeChartStyle id="chart" config='{"series":null}' />`)
    ).rejects.toThrow("Invalid props");
    await expect(
      renderDoc(
        `<WireframeSidebarProvider><WireframeSidebarMenuButton tooltip='{"dangerouslySetInnerHTML":{"__html":"<b>unsafe</b>"}}'>Menu</WireframeSidebarMenuButton></WireframeSidebarProvider>`
      )
    ).rejects.toThrow("Raw HTML is not supported");
  });

  it("accepts missing entries in React Hook Form error arrays", () => {
    const html = renderToStaticMarkup(
      createElement(WireframeFieldError, {
        errors: [undefined, { message: "Email is required" }],
      })
    );
    expect(html).toContain("Email is required");
    expect(html).toContain('role="alert"');
  });

  it("exposes discoverable props and resolves all wireframe exports for hydration", async () => {
    const entries = catalogEntries().filter(({ name }) =>
      name.startsWith("Wireframe")
    );
    const publicComponents = await import("@suzumiyaaoba/mdxr/components");
    const { map, surfaces } = await exportIndex();
    expect(entries.map(({ name }) => name).toSorted()).toStrictEqual(
      [
        "Wireframe",
        "WireframeList",
        "WireframeChart",
        ...registry.families.flatMap(({ components }) =>
          components.map((name) => `Wireframe${name}`)
        ),
      ].toSorted()
    );
    expect(
      entries.find(({ name }) => name === "WireframeParagraph")?.props.lines
        .default
    ).toBe(3);
    for (const { name, description } of entries) {
      expect(description).toBeTruthy();
      expect(map.get(name)).toMatch(/wireframe-.*\.(?:tsx|js)$/u);
      expect({
        hydration: surfaces.components.has(name),
        public: Object.hasOwn(publicComponents, name),
      }).toStrictEqual({ hydration: true, public: true });
    }
  });

  it("embeds animations and responsive layouts in standalone CSS", async () => {
    const { body } = await renderDoc(
      '<Wireframe><WireframeSection variant="feature-grid" /><WireframeText animate="shimmer" /><WireframeText animate="typing" /></Wireframe>'
    );
    const { css } = await buildCss([{ content: body, extension: "html" }]);
    expect(css).toContain("@container wireframe");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain("mdxr-wireframe-shimmer");
    expect(css).toContain("mdxr-wireframe-typing");
  });

  it("retains screen labels, placeholder content, fields, and links in Markdown output", async () => {
    const { markdown, warnings } = await mdxToAscii(
      '<Wireframe title="Sign in"><WireframeCard><WireframeCardHeader><WireframeCardTitle>Welcome</WireframeCardTitle></WireframeCardHeader><WireframeCardContent><WireframeParagraph lines="2" /><WireframeMedia label="Logo" /><WireframeInput label="Email" defaultValue="a@example.com" /><WireframeButton href="#next">Next</WireframeButton></WireframeCardContent></WireframeCard></Wireframe>'
    );
    expect(warnings).toStrictEqual([]);
    for (const text of [
      "Sign in",
      "Welcome",
      "────────",
      "Logo",
      "Email",
      "a@example.com",
      "[Next](#next)",
    ]) {
      expect(markdown).toContain(text);
    }
    expect(markdown).not.toContain("<Wireframe");
  });
});
