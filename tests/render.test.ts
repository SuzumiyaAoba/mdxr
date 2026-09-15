import { describe, expect, it } from "vitest";

import { mdxToHtml } from "../src/mdx.js";
import { builtinComponents } from "../src/ui/index.js";

const render = async (src: string) => await mdxToHtml(src, builtinComponents);

describe(mdxToHtml, () => {
  it("renders markdown prose", async () => {
    const { body } = await render("# Hello\n\nSome **bold** text.");
    expect(body).toContain("<h1>Hello</h1>");
    expect(body).toContain("<strong>bold</strong>");
  });

  it("renders components from JSX", async () => {
    const { body } = await render(
      '<Callout kind="warning" title="Careful">watch out</Callout>'
    );
    expect(body).toContain("Warning");
    expect(body).toContain("watch out");
    expect(body).toContain("border-amber-500");
  });

  it("converts :::note directives into Callout", async () => {
    const { body } = await render(":::tip[Good idea]\nuse this\n:::");
    expect(body).toContain("Tip");
    expect(body).toContain("use this");
  });

  it("converts GitHub alerts into Callout", async () => {
    const { body } = await render("> [!DANGER]\n> do not\n");
    expect(body).toContain("Danger");
    expect(body).toContain("do not");
  });

  it("converts :::phase into Phase", async () => {
    const { body } = await render(
      ':::phase{title="Setup" status="doing"}\nwork\n:::'
    );
    expect(body).toContain("Setup");
    expect(body).toContain("In progress");
  });

  it("rejects JS expressions", async () => {
    await expect(render("value is {1 + 1}")).rejects.toThrow(/not allowed/iu);
  });

  it("rejects imports", async () => {
    await expect(render('import x from "y"\n\nhi')).rejects.toThrow(
      /not allowed/iu
    );
  });

  it("suggests a correction for unknown components", async () => {
    await expect(render('<Calout kind="note">x</Calout>')).rejects.toThrow(
      /Did you mean <Callout>/u
    );
  });

  it("validates props and reports the issue", async () => {
    await expect(render('<Callout kind="nope">x</Callout>')).rejects.toThrow(
      /Invalid props/u
    );
  });

  it("reads frontmatter", async () => {
    const { frontmatter } = await render("---\ntitle: My plan\n---\n\nbody");
    expect(frontmatter.title).toBe("My plan");
  });

  it("marks mermaid fences for client rendering", async () => {
    const { body } = await render("```mermaid\ngraph TD\nA-->B\n```");
    expect(body).toContain('class="mermaid');
    expect(body).toContain("graph TD");
  });

  it("renders FileRef without prose backticks", async () => {
    const { body } = await render(
      'see <FileRef path="src/mdx.ts" lines="40-52" /> here'
    );
    expect(body).toContain("not-prose");
    expect(body).toContain("src/mdx.ts");
  });

  it("wraps fenced code with a filename header", async () => {
    const { body } = await render('```ts title="a.ts"\nconst x = 1\n```');
    expect(body).toContain("a.ts");
    expect(body).toContain("data-copy");
  });
});
