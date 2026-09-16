import type { Element, ElementContent, Root } from "hast";
import { createHighlighter } from "shiki";
import type { Highlighter, LanguageInput } from "shiki";
import { visit } from "unist-util-visit";

import { isRecord } from "../guards.js";

/**
 * Fenced code blocks are syntax-highlighted with shiki at render time.
 * `defaultColor: false` emits `--shiki-light`/`--shiki-dark` CSS variables on
 * every token span; BASE_CSS switches between them via prefers-color-scheme.
 */
const THEMES = { dark: "github-dark", light: "github-light" } as const;

/**
 * Languages handled by other means (mermaid renders as a diagram) or that have
 * no grammar (plain text aliases) — left untouched so `pre` stays cheap.
 */
const SKIP_LANGS = new Set(["mermaid", "plain", "plaintext", "text", "txt"]);

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

let highlighterPromise: Promise<Highlighter> | undefined;

const getHighlighter = async (): Promise<Highlighter> => {
  highlighterPromise ??= createHighlighter({
    langs: [...PRELOADED_LANGS],
    themes: [THEMES.light, THEMES.dark],
  });
  return await highlighterPromise;
};

const isElement = (node: unknown): node is Element =>
  isRecord(node) && node.type === "element" && typeof node.tagName === "string";

const textContent = (node: Element | ElementContent): string => {
  if (node.type === "text") {
    return node.value;
  }
  return "children" in node ? node.children.map(textContent).join("") : "";
};

const languageOf = (code: Element): string | undefined =>
  /language-(?<lang>[^\s]+)/u.exec((code.properties?.className ?? []).join(" "))
    ?.groups?.lang;

/** Lazily loads a grammar; resolves false when shiki doesn't know the name. */
const ensureLanguage = async (
  highlighter: Highlighter,
  lang: string
): Promise<boolean> => {
  if (highlighter.getLoadedLanguages().includes(lang)) {
    return true;
  }
  const bundled: Record<string, LanguageInput> =
    highlighter.getBundledLanguages();
  const loader = bundled[lang];
  if (loader === undefined) {
    return false;
  }
  await highlighter.loadLanguage(loader);
  return highlighter.getLoadedLanguages().includes(lang);
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
  const highlighter = await getHighlighter();
  return (await ensureLanguage(highlighter, lang)) ? highlighter : undefined;
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
  });
  return /<code[^>]*>(?<inner>[\s\S]*?)<\/code>/u.exec(html)?.groups?.inner;
};

/**
 * Rehype plugin: replace the text inside `pre > code` with shiki's highlighted
 * line spans. The `pre`/`code` elements and their properties (language class,
 * `meta` from remarkCodeMeta) are kept so the `Pre` component's filename
 * header, copy payload, and mermaid handling keep working.
 */
export const rehypeShiki = () => async (tree: Root) => {
  const targets: { code: Element; lang: string; text: string }[] = [];

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
    targets.push({ code, lang, text: textContent(code) });
  });

  if (targets.length === 0) {
    return;
  }

  await Promise.all(
    targets.map(async ({ code, lang, text }) => {
      const highlighter = await readyHighlighter(lang);
      if (highlighter === undefined) {
        return;
      }
      // mdast adds a trailing newline to code values; keep it out of the
      // highlight input or it surfaces as a stray empty line.
      const hast = highlighter.codeToHast(text.replace(/\n$/u, ""), {
        defaultColor: false,
        lang,
        themes: THEMES,
      });
      const highlightedCode = hast.children.find(
        (child): child is Element => isElement(child) && child.tagName === "pre"
      )?.children[0];
      if (!isElement(highlightedCode) || highlightedCode.tagName !== "code") {
        return;
      }
      code.children = highlightedCode.children;
      code.properties = {
        ...code.properties,
        className: [...(code.properties?.className ?? []), "shiki"],
      };
    })
  );
};
