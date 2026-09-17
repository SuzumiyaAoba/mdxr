import { MERMAID_CDN_URL } from "../src/assets.js";
import { isRecord } from "../src/guards.js";
import { highlightToHtml } from "../src/rehype/shiki.js";

/**
 * Component stories mount `Pre` output directly, skipping the rehypeShiki and
 * MERMAID_JS passes rendered documents get. These are the DOM-level
 * counterparts, replayed on the mounted story by the preview decorator.
 * Both are idempotent — safe to run after every render.
 */

/** rehypeShiki counterpart: swap `pre > code` text for shiki span markup. */
const highlightCodeBlocks = async (root: ParentNode): Promise<void> => {
  const codes = root.querySelectorAll<HTMLElement>(
    "pre > code[class*='language-']"
  );
  await Promise.all(
    [...codes].map(async (code) => {
      const lang = /language-(?<lang>[^\s]+)/u.exec(code.className)?.groups
        ?.lang;
      if (lang === undefined) {
        return;
      }
      // The marker stores the highlighted text so a re-render that rewrites
      // code.textContent (React removing our spans) gets re-processed while
      // untouched nodes are skipped.
      const text = (code.textContent ?? "").replace(/\n$/u, "");
      if (code.dataset.mdxrHighlight === text) {
        return;
      }
      code.dataset.mdxrHighlight = text;
      const html = await highlightToHtml(lang, text);
      if (html === undefined) {
        code.classList.remove("shiki");
        return;
      }
      code.innerHTML = html;
      code.classList.add("shiki");
      // has-* flags live on shiki's discarded <pre>; restore the one the CSS
      // reads (focus dimming) from the grafted line spans.
      code.classList.toggle(
        "has-focused",
        code.querySelector(".line.focused") !== null
      );
    })
  );
};

interface MermaidApi {
  initialize: (config: { startOnLoad: boolean; theme: string }) => void;
  run: (options: {
    nodes: ArrayLike<HTMLElement>;
    suppressErrors?: boolean;
  }) => Promise<void>;
}

let mermaidPromise: Promise<MermaidApi> | undefined;

const loadMermaid = async (): Promise<MermaidApi> => {
  const mod: unknown = await import(
    // oxlint-disable-next-line eslint/no-inline-comments -- must sit inside import() for Vite
    /* @vite-ignore */ MERMAID_CDN_URL
  );
  const api = isRecord(mod) ? mod.default : undefined;
  if (api === undefined) {
    throw new TypeError("mdxr: mermaid CDN module has no default export");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return api as MermaidApi;
};

const getMermaid = async (): Promise<MermaidApi> => {
  mermaidPromise ??= loadMermaid();
  return await mermaidPromise;
};

/**
 * MERMAID_JS counterpart: run mermaid on `.mermaid` blocks it hasn't
 * processed yet (mermaid marks them with `data-processed`).
 */
const renderMermaidBlocks = async (root: ParentNode): Promise<void> => {
  const nodes = root.querySelectorAll<HTMLElement>(
    ".mermaid:not([data-processed])"
  );
  if (nodes.length === 0) {
    return;
  }
  const mermaid = await getMermaid();
  // Documents pick the theme from prefers-color-scheme; the preview follows
  // the toolbar's .dark class so the toggle covers diagrams too. Diagrams
  // already rendered keep their theme, like a document after a reload.
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.classList.contains("dark")
      ? "dark"
      : "default",
  });
  await mermaid.run({ nodes, suppressErrors: true });
};

const tryRenderMermaid = async (root: ParentNode): Promise<void> => {
  try {
    await renderMermaidBlocks(root);
  } catch (error) {
    // CDN import failures etc. — a rendered document fails the same way.
    console.error("mdxr: mermaid render failed", error);
  }
};

/**
 * CLIENT_JS init counterpart: seed each Ask block's Markdown answer pane by
 * bubbling a synthetic `input` event off it — the delegated handler's input
 * branch does the render, so no serialization code is duplicated here.
 */
const seedAskOutputs = (root: ParentNode): void => {
  for (const b of root.querySelectorAll("[data-ask]")) {
    b.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

export const enhanceRenderedBlocks = async (
  root: ParentNode
): Promise<void> => {
  seedAskOutputs(root);
  await Promise.all([highlightCodeBlocks(root), tryRenderMermaid(root)]);
};
