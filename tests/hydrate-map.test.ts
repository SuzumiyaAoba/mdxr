import { describe, expect, it, vi } from "vitest";

import { exportIndex, runtimeModuleContents } from "../src/hydrate.js";
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

/**
 * The virtual `mdxr`/`mdxr/components` module must mirror the real package's
 * export surface per specifier, or the hydration bundle would resolve names
 * SSR bound to `undefined` (or vice versa) — a silent server/client split.
 */
describe("hydrate module surface", () => {
  it("`mdxr` exposes only its config API — no catalog or internals", async () => {
    const { map, surfaces } = await exportIndex();
    const code = runtimeModuleContents(
      map,
      { names: "all", vProps: "all" },
      surfaces.mdxr
    );
    for (const name of ["defineConfig", "builtinComponents", "DocContext"]) {
      expect(code).toContain(`{ ${name} }`);
    }
    expect(code).toContain('export * as v from "valibot"');
    // Plan is a catalog component; mountDocument is hydration plumbing —
    // neither exists on the real `mdxr` entry.
    expect(code).not.toContain("Plan");
    expect(code).not.toContain("mountDocument");
  });

  it("`mdxr/components` exposes the catalog but not the `mdxr`-only API", async () => {
    const { map, surfaces } = await exportIndex();
    const code = runtimeModuleContents(
      map,
      { names: "all", vProps: "all" },
      surfaces.components
    );
    expect(code).toContain("Plan");
    expect(code).toContain("buttonVariants");
    expect(code).toContain("builtinComponents");
    // defineConfig/v/mountDocument don't exist on `mdxr/components` — SSR
    // sees `undefined` for them, so the client must too.
    for (const absent of [
      "defineConfig",
      'as v from "valibot"',
      "mountDocument",
    ]) {
      expect(code).not.toContain(absent);
    }
  });

  it("drops named imports outside the specifier's surface", async () => {
    const { map, surfaces } = await exportIndex();
    // fileIcon is a leaf internal — real `mdxr/components` doesn't export it.
    const code = runtimeModuleContents(
      map,
      { names: new Set(["fileIcon", "Plan"]), vProps: null },
      surfaces.components
    );
    expect(code).not.toContain("fileIcon");
    expect(code).toContain("Plan");
  });

  it("every real export resolves to a module (no surface gaps)", async () => {
    const { map, surfaces } = await exportIndex();
    for (const surface of [surfaces.mdxr, surfaces.components]) {
      const code = runtimeModuleContents(
        map,
        { names: "all", vProps: "all" },
        surface
      );
      // A surface name with no module binding would vanish from the client
      // namespace while SSR still sees it — every surface name must emit.
      const emitted = new Set(
        [...code.matchAll(/export \{ (?<names>[^}]+) \}/gu)].flatMap((m) =>
          (m.groups?.names ?? "").split(",").map((n) => n.trim())
        )
      );
      // `v` is emitted as `export * as v`, not a named re-export.
      const missing = [...surface].filter((n) => n !== "v" && !emitted.has(n));
      expect(missing).toStrictEqual([]);
    }
  });
});
