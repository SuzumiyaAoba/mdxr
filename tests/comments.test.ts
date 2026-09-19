import { describe, expect, it } from "vitest";

import { renderDoc } from "./helpers.js";

const render = renderDoc;

const CODE_DOC = `<Comments>

\`\`\`ts title="src/x.ts"
const a = 1;
const b = 2;
const c = a + b;
\`\`\`

<Comment lines="2" author="@devin" severity="medium">
derive b from a
</Comment>

</Comments>
`;

const DIFF_DOC = `<Comments>

\`\`\`diff
--- a/src/render.ts
+++ b/src/render.ts
@@ -40,4 +40,5 @@
 keep
-old
+new
 tail
\`\`\`

<Comment lines="41">
new line lands here
</Comment>

<Comment lines="41" side="old" author="@alice">
old line went away
</Comment>

</Comments>
`;

/** Position of the nth (0-based) `needle` occurrence — line spans mark rows. */
const nthIndex = (haystack: string, needle: string, n: number): number => {
  let at = -1;
  for (let i = 0; i <= n; i += 1) {
    at = haystack.indexOf(needle, at + 1);
  }
  return at;
};

describe("Comments", () => {
  it("anchors a comment under the referenced code line", async () => {
    const { body } = await render(CODE_DOC);
    // The thread strip lands between the line-2 and line-3 `.line` spans.
    const commentAt = body.indexOf("derive b from a");
    const line2At = nthIndex(body, 'class="line', 1);
    const line3At = nthIndex(body, 'class="line', 2);
    expect(commentAt).toBeGreaterThan(line2At);
    expect(commentAt).toBeLessThan(line3At);
    expect(body).toContain("has-line-numbers");
    // GitHub-style header renders the handle without the `@`.
    expect(body).toContain(">devin<");
    expect(body).toContain(":2");
  });

  it("keeps shiki token colors on the annotated code lines", async () => {
    const { body } = await render(CODE_DOC);
    expect(body).toContain("--shiki-light");
    expect(body).toContain(">commented<");
  });

  it("renders a range label and severity for multi-line comments", async () => {
    const { body } = await render(
      `<Comments>\n\n\`\`\`ts\na\nb\nc\n\`\`\`\n\n<Comment lines="1-2" severity="low">range note</Comment>\n\n</Comments>`
    );
    expect(body).toContain(":1-2");
    expect(body).toContain("range note");
    expect(body).toContain("Low");
    // Range end anchors under line 2 — the comment precedes line 3's text.
    expect(body.indexOf("range note")).toBeLessThan(body.indexOf(">c<"));
  });

  it("anchors diff comments on the new side by default", async () => {
    const { body } = await render(DIFF_DOC);
    const commentAt = body.indexOf("new line lands here");
    // Anchored under the `+new` row (new-side 41), before the `tail` ctx row.
    expect(commentAt).toBeGreaterThan(body.indexOf(">new<"));
    expect(commentAt).toBeLessThan(body.indexOf(">tail<"));
  });

  it('anchors side="old" comments on the old side and tags them', async () => {
    const { body } = await render(DIFF_DOC);
    const commentAt = body.indexOf("old line went away");
    // `−old` is old-side 41 — the thread sits under it, before `+new`'s anchor.
    expect(commentAt).toBeGreaterThan(body.indexOf(">old<"));
    expect(commentAt).toBeLessThan(body.indexOf("new line lands here"));
    expect(body).toContain(">old</span>");
    expect(body).toContain(">alice<");
  });

  it("drops unanchorable and line-less comments into the tail strip", async () => {
    const { body } = await render(
      `<Comments>\n\n\`\`\`ts\na\n\`\`\`\n\n<Comment lines="99">past eof</Comment><Comment>file level</Comment>\n\n</Comments>`
    );
    expect(body.indexOf(">a</span>")).toBeLessThan(body.indexOf("past eof"));
    expect(body).toContain("file level");
  });

  it("routes comments to the matching file card in multi-file diffs", async () => {
    const { body } = await render(
      `<Comments>\n\n\`\`\`diff\n--- a/one.ts\n+++ b/one.ts\n@@ -1 +1 @@\n-x\n+y\n--- a/two.ts\n+++ b/two.ts\n@@ -1 +1 @@\n-p\n+q\n\`\`\`\n\n<Comment file="two.ts" lines="1">on two</Comment>\n\n</Comments>`
    );
    // The thread lands inside two.ts's card — after its `+q` row.
    const qAt = body.indexOf(">q<");
    const commentAt = body.indexOf("on two");
    expect(commentAt).toBeGreaterThan(qAt);
  });

  it("rejects an invalid lines spec", async () => {
    await expect(
      render(
        `<Comments>\n\n\`\`\`ts\na\n\`\`\`\n\n<Comment lines="abc">x</Comment>\n\n</Comments>`
      )
    ).rejects.toThrow(/Invalid props/u);
  });

  it("renders comment bodies as MDX — nested fences included", async () => {
    const { body } = await render(
      `<Comments>\n\n\`\`\`ts\na\n\`\`\`\n\n<Comment lines="1">\n\nbody **bold**\n\n\`\`\`diff\n+x\n\`\`\`\n\n</Comment>\n\n</Comments>`
    );
    expect(body).toContain("<strong>bold</strong>");
    expect(body).toContain(">x</span>");
  });

  it("falls back to a plain card list without a fence child", async () => {
    const { body } = await render(
      '<Comments><Comment severity="low">loose note</Comment></Comments>'
    );
    expect(body).toContain("loose note");
    expect(body).toContain("Low");
  });
});
