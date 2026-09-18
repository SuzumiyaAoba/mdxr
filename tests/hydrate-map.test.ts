import { describe, expect, it, vi } from "vitest";

import { render } from "../src/render.js";

const DOC = `# Smoke

<Files title="Files">
  <File path="src/index.ts" lines="1-10" kind="entry">entry point</File>
</Files>

<Deps>
  <Dep kind="calls" from="a.ts" to="b.ts">main pipeline</Dep>
</Deps>

<Flow>
  <FlowStep name="parse" path="src/mdx.ts">compile</FlowStep>
</Flow>

<Ask title="Questions">
  <Question name="q1" type="select" label="Pick">
    <Choice value="a">Alpha</Choice>
  </Question>
</Ask>

<Graph>
  <Node id="a" label="A" />
  <Node id="b" label="B" />
  <Edge from="a" to="b" kind="calls" />
</Graph>

<Toc />

<Json value='{"a":1}' />

<Glossary>
  <Term name="MDX">markdown jsx</Term>
</Glossary>
`;

describe("hydration bundle", () => {
  it("binds every used catalog export (leaf scan incl. re-exports)", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    let html = "";
    let warnings = "";
    try {
      html = await render(DOC, { hydrate: true });
      warnings = spy.mock.calls.flat().join("");
    } finally {
      spy.mockRestore();
    }
    expect(html).toContain("hydrateRoot");
    expect(warnings).not.toContain("no module provides");
    expect(warnings).not.toContain("hydration bundle");
  });
});
