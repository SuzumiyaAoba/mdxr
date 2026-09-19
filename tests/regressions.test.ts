import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createElement, Fragment } from "react";
import type { ReactElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

import { mergeUserComponents } from "../src/component-map.js";
import { ChartStyle } from "../src/components/ui/chart.js";
import type { AnyComponent } from "../src/define.js";
import type { DocContextValue } from "../src/doc-context.js";
import { DocContext } from "../src/doc-context.js";
import { isComponent, safeHref } from "../src/guards.js";
import { htmlDocument } from "../src/html.js";
import { langForPath } from "../src/langs.js";
import { importBundledCode } from "../src/load-user-module.js";
import { mdxToHtml } from "../src/mdx.js";
import { render } from "../src/render.js";
import { buildCss } from "../src/tailwind.js";
import { edgeLabelSize } from "../src/ui/graph-layout.js";
import { builtinComponents } from "../src/ui/index.js";
import { PlanHeader } from "../src/ui/plan.js";
import { renderDoc } from "./helpers.js";

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

// Static markup for substring assertions — see tests/helpers.ts.
const ssr = renderDoc;

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

describe(langForPath, () => {
  it("treats backslashes as separators like fileIcon does", () => {
    // fileIcon split on /[\\/]/ but langForPath only split "/", so a
    // Windows-style path got an icon yet no grammar.
    expect(langForPath("src\\lang\\x.ts")).toBe("typescript");
    expect(langForPath("C:\\proj\\Makefile")).toBe("makefile");
    expect(langForPath("a/b/c.py")).toBe("python");
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

  it("reserves space for edge labels so chips clear the nodes", async () => {
    // Edge labels used to sit at the route midpoint with no room reserved —
    // a chip wider than the rank channel landed on top of neighboring nodes.
    const { body } = await ssr(
      '<Graph direction="right"><Node id="a" label="alpha" /><Node id="b" label="beta" /><Node id="c" label="gamma" /><Edge from="a" to="b" label="static markup" /><Edge from="a" to="c" label="runtime deps" /></Graph>'
    );
    const boxes = [
      ...body.matchAll(
        /class="absolute" style="height:(?<h>[\d.]+)px;left:(?<x>[\d.]+)px;top:(?<y>[\d.]+)px;width:(?<w>[\d.]+)px"/gu
      ),
    ].map((m) => ({
      h: Number(m.groups?.h),
      w: Number(m.groups?.w),
      x: Number(m.groups?.x),
      y: Number(m.groups?.y),
    }));
    const chips = [
      ...body.matchAll(
        /whitespace-nowrap shadow-sm" style="left:(?<x>[\d.]+)px;top:(?<y>[\d.]+)px">(?<t>[^<]+)/gu
      ),
    ].map((m) => ({
      t: m.groups?.t ?? "",
      x: Number(m.groups?.x),
      y: Number(m.groups?.y),
    }));
    expect(chips).toHaveLength(2);
    for (const c of chips) {
      const { height: h, width: w } = edgeLabelSize(c.t);
      for (const b of boxes) {
        const hit =
          c.x - w / 2 < b.x + b.w &&
          c.x + w / 2 > b.x &&
          c.y - h / 2 < b.y + b.h &&
          c.y + h / 2 > b.y;
        expect(hit).toBeFalsy();
      }
    }
  });
});

describe("Gantt", () => {
  it("treats explicit start/end as hard bounds, not seeds", async () => {
    // "start/end で表示範囲を上書き" — child dates used to extend the
    // explicit range, so a June task defeated a March-only zoom.
    const { body } = await ssr(
      '<Gantt title="Q" start="2025-03-01" end="2025-03-31"><Task name="in" start="2025-03-05" end="2025-03-10"/><Task name="out" start="2025-06-01" end="2025-06-10"/></Gantt>'
    );
    // The caption prints the resolved range; it must stay inside March.
    expect(body).toContain("Mar 1 – Mar 31, 2025");
    expect(body).not.toContain("Mar 1 – Jun 10, 2025");
  });

  it("does not let an inverted task end pull the range backwards", async () => {
    // Task renders end<start clamped to start (a one-day bar); the range
    // collector pushed the raw earlier end, stretching the axis months wide.
    const { body } = await ssr(
      '<Gantt><Task name="t" start="2025-06-10" end="2025-01-01"/></Gantt>'
    );
    // Correct range: a single day → no month ticks at all.
    expect(body).toContain("Jun 10");
    expect(body).not.toContain("Feb");
    expect(body).not.toContain("Mar");
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

  it("normalizes frontmatter status case; unknown values warn, not crash", async () => {
    const dir = await makeDir();
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      // "Doing" used to hit StatusBadge's picklist and fail the whole
      // document render — frontmatter is metadata, not a JSX prop.
      const good = await render("---\ntitle: T\nstatus: Doing\n---\n\nbody", {
        dir,
      });
      expect(good).toContain("In progress");
      expect(spy.mock.calls.flat().join("")).not.toContain(
        "frontmatter status"
      );

      spy.mockClear();
      const bad = await render("---\ntitle: T\nstatus: wip\n---\n\nbody", {
        dir,
      });
      expect(bad).toContain("<h1");
      expect(spy.mock.calls.flat().join("")).toContain(
        'frontmatter status "wip"'
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("anchors a relative filePath to dir, not cwd", async () => {
    const dir = await makeDir();
    await mkdir(path.join(dir, "sub"));
    await writeFile(path.join(dir, "sub", "real.ts"), "x\n");
    // "<stdin>" has no directory of its own — `dir` is the documented base
    // for file lookups; resolving against cwd silently dropped the link.
    const html = await render("`sub/real.ts`", { dir, filePath: "<stdin>" });
    expect(html).toContain("vscode://file/");
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

const ASK_DOC = `<Ask title="Decisions">
  <Question name="a" label="Pick" type="choice">
    <Choice value="x">X</Choice>
    <Choice value="y" checked>Y</Choice>
  </Question>
</Ask>
`;

// The exact tree mountDocument hydrates on the client.
const clientTree = (
  ctx: DocContextValue,
  doc: AnyComponent,
  header: ReactElement | null
): string =>
  renderToString(
    createElement(
      DocContext.Provider,
      { value: ctx },
      createElement(
        Fragment,
        null,
        header,
        createElement(doc, { components: builtinComponents })
      )
    )
  );

const docComponent = async (code: string): Promise<AnyComponent> => {
  const mod = await importBundledCode(code, "doc");
  if (!isComponent(mod.default)) {
    throw new Error("compiled doc has no default component");
  }
  return mod.default;
};

// useId-derived attributes: element ids, radio names, htmlFor.
const uidAttrs = (html: string): string[] =>
  [
    ...html.matchAll(
      /(?:id|name|for)="(?<attr>[^"]*mdxr-q[^"]*|[^"]*_R_[^"]*)"/gu
    ),
  ].map((m) => m.groups?.attr ?? "");

const askSheetOf = async (doc: string): Promise<string | undefined> => {
  const { body } = await mdxToHtml(doc, builtinComponents, "doc.mdx", {
    hydrate: false,
  });
  return /data-ask-output[^>]*>(?<sheet>[\s\S]*?)<\/pre>/u.exec(body)?.groups
    ?.sheet;
};

describe("hydration vnode parity", () => {
  it("SSR body matches the client tree when no header exists", async () => {
    const r = await mdxToHtml(ASK_DOC, builtinComponents, "doc.mdx", {
      hydrate: true,
    });
    expect(r.hydrated).toBeTruthy();
    const doc = await docComponent(r.code);
    expect(clientTree(r.context, doc, null)).toBe(r.body);
    // Radio names carry the useId() suffix — they must exist and match.
    expect(r.body).toContain('name="a_R_');
  });

  it("renderWithHeader matches the client tree with a frontmatter header", async () => {
    const r = await mdxToHtml(ASK_DOC, builtinComponents, "doc.mdx", {
      hydrate: true,
    });
    const doc = await docComponent(r.code);
    const headerProps = { status: "doing", title: "My Plan" };
    const pass = r.renderWithHeader(createElement(PlanHeader, headerProps));
    const client = clientTree(
      r.context,
      doc,
      createElement(PlanHeader, headerProps)
    );
    expect(client).toBe(pass.html);
    // ids must be identical whether or not the header was prepended.
    expect(uidAttrs(pass.html)).toStrictEqual(uidAttrs(client));
    expect(uidAttrs(pass.html).length).toBeGreaterThan(0);
  });

  it("render() ships markup identical to the hydrated tree", async () => {
    const dir = await makeDir();
    const src = `---\ntitle: My Plan\n---\n\n${ASK_DOC}`;
    const [html, r] = await Promise.all([
      render(src, { dir, hydrate: true }),
      mdxToHtml(src, builtinComponents, path.join(dir, "document.mdx"), {
        hydrate: true,
      }),
    ]);
    const doc = await docComponent(r.code);
    const headerProps = { title: "My Plan" };
    const pass = r.renderWithHeader(createElement(PlanHeader, headerProps));
    const mainStart = html.indexOf('id="mdxr-root"');
    const open = html.indexOf(">", mainStart) + 1;
    const inner = html.slice(open, html.lastIndexOf("</main>"));
    expect(inner).toBe(pass.html);
    expect(inner).toBe(
      clientTree(r.context, doc, createElement(PlanHeader, headerProps))
    );
  });
});

/**
 * The answer sheet used to be rendered only by client JS after SSR emitted a
 * placeholder — the pre-hydration seed then disagreed with the vnode tree and
 * hydrateRoot patched the pane back. SSR now emits the seeded sheet itself,
 * so both sides render the same text.
 */
describe("Ask SSR-seeded answer sheet", () => {
  it("renders default answers for every question type", async () => {
    const sheet = await askSheetOf(`<Ask title="Decisions">
  <Question name="arch" label="Architecture" type="choice">
    <Choice value="mono">Monolith</Choice>
    <Choice value="micro" checked>Microservices</Choice>
  </Question>
  <Question name="tags" type="multi" label="Tags">
    <Choice value="a" checked>Alpha</Choice>
    <Choice value="b">Beta</Choice>
    <Choice value="c" checked>Gamma</Choice>
  </Question>
  <Question name="lang" type="select" label="Lang">
    <Choice value="ts">TypeScript</Choice>
    <Choice value="rs" checked>Rust</Choice>
  </Question>
  <Question name="pick" type="select" label="Pick" placeholder="choose one">
    <Choice value="x">X</Choice>
  </Question>
  <Question name="first" type="select" label="Defaulted">
    <Choice value="d1">First option</Choice>
    <Choice value="d2">Second</Choice>
  </Question>
  <Question name="flag" type="toggle" checked label="Enabled" />
  <Question name="off" type="toggle" label="Disabled" />
  <Question name="note" type="text" value="draft notes" label="Note" />
  <Question name="empty" type="text" label="Blank" />
  <Question name="ml" type="textarea" value="line1&#10;line2" label="Multi" />
  <Question name="emptyv" type="select" label="EmptyVal">
    <Choice value="" checked>Nothing</Choice>
    <Choice value="v">Vee</Choice>
  </Question>
</Ask>`);
    expect(sheet).toBe(
      "# Decisions\n\n" +
        "- **Architecture**: Microservices\n" +
        "- **Tags**: Alpha, Gamma\n" +
        "- **Lang**: Rust\n" +
        "- **Pick**:\n" +
        "- **Defaulted**: First option\n" +
        "- **Enabled**: yes\n" +
        "- **Disabled**: no\n" +
        "- **Note**: draft notes\n" +
        "- **Blank**:\n" +
        "- **Multi**: line1\n  line2\n" +
        "- **EmptyVal**:"
    );
  });

  it("escapes labels and falls back to the question name", async () => {
    const sheet = await askSheetOf(`<Ask>
  <Question name="q*star" type="choice">
    <Choice value="x" checked>Yes</Choice>
  </Question>
</Ask>`);
    expect(sheet).toBe("# Answers\n\n- **q\\*star**: Yes");
  });

  it("renders the no-questions fallback", async () => {
    const sheet = await askSheetOf('<Ask title="Empty" />');
    expect(sheet).toBe("# Empty\n\n(no questions)");
  });
});
