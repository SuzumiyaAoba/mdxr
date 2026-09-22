import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import { exportIndex, runtimeModuleContents } from "../src/hydrate.js";
import { scanMdxrImports } from "../src/hydrate/import-scan.js";
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
 * The virtual package module must mirror the real package's
 * export surface per specifier, or the hydration bundle would resolve names
 * SSR bound to `undefined` (or vice versa) — a silent server/client split.
 */
describe("hydrate module surface", () => {
  it("the root entry exposes only its config API — no catalog or internals", async () => {
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
    // neither exists on the real root entry.
    expect(code).not.toContain("Plan");
    expect(code).not.toContain("mountDocument");
  });

  it("the components entry exposes the catalog but not the root-only API", async () => {
    const { map, surfaces } = await exportIndex();
    const code = runtimeModuleContents(
      map,
      { names: "all", vProps: "all" },
      surfaces.components
    );
    expect(code).toContain("Plan");
    expect(code).toContain("buttonVariants");
    expect(code).toContain("builtinComponents");
    // defineConfig/v/mountDocument don't exist on `/components` — SSR
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
    // fileIcon is a leaf internal — the real `/components` doesn't export it.
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

/**
 * `export { v } from "@suzumiyaaoba/mdxr"` hands the whole valibot namespace to consumers —
 * the per-prop access scan would ship `export const v = {}` while SSR binds
 * the real namespace, so a re-export must force `"all"`.
 */
describe(scanMdxrImports, () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(
      dirs.map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
  });

  const scan = async (source: string) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-scan-"));
    dirs.push(dir);
    const f = path.join(dir, "comp.ts");
    await writeFile(f, source);
    return await scanMdxrImports(f);
  };

  it("re-exported `v` escapes — ships the whole namespace", async () => {
    const results = await Promise.all(
      [
        'export { v } from "@suzumiyaaoba/mdxr";',
        'export { v as schemas } from "@suzumiyaaoba/mdxr";',
        'export { v, Plan } from "@suzumiyaaoba/mdxr";',
      ].map(async (src) => {
        const r = await scan(src);
        return r.vProps;
      })
    );
    for (const vProps of results) {
      expect(vProps).toBe("all");
    }
  });

  it("imported `v` still scans only accessed props", async () => {
    const { vProps } = await scan(
      'import { v } from "@suzumiyaaoba/mdxr";\nexport const s = v.string();\n'
    );
    expect(vProps).toStrictEqual(new Set(["string"]));
  });

  it.each(["$v", "v$", "検証"])(
    "scans valid JavaScript namespace aliases: %s",
    async (alias) => {
      const { vProps } = await scan(
        `import { v as ${alias} } from "@suzumiyaaoba/mdxr";\nexport const s = ${alias}.string();`
      );
      expect(vProps).toStrictEqual(new Set(["string"]));
    }
  );

  it("keeps dynamic accesses to dollar-prefixed namespaces", async () => {
    const { vProps } = await scan(
      'import { v as $v } from "@suzumiyaaoba/mdxr";\nexport const s = $v[key];'
    );
    expect(vProps).toBe("all");
  });

  it("component re-exports don't force valibot", async () => {
    const { names, vProps } = await scan(
      'export { Plan } from "@suzumiyaaoba/mdxr/components";'
    );
    expect(names).toStrictEqual(new Set(["Plan"]));
    expect(vProps).toBeNull();
  });

  it("comment delimiters inside an import clause don't hide the import", async () => {
    const { names, vProps } = await scan(
      [
        "import {",
        "  Plan, // don't drop; needed",
        '  v, /* say "hi"; still v */',
        '} from "@suzumiyaaoba/mdxr";',
        "export const s = v.string();",
      ].join("\n")
    );
    expect(names).toStrictEqual(new Set(["Plan", "v"]));
    expect(vProps).toStrictEqual(new Set(["string"]));
  });

  it("comments between `}` and `from` don't corrupt the clause", async () => {
    const { names } = await scan(
      'import { Plan } /* keep; "this" */ from "@suzumiyaaoba/mdxr/components";'
    );
    expect(names).toStrictEqual(new Set(["Plan"]));
  });

  it("commented bare/dynamic imports still count as full-surface", async () => {
    const bare = await scan(
      'import /* side effect */ "@suzumiyaaoba/mdxr/components";'
    );
    expect(bare.names).toBe("all");
    expect(bare.vProps).toBe("all");
    const dyn = await scan(
      'const m = await import /* lazy */ ("@suzumiyaaoba/mdxr");'
    );
    expect(dyn.names).toBe("all");
    expect(dyn.vProps).toBe("all");
  });

  it("type-only imports contribute no runtime names", async () => {
    const { names, vProps } = await scan(
      [
        'import type { Plan } from "@suzumiyaaoba/mdxr/components";',
        'export type { v } from "@suzumiyaaoba/mdxr";',
        'import { Icon } from "@suzumiyaaoba/mdxr/components";',
      ].join("\n")
    );
    expect(names).toStrictEqual(new Set(["Icon"]));
    expect(vProps).toBeNull();
  });
});
