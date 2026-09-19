import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
  transformerRemoveNotationEscape,
} from "@shikijs/transformers";
import type { Element, ElementContent, Root } from "hast";
import { createHighlighter } from "shiki";
import type { Highlighter, LanguageInput, ShikiTransformer } from "shiki";
import { visit } from "unist-util-visit";

import { isRecord, own } from "../guards.js";
import { langForPath, SKIP_LANGS } from "../langs.js";
import { fenceFilename, fenceLang } from "../lines.js";
import { parseDiff } from "../ui/diff-parse.js";
import type {
  DiffHl,
  DiffHlToken,
  DiffRow,
  FileDiff,
} from "../ui/diff-parse.js";

/**
 * Fenced code blocks are syntax-highlighted with shiki at render time.
 * `defaultColor: false` emits `--shiki-light`/`--shiki-dark` CSS variables on
 * every token span; BASE_CSS switches between them via prefers-color-scheme.
 * SKIP_LANGS (langs.ts) are left untouched: mermaid renders as a diagram,
 * terminal langs as a transcript, plain-text aliases stay cheap.
 */
const THEMES = { dark: "github-dark", light: "github-light" } as const;

/**
 * A middle ground between startup cost and coverage: grammars in this list are
 * loaded with the highlighter, anything else in shiki's bundle is loaded on
 * first use, and unknown names degrade to unhighlighted code.
 */
const PRELOADED_LANGS = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "dockerfile",
  "go",
  "graphql",
  "html",
  "ini",
  "java",
  "javascript",
  "json",
  "jsonc",
  "jsx",
  "kotlin",
  "lua",
  "markdown",
  "php",
  "python",
  "ruby",
  "rust",
  "scss",
  "shell",
  "sql",
  "swift",
  "toml",
  "tsx",
  "typescript",
  "xml",
  "yaml",
  "zsh",
] as const;

/**
 * Fence-meta tokens that turn line numbers on: ` ```ts ln ` (also accepts
 * `line-numbers` / `lineNumbers` / `showLineNumbers`).
 */
const LINE_NUMBER_RE =
  /(?:^|\s)(?:ln|line-numbers|lineNumbers|showLineNumbers)(?:\s|$)/u;

/**
 * Marks shiki's `<pre>` with `has-line-numbers` when the fence meta asks for
 * them; BASE_CSS draws the numbers with a counter so copy stays clean.
 */
const transformerLineNumbers: ShikiTransformer = {
  name: "mdxr:line-numbers",
  pre(node) {
    const raw = this.options.meta?.__raw ?? "";
    if (LINE_NUMBER_RE.test(raw)) {
      this.addClassToHast(node, "has-line-numbers");
    }
  },
};

/**
 * Transformers shared by every highlighted block. The notation set strips
 * `// [!code …]` markers from the output and tags lines/spans; the meta set
 * reads the fence info string (`{1,3-5}` line ranges, `/word/` matches).
 */
const TRANSFORMERS: ShikiTransformer[] = [
  transformerNotationDiff(),
  transformerNotationErrorLevel(),
  transformerNotationFocus(),
  transformerNotationHighlight(),
  transformerNotationWordHighlight(),
  transformerRemoveNotationEscape(),
  transformerMetaHighlight(),
  transformerMetaWordHighlight(),
  transformerLineNumbers,
];

let highlighterPromise: Promise<Highlighter> | undefined;

const getHighlighter = async (): Promise<Highlighter> => {
  highlighterPromise ??= createHighlighter({
    langs: [...PRELOADED_LANGS],
    themes: [THEMES.light, THEMES.dark],
  });
  try {
    return await highlighterPromise;
  } catch (error) {
    // A rejected promise would otherwise poison every later render in this
    // process — clear it so a transient init failure can retry.
    highlighterPromise = undefined;
    throw error;
  }
};

const DIFF_FENCE_LANGS: ReadonlySet<string> = new Set(["diff", "patch"]);

const isElement = (node: unknown): node is Element =>
  isRecord(node) && node.type === "element" && typeof node.tagName === "string";

/** mdast-sourced nodes use `className`; shiki's hast uses `class`. Read both. */
const classNames = (el: Element | undefined): string[] => {
  const c = el?.properties?.className ?? el?.properties?.class;
  if (typeof c === "string") {
    return c.split(/\s+/u).filter(Boolean);
  }
  return Array.isArray(c) ? c.map(String) : [];
};

const textContent = (node: Element | ElementContent): string => {
  if (node.type === "text") {
    return node.value;
  }
  return "children" in node ? node.children.map(textContent).join("") : "";
};

const languageOf = (code: Element): string | undefined =>
  /language-(?<lang>[^\s]+)/u.exec(classNames(code).join(" "))?.groups?.lang;

/** In-flight grammar loads, deduplicated across concurrent code blocks. */
const langLoads = new Map<string, Promise<boolean>>();

/** Lazily loads a grammar; resolves false when shiki doesn't know the name. */
const ensureLanguage = async (
  highlighter: Highlighter,
  lang: string
): Promise<boolean> => {
  if (highlighter.getLoadedLanguages().includes(lang)) {
    return true;
  }
  const pending = langLoads.get(lang);
  if (pending !== undefined) {
    return await pending;
  }
  const load = (async () => {
    const bundled: Record<string, LanguageInput> =
      highlighter.getBundledLanguages();
    // own-property lookup: a fence like ```toString would otherwise hand
    // Object.prototype.toString to loadLanguage.
    const loader = own(bundled, lang);
    if (loader === undefined) {
      return false;
    }
    await highlighter.loadLanguage(loader);
    return highlighter.getLoadedLanguages().includes(lang);
  })();
  langLoads.set(lang, load);
  try {
    return await load;
  } finally {
    langLoads.delete(lang);
  }
};

/**
 * The highlighter when `lang` can be handled — undefined for SKIP_LANGS and
 * names shiki doesn't know, so callers degrade to unhighlighted code.
 */
const readyHighlighter = async (
  lang: string
): Promise<Highlighter | undefined> => {
  if (SKIP_LANGS.has(lang)) {
    return undefined;
  }
  try {
    const highlighter = await getHighlighter();
    return (await ensureLanguage(highlighter, lang)) ? highlighter : undefined;
  } catch {
    // Highlighter init/grammar-load failure degrades to unhighlighted code
    // rather than failing the whole document render.
    return undefined;
  }
};

/**
 * Highlight `text` as `lang`, returning the inner HTML of shiki's `<code>`
 * element — the same token spans rehypeShiki grafts onto the `code` node.
 * Used by the Storybook preview, where component stories bypass the rehype
 * pipeline; kept here so both paths share the highlighter and themes.
 */
export const highlightToHtml = async (
  lang: string,
  text: string
): Promise<string | undefined> => {
  const highlighter = await readyHighlighter(lang);
  if (highlighter === undefined) {
    return undefined;
  }
  const html = highlighter.codeToHtml(text.replace(/\n$/u, ""), {
    defaultColor: false,
    lang,
    themes: THEMES,
    transformers: TRANSFORMERS,
  });
  return /<code[^>]*>(?<inner>[\s\S]*?)<\/code>/u.exec(html)?.groups?.inner;
};

/**
 * One side of a hunk, highlighted as the file's own language: `ctx`/`add`
 * rows read from the new side, `ctx`/`del` rows from the old side. Shiki's
 * output line array aligns 1:1 with the joined row texts (rows never
 * contain `\n`).
 */
const sideTokens = (
  highlighter: Highlighter,
  lang: string,
  src: string
): DiffHlToken[][] => {
  if (src === "") {
    return [];
  }
  const hast = highlighter.codeToHast(src, {
    defaultColor: false,
    lang,
    themes: THEMES,
  });
  const pre = hast.children.find(
    (child): child is Element => isElement(child) && child.tagName === "pre"
  );
  const code = pre?.children.find(
    (child): child is Element => isElement(child) && child.tagName === "code"
  );
  if (code === undefined) {
    return [];
  }
  const lines: DiffHlToken[][] = [];
  for (const child of code.children) {
    if (
      !isElement(child) ||
      child.tagName !== "span" ||
      !classNames(child).includes("line")
    ) {
      continue;
    }
    lines.push(
      child.children.flatMap((tok): DiffHlToken[] => {
        if (tok.type === "text") {
          return tok.value === "" ? [] : [{ t: tok.value }];
        }
        if (!isElement(tok)) {
          return [];
        }
        const style = tok.properties?.style;
        return [
          {
            s: typeof style === "string" && style !== "" ? style : undefined,
            t: textContent(tok),
          },
        ];
      })
    );
  }
  return lines;
};

/** A resolved (highlighter, lang) pair for one side of a file diff. */
interface DiffSide {
  highlighter: Highlighter;
  lang: string;
}

/** Token lines per row of one hunk — `null` for note rows and for rows whose
 * side had no usable grammar. Add/ctx rows read the new-side highlight, del
 * rows the old-side one (the sides can carry different languages after a
 * cross-extension rename). */
const hunkTokens = (
  sides: { new?: DiffSide; old?: DiffSide },
  rows: DiffRow[]
): (DiffHlToken[] | null)[] => {
  const nt =
    sides.new === undefined
      ? []
      : sideTokens(
          sides.new.highlighter,
          sides.new.lang,
          rows
            .filter((r) => r.kind === "ctx" || r.kind === "add")
            .map((r) => r.text)
            .join("\n")
        );
  const ot =
    sides.old === undefined
      ? []
      : sideTokens(
          sides.old.highlighter,
          sides.old.lang,
          rows
            .filter((r) => r.kind === "ctx" || r.kind === "del")
            .map((r) => r.text)
            .join("\n")
        );
  let ni = 0;
  let oi = 0;
  return rows.map((row) => {
    if (row.kind === "add") {
      const t = nt[ni] ?? null;
      ni += 1;
      return t;
    }
    if (row.kind === "del") {
      const t = ot[oi] ?? null;
      oi += 1;
      return t;
    }
    if (row.kind === "ctx") {
      const t = nt[ni] ?? null;
      ni += 1;
      oi += 1;
      return t;
    }
    return null;
  });
};

/**
 * Language-highlighted rows for every file/hunk of a parsed diff. Language
 * comes from the `lang=` meta override, else the file's own path (the fence's
 * `title=`/`filename=` names a single-file diff). A file whose language can't
 * be resolved keeps `null` rows — it renders plain, like today.
 */
const diffHighlight = async (
  files: FileDiff[],
  meta: string
): Promise<DiffHl | undefined> => {
  const override = fenceLang(meta);
  const named = files.length === 1 ? fenceFilename(meta) : undefined;
  const langOf = (path: string | undefined): string | undefined =>
    override ?? (path === undefined ? undefined : langForPath(path));
  const perFile = files.map((file) => ({
    file,
    newLang: langOf(file.newPath ?? file.oldPath ?? named),
    oldLang: langOf(file.oldPath ?? file.newPath ?? named),
  }));
  // One parallel grammar-load pass for every language the diff touches.
  const wanted = new Set(
    perFile.flatMap((l) =>
      [l.newLang, l.oldLang].filter((x): x is string => x !== undefined)
    )
  );
  const ready = new Map<string, Highlighter>();
  await Promise.all(
    [...wanted].map(async (lang) => {
      const highlighter = await readyHighlighter(lang);
      if (highlighter !== undefined) {
        ready.set(lang, highlighter);
      }
    })
  );
  const sideOf = (lang: string | undefined): DiffSide | undefined => {
    if (lang === undefined) {
      return undefined;
    }
    const highlighter = ready.get(lang);
    return highlighter === undefined ? undefined : { highlighter, lang };
  };
  let any = false;
  const hl = perFile.map(({ file, newLang, oldLang }): DiffHl[number] => {
    const newSide = sideOf(newLang);
    // Deleted rows prefer the old side's language; when it didn't resolve
    // they share the new side's rather than going plain.
    const oldSide = sideOf(oldLang) ?? newSide;
    return file.hunks.map((h) => {
      try {
        const rows = hunkTokens({ new: newSide, old: oldSide }, h.rows);
        any ||= rows.some((r) => r !== null);
        return rows;
      } catch {
        // One broken grammar must not fail the whole document — this hunk's
        // rows degrade to plain text.
        return h.rows.map((): null => null);
      }
    });
  });
  return any ? hl : undefined;
};

/**
 * Rehype plugin: replace the text inside `pre > code` with shiki's highlighted
 * line spans. The `pre`/`code` elements and their properties (language class,
 * `meta` from remarkCodeMeta) are kept so the `Pre` component's filename
 * header, copy payload, and mermaid handling keep working. ```diff/```patch
 * fences skip the generic path: `DiffView` replaces their markup, so instead
 * each hunk's old/new sides are highlighted in the file's own language and
 * parked as JSON on `code`'s `data-diffhl` prop — it serializes into the
 * compiled module, reaching SSR and hydration renders identically.
 */
export const rehypeShiki = () => async (tree: Root) => {
  const targets: { code: Element; lang: string; meta: string; text: string }[] =
    [];
  const diffs: {
    code: Element;
    files: FileDiff[];
    meta: string;
  }[] = [];

  visit(tree, "element", (node) => {
    if (node.tagName !== "pre") {
      return;
    }
    const code: ElementContent | undefined = node.children[0];
    if (!isElement(code) || code.tagName !== "code") {
      return;
    }
    const lang = languageOf(code);
    if (lang === undefined || SKIP_LANGS.has(lang)) {
      return;
    }
    const meta =
      typeof code.properties?.meta === "string" ? code.properties.meta : "";
    const text = textContent(code);
    // A ```diff fence with parseable structure renders as DiffView — the
    // language highlight replaces the generic pass. Unparseable content
    // falls back to the ordinary diff-grammar highlight below (DiffView
    // renders it as a plain code block too).
    if (DIFF_FENCE_LANGS.has(lang)) {
      const files = parseDiff(text).filter((f) => f.raw.length > 0);
      if (files.length > 0) {
        diffs.push({ code, files, meta });
        return;
      }
    }
    targets.push({ code, lang, meta, text });
  });

  if (targets.length === 0 && diffs.length === 0) {
    return;
  }

  await Promise.all([
    ...targets.map(async ({ code, lang, meta, text }) => {
      const highlighter = await readyHighlighter(lang);
      if (highlighter === undefined) {
        return;
      }
      let hast: Root;
      try {
        // mdast adds a trailing newline to code values; keep it out of the
        // highlight input or it surfaces as a stray empty line.
        hast = highlighter.codeToHast(text.replace(/\n$/u, ""), {
          defaultColor: false,
          lang,
          meta: { __raw: meta },
          themes: THEMES,
          transformers: TRANSFORMERS,
        });
      } catch {
        // One broken grammar must not fail the whole document — the fence
        // degrades to plain unhighlighted code.
        return;
      }
      const shikiPre = hast.children.find(
        (child): child is Element => isElement(child) && child.tagName === "pre"
      );
      const highlightedCode = shikiPre?.children[0];
      if (!isElement(highlightedCode) || highlightedCode.tagName !== "code") {
        return;
      }
      code.children = highlightedCode.children;
      // Feature flags the transformers park on shiki's discarded <pre>
      // (`has-diff`, `has-focused`, `has-line-numbers`, …) move onto our
      // <code> so the CSS selectors below can see them.
      const lifted = classNames(shikiPre).filter((c) => c.startsWith("has-"));
      code.properties = {
        ...code.properties,
        className: [...classNames(code), "shiki", ...lifted],
      };
    }),
    ...diffs.map(async ({ code, files, meta }) => {
      const hl = await diffHighlight(files, meta);
      if (hl === undefined) {
        return;
      }
      code.properties = {
        ...code.properties,
        "data-diffhl": JSON.stringify(hl),
      };
    }),
  ]);
};
