import type { Meta, StoryObj } from "@storybook/react-vite";
import { createElement, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { diffHighlightJson, highlightToHtml } from "../src/rehype/shiki.js";
import { Comments } from "../src/ui/comments.js";
import { Pre } from "../src/ui/pre.js";
import { Comment } from "../src/ui/review.js";

const TS_SOURCE = `import { compile, minify } from "./pipeline.js";

export const renderFile = async (src: string) => {
  const doc = compile(src);
  const out = minify(doc);
  return out;
};
`;

const GIT_DIFF = `--- a/src/render.ts
+++ b/src/render.ts
@@ -40,7 +40,8 @@ export async function renderFile(
   const src = await read(path);
-  const out = compile(src);
+  const doc = compile(src);
+  const out = minify(doc);
   return out;
 }
 export const renderAll = (paths) => paths.map(renderFile);
@@ -88,3 +90,2 @@ export async function renderAll(
-  return Promise.all(results);
+  return results;
`;

const TWO_FILE_DIFF = `--- a/one.ts
+++ b/one.ts
@@ -1,2 +1,2 @@
-x
+y
 keep
--- a/two.ts
+++ b/two.ts
@@ -5,2 +5,3 @@
 ctx
-p
+q
+r
 end
`;

/** React style prop from an inline `style` attribute — shiki emits only
 * `--shiki-*` custom properties, but standard declarations are camelCased
 * for safety. */
const styleObject = (cssText: string | null): Record<string, string> => {
  const style: Record<string, string> = {};
  for (const decl of (cssText ?? "").split(";")) {
    const sep = decl.indexOf(":");
    if (sep <= 0) {
      continue;
    }
    const prop = decl.slice(0, sep).trim();
    const key = prop.startsWith("--")
      ? prop
      : prop.replaceAll(/-[a-z]/gu, (m) => m[1]?.toUpperCase() ?? "");
    style[key] = decl.slice(sep + 1).trim();
  }
  return style;
};

/**
 * `highlightToHtml` output → React children: the same `.line`-span tree
 * rehypeShiki grafts onto `code`, rebuilt here because stories bypass the
 * rehype pass. `<Comments>` decomposes its subject before the preview's
 * DOM enhancer could reach a `pre > code`, so DOM rewriting can't help.
 */
const htmlToChildren = (html: string): ReactNode[] => {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const conv = (nodes: NodeListOf<ChildNode>): ReactNode[] =>
    [...nodes].flatMap((n, i): ReactNode[] => {
      if (n.nodeType === Node.TEXT_NODE) {
        return [n.textContent ?? ""];
      }
      if (!(n instanceof Element)) {
        return [];
      }
      return [
        createElement(
          n.tagName.toLowerCase(),
          {
            className: n.getAttribute("class") ?? undefined,
            key: i,
            style: styleObject(n.getAttribute("style")),
          },
          ...conv(n.childNodes)
        ),
      ];
    });
  return conv(tpl.content.childNodes);
};

/**
 * Code-fence subject for `<Comments>`: fetches the same `.line`-span
 * children the rehype pass grafts, so the container finds highlighted
 * lines exactly as in a rendered document.
 */
const CodeComments = ({
  children,
  lang,
  meta: fenceMeta = "",
  text,
}: {
  children?: ReactNode;
  lang: string;
  meta?: string;
  text: string;
}) => {
  const [nodes, setNodes] = useState<ReactNode[]>();
  useEffect(() => {
    let live = true;
    const load = async () => {
      const html = await highlightToHtml(lang, text);
      if (live) {
        setNodes(html === undefined ? [text] : htmlToChildren(html));
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [lang, text]);
  return (
    <Comments>
      <Pre meta={fenceMeta}>
        <code className={`language-${lang}`}>{nodes ?? text}</code>
      </Pre>
      {children}
    </Comments>
  );
};

/**
 * Stories mount `<Comments>` with a literal `<Pre>` element child — the
 * same element type MDX emits for a fenced block — so the container can
 * find and decompose its subject without the remark pipeline. The
 * `data-diffhl` payload a rendered document gets for free is fetched here
 * the same way the diff stories do it.
 */
const DiffComments = ({
  children,
  text,
}: {
  children?: ReactNode;
  text: string;
}) => {
  const [hl, setHl] = useState<string>();
  useEffect(() => {
    let live = true;
    const load = async () => {
      const json = await diffHighlightJson(text, "");
      if (live) {
        setHl(json);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [text]);
  return (
    <Comments>
      <Pre>
        <code className="language-diff" data-diffhl={hl}>
          {text}
        </code>
      </Pre>
      {children}
    </Comments>
  );
};

const meta = {
  component: Comments,
  title: "Components/Comments",
} satisfies Meta<typeof Comments>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnCode: Story = {
  render: () => (
    <CodeComments lang="ts" meta='title="src/render.ts"' text={TS_SOURCE}>
      <Comment author="@alice" lines="3" severity="medium">
        <p>
          <code>doc</code> is a better name than <code>out</code> here — the
          minifier input is a document, not markup.
        </p>
      </Comment>
      <Comment author="@devin" lines="4-5" severity="low" title="Nice split">
        <p>Two-stage compile + minify reads cleanly.</p>
      </Comment>
    </CodeComments>
  ),
};

export const OnDiff: Story = {
  render: () => (
    <DiffComments text={GIT_DIFF}>
      <Comment author="@alice" lines="41" severity="high" side="old">
        <p>
          Why was this inlined — is <code>compile()</code> still pure?
        </p>
      </Comment>
      <Comment author="@devin" lines="41-42" severity="low">
        <p>The replacement keeps semantics; the diff is a rename.</p>
      </Comment>
      <Comment author="@alice" lines="91" title="Behavior change">
        <p>
          <code>Promise.all</code> → sequential — intentional? Worth a note in
          the changelog.
        </p>
      </Comment>
    </DiffComments>
  ),
};

export const MultiFileDiff: Story = {
  render: () => (
    <DiffComments text={TWO_FILE_DIFF}>
      <Comment author="@alice" file="two.ts" lines="6">
        <p>
          Anchored in <code>two.ts</code> via <code>file</code>.
        </p>
      </Comment>
      <Comment file="one.ts">
        <p>
          File-level note on one.ts — no <code>lines</code>.
        </p>
      </Comment>
    </DiffComments>
  ),
};

export const WithoutFence: Story = {
  render: () => (
    <Comments>
      <Comment severity="medium" title="No anchor">
        <p>
          Without a fenced child, comments fall back to the plain card list.
        </p>
      </Comment>
      <Comment severity="low">
        <p>Second card in the list.</p>
      </Comment>
    </Comments>
  ),
};
