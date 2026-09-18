import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

import { mergeUserComponents } from "../src/component-map.js";
import { ChartStyle } from "../src/components/ui/chart.js";
import { isComponent, safeHref } from "../src/guards.js";
import { htmlDocument } from "../src/html.js";
import { mdxToHtml } from "../src/mdx.js";
import { render } from "../src/render.js";
import { buildCss } from "../src/tailwind.js";
import { builtinComponents } from "../src/ui/index.js";

const tmpDirs: string[] = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-reg-"));
  tmpDirs.push(dir);
  return dir;
};

const cleanTmpDirs = async (): Promise<void> => {
  await Promise.all(
    tmpDirs.map(async (d) => {
      await rm(d, { force: true, recursive: true });
    })
  );
};

// Static markup for substring assertions — see render.test.ts's helper.
const ssr = async (src: string) =>
  await mdxToHtml(src, builtinComponents, "document.mdx", { hydrate: false });

describe("remarkNoJs attribute expressions", () => {
  it("rejects expression attribute values prop={expr}", async () => {
    await expect(ssr('<Callout kind={"tip"}>x</Callout>')).rejects.toThrow(
      /not allowed/u
    );
  });

  it("rejects spread attributes {...obj}", async () => {
    await expect(ssr("<Callout {...props}>x</Callout>")).rejects.toThrow(
      /not allowed/u
    );
  });

  it("still accepts plain string attributes", async () => {
    const { body } = await ssr('<Callout kind="tip">x</Callout>');
    expect(body).toContain("Tip");
  });
});

describe(isComponent, () => {
  it("accepts functions and React wrapper objects (memo/forwardRef/lazy)", () => {
    expect(isComponent(() => null)).toBeTruthy();
    for (const tag of ["react.memo", "react.forward_ref", "react.lazy"]) {
      expect(isComponent({ $$typeof: Symbol.for(tag) })).toBeTruthy();
    }
  });

  it("rejects plain objects and non-component values", () => {
    expect(isComponent({})).toBeFalsy();
    expect(isComponent({ $$typeof: "react.memo" })).toBeFalsy();
    expect(isComponent({ $$typeof: Symbol.for("react.element") })).toBeFalsy();
    expect(isComponent(null)).toBeFalsy();
    expect(isComponent("Card")).toBeFalsy();
  });
});

const ProtoComp = () => null;

describe(mergeUserComponents, () => {
  it("merges PascalCase exports that are memo/forwardRef objects", () => {
    const MemoCard = { $$typeof: Symbol.for("react.memo"), type: () => null };
    const map = mergeUserComponents({
      MemoCard,
      NotAComponent: { render: () => null },
      lowercase: () => null,
    });
    expect(map.MemoCard).toBe(MemoCard);
    expect(map).not.toHaveProperty("NotAComponent");
    expect(map).not.toHaveProperty("lowercase");
  });

  it("keeps __proto__ as a data key instead of mutating the map's prototype", () => {
    // `into["__proto__"] = comp` assigns the *prototype*, not an own property:
    // the component would silently vanish and the map's prototype would change.
    const source: Record<string, unknown> = {};
    Object.defineProperty(source, "__proto__", {
      enumerable: true,
      value: ProtoComp,
    });
    const map = mergeUserComponents({ default: source });
    expect(Object.getOwnPropertyDescriptor(map, "__proto__")?.value).toBe(
      ProtoComp
    );
    expect(Object.getPrototypeOf(map)).toBe(Object.prototype);
  });
});

describe("heading slugs", () => {
  it("includes inlineCode text in the generated slug", async () => {
    const { body } = await ssr("## Getting `setup` done");
    expect(body).toContain('id="getting-setup-done"');
  });

  it("keeps ids unique when a suffixed slug hits a literal slug", async () => {
    // a, a, a-1, a → the 3rd heading's literal slug "a-1" collides with the
    // 2nd's suffixed slug; every id must still be distinct for #links.
    const { body } = await ssr("## a\n\n## a\n\n## a-1\n\n## a\n");
    const ids = [...body.matchAll(/<h2 id="(?<id>[^"]+)"/gu)].map(
      (m) => m.groups?.id
    );
    expect(ids).toStrictEqual(["a", "a-1", "a-1-1", "a-2"]);
  });
});

describe("Summary", () => {
  it("renders unparseable done/total as 0, never NaN", async () => {
    const { body } = await ssr('<Summary done="x" total="y" />');
    expect(body).not.toContain("NaN");
    expect(body).toContain("0/0");
    expect(body).toContain("width:0%");
  });
});

describe("prototype-named inputs", () => {
  it('falls back to generic styling for File kind="toString"', async () => {
    // A bare KINDS[kind] index pulled Object.prototype.toString — `r.icon`
    // became undefined and <Icon name={undefined}> crashed the render.
    const { body } = await ssr('<File kind="toString" path="x.ts" />');
    expect(body).toContain("toString");
  });

  it("renders an unknown-language fence without touching prototype members", async () => {
    // ```toString must not hand Object.prototype.toString to loadLanguage.
    const { body } = await ssr("```toString\nx\n```");
    expect(body).toContain("x");
  });

  it("renders Matrix cells named constructor/toString as plain text", async () => {
    // CELL_KINDS[key] must not read prototype members — "constructor" is a
    // data value, not an icon kind.
    const { body } = await ssr(
      "<Matrix>\n\n- F | constructor | toString\n\n</Matrix>"
    );
    expect(body).toContain("constructor");
    expect(body).toContain("toString");
  });
});

describe(safeHref, () => {
  it("rejects dangerous schemes hidden behind browser-stripped chars", () => {
    // URL parsers drop \t\n\r anywhere and C0 controls/spaces at the edges —
    // every variant below still resolves to javascript:/data: once loaded.
    /* oxlint-disable no-script-url -- the probes are the attack */
    const dangerous = [
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "\u0001javascript:alert(1)",
      "javascript:alert(1)\u0000",
      "JAVASCRIPT:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "file:///etc/passwd",
    ];
    /* oxlint-enable no-script-url */
    expect(dangerous.filter((h) => safeHref(h) !== undefined)).toStrictEqual(
      []
    );
  });

  it("allows web schemes and scheme-less URLs", () => {
    const allowed = [
      "https://a.b/c",
      "HTTP://a.b",
      "mailto:a@b.c",
      "tel:+123",
      "/rel/path",
      "./sib.md",
      "#frag",
      "//cdn.x/y",
    ];
    expect(allowed.map((h) => safeHref(h))).toStrictEqual(allowed);
  });

  it("returns undefined for empty and non-string input", () => {
    const missing: Record<string, string> = {};
    const bad = ["", missing.x, 42, null];
    expect(bad.map((h) => safeHref(h))).toStrictEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("repo chip links", () => {
  it("rejects a non-http scheme in a repo URL", async () => {
    // `repo` with "://" used to land in href unchecked — a `javascript:`
    // repo must degrade to a github.com path, never reach the anchor.
    const { body } = await ssr(
      /* oxlint-disable-next-line no-script-url -- the probe is the attack */
      '<Issue repo="javascript:alert(1)//x" number="1" />'
    );
    const href = /href="(?<h>[^"]*)"/u.exec(body)?.groups?.h;
    expect(href?.startsWith("https://github.com/")).toBeTruthy();
  });
});

describe("editor links", () => {
  afterAll(cleanTmpDirs);

  it("never mints a scriptable href from frontmatter `editor:`", async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, "real.ts"), "x\n");
    // `editor` is document input — a FileRef (auto-linked inline code) used
    // to emit `href="javascript://file/…"` from this value unchecked.
    /* oxlint-disable no-script-url -- the probes are the attack */
    const { body } = await mdxToHtml(
      "---\neditor: javascript\n---\n\n`real.ts`\n",
      builtinComponents,
      path.join(dir, "document.mdx"),
      { hydrate: false }
    );
    expect(body).not.toContain("javascript:");
    /* oxlint-enable no-script-url */
    expect(body).not.toContain("<a");
    expect(body).toContain("real.ts");
  });
});

describe("Ask questions", () => {
  it("a text child does not flip a question into choice mode", async () => {
    // Default inference is "has <Choice> children", not "has children" —
    // explanatory text under a text question used to render a fieldset of
    // zero radios instead of a text input.
    const { body } = await ssr(
      '<Ask><Question name="q">why the change?</Question></Ask>'
    );
    expect(body).toContain('data-q-type="text"');
    expect(body).not.toContain('type="radio"');
  });

  it("same-named choice questions get distinct radio groups", async () => {
    const { body } = await ssr(
      '<Ask><Question name="q"><Choice value="a">A</Choice><Choice value="b">B</Choice></Question><Question name="q"><Choice value="c">C</Choice><Choice value="d">D</Choice></Question></Ask>'
    );
    const names = [...body.matchAll(/<input\b[^>]*type="radio"[^>]*>/gu)].map(
      (t) => /name="(?<n>[^"]*)"/u.exec(t[0])?.groups?.n
    );
    expect(names).toHaveLength(4);
    // Radios sharing a name form one browser group — duplicates would clobber
    // each other's selection, so each question must namespace its own.
    expect(new Set(names).size).toBe(2);
    expect(
      names.every((n) => typeof n === "string" && n.startsWith("q"))
    ).toBeTruthy();
  });
});

describe("code fences", () => {
  it("reads single-quoted title meta", async () => {
    const { body } = await ssr("```ts title='weird name.ts'\nx\n```");
    expect(body).toContain("weird name.ts");
  });

  it("ignores title-ish substrings in other meta keys", async () => {
    // `data-title=` must not be mistaken for a `title=` filename header.
    const { body } = await ssr('```ts data-title="leak.ts"\nx\n```');
    expect(body).not.toContain("leak.ts");
  });

  it("renders an empty ```diff fence as a code block, not a blank diff", async () => {
    const { body } = await ssr("```diff\n```");
    expect(body).not.toContain("Copy diff");
    expect(body).not.toContain("grid-cols-[2.5rem_2.5rem");
  });
});

describe("Graph", () => {
  it("deduplicates repeated node ids (first wins)", async () => {
    const { body } = await ssr(
      '<Graph><Node id="a" label="First" /><Node id="a" label="Dupe" /><Node id="b" label="B" /></Graph>'
    );
    expect(body).toContain("First");
    expect(body).not.toContain("Dupe");
  });
});

describe(htmlDocument, () => {
  it("escapes a literal </style inside inlined CSS", () => {
    const html = htmlDocument({
      body: "",
      clientJs: "",
      css: '.x::after{content:"</style>"}',
      needsMermaid: false,
      title: "t",
    });
    expect(html).not.toContain('content:"</style>"');
    expect(html).toContain("content:");
  });
});

describe(ChartStyle, () => {
  it("neutralizes </style> breakouts in the id, config keys, and colors", () => {
    // Config keys/values reach a raw <style> element — a `</style>` sequence
    // would end the element early regardless of CSS string quoting.
    const html = renderToStaticMarkup(
      createElement(ChartStyle, {
        config: {
          'a";</style><script>alert(1)</script>': {
            color: "red;</style><script>",
          },
        },
        id: 'c"></style><script>',
      })
    );
    expect(html).not.toContain("<script");
    // Exactly one closing tag: the element's own — nothing broke out.
    expect(html.match(/<\/style/gu)).toHaveLength(1);
    // Sanitized identifiers/values still emit the custom property.
    expect(html).toContain("--color-");
  });
});

describe(render, () => {
  afterAll(cleanTmpDirs);

  it("accepts numeric frontmatter titles", async () => {
    const dir = await makeDir();
    const html = await render("---\ntitle: 42\n---\n\nbody", { dir });
    expect(html).toContain("<title>42</title>");
  });

  it("extracts the title from an h1 containing inline elements", async () => {
    const dir = await makeDir();
    // `<code>` inside the h1 must not truncate the extracted title, and the
    // `&` must round-trip through React's entity escaping exactly once.
    const html = await render("# Hello `x` — A & B\n\nbody", { dir });
    expect(html).toContain("<title>Hello x — A &amp; B</title>");
    // The old extractor stopped at the first inline tag: "Hello " alone.
    expect(html).not.toContain("<title>Hello</title>");
  });

  it("embeds the SSR timestamp so hydration replays the same `now`", async () => {
    const dir = await makeDir();
    const html = await render('<Due date="2999-01-01" />', { dir });
    // The hydrate spec carries `now` — Due's relative label then renders
    // identically on server and client.
    expect(html).toMatch(/now:"20\d\d-/u);
    expect(html).toMatch(/in \d+d/u);
  });

  it("reports theme files and their nested @imports as dependencies", async () => {
    const dir = await makeDir();
    const themeDir = path.join(dir, "theme");
    await mkdir(themeDir);
    const nested = path.join(themeDir, "nested.css");
    const theme = path.join(themeDir, "theme.css");
    await writeFile(nested, ".nested-marker{--x:1}\n");
    await writeFile(theme, '@import "./nested.css";\n');
    const { css, dependencies } = await buildCss(
      [{ content: '<div class="nested-marker"></div>', extension: "html" }],
      theme
    );
    expect(dependencies).toContain(theme);
    expect(dependencies).toContain(nested);
    expect(css).toContain("nested-marker");
  });
});

describe("hydrate import scan", () => {
  afterAll(cleanTmpDirs);

  it('handles `import{v}from"mdxr"` with no spaces', async () => {
    const dir = await makeDir();
    await writeFile(
      path.join(dir, "mdxr.config.ts"),
      'export default { components: "./components.tsx" };\n'
    );
    await writeFile(
      path.join(dir, "components.tsx"),
      `import{v,defineComponent}from"mdxr";
export const Flag = defineComponent(
  { schema: v.looseObject({ t: v.optional(v.string()) }) },
  ({ t }) => <i data-flag>{t}</i>
);
`
    );
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    let html = "";
    let warnings = "";
    try {
      html = await render('<Flag t="on" />', { dir });
      warnings = spy.mock.calls.flat().join("");
    } finally {
      spy.mockRestore();
    }
    expect(warnings).not.toContain("hydration bundle skipped");
    expect(html).toContain("hydrateRoot");
    expect(html).toContain("data-flag");
  });

  it("ignores comments inside the import clause", async () => {
    const dir = await makeDir();
    await writeFile(
      path.join(dir, "mdxr.config.ts"),
      'export default { components: "./components.tsx" };\n'
    );
    // A comment inside the braces is legal JS — it must not pollute the
    // parsed import names and fail the hydration build.
    await writeFile(
      path.join(dir, "components.tsx"),
      `import {
  defineComponent, /* wraps + validates */
  v,
} from "mdxr";
export const Note = defineComponent(
  { schema: v.looseObject({ t: v.optional(v.string()) }) },
  ({ t }) => <i data-note>{t}</i>
);
`
    );
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    let html = "";
    let warnings = "";
    try {
      html = await render('<Note t="ok" />', { dir });
      warnings = spy.mock.calls.flat().join("");
    } finally {
      spy.mockRestore();
    }
    expect(warnings).not.toContain("hydration bundle skipped");
    expect(html).toContain("hydrateRoot");
    expect(html).toContain("data-note");
  });
});
