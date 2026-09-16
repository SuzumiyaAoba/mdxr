import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { mdxToHtml } from "../src/mdx.js";
import { builtinComponents } from "../src/ui/index.js";

const render = async (src: string) => await mdxToHtml(src, builtinComponents);

/** A filePath inside tests/ so <CodeFile> resolves fixtures/ relatively. */
const renderAt = async (src: string, docPath: string) =>
  await mdxToHtml(src, builtinComponents, docPath);

const fixtureDoc = fileURLToPath(new URL("fixtures/doc.mdx", import.meta.url));

describe(mdxToHtml, () => {
  it("renders markdown prose", async () => {
    const { body } = await render("# Hello\n\nSome **bold** text.");
    expect(body).toContain('id="hello"');
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

  it("syntax-highlights fenced code with shiki", async () => {
    const { body } = await render("```ts\nconst x: number = 1\n```");
    expect(body).toContain('class="language-ts shiki"');
    expect(body).toContain('class="line"');
    // dual-theme output: token colors are CSS vars, switched in BASE_CSS
    expect(body).toContain("--shiki-light:");
    expect(body).toContain("--shiki-dark:");
    // copy payload still contains the raw source
    expect(body).toContain('data-copy="const x: number = 1"');
  });

  it("highlights lazy-loaded languages", async () => {
    const { body } = await render("```elixir\ndef f, do: :ok\n```");
    expect(body).toContain("--shiki-light:");
  });

  it("leaves unknown languages unhighlighted", async () => {
    const { body } = await render("```notalanguage\nxyz\n```");
    expect(body).not.toContain("--shiki-light");
    expect(body).not.toContain('class="line"');
    expect(body).toContain("xyz");
  });

  it("does not highlight mermaid blocks", async () => {
    const { body } = await render("```mermaid\ngraph TD\nA-->B\n```");
    expect(body).not.toContain("--shiki-light");
  });

  it("renders plan metadata chips via Plan props", async () => {
    const { body } = await render(
      '<Plan title="T" owner="@alice" version="v2">x</Plan>'
    );
    expect(body).toContain("Owner");
    expect(body).toContain("@alice");
    expect(body).toContain("v2");
  });

  it("renders Priority and Effort pills", async () => {
    const { body } = await render(
      '<Priority level="p0">blocker</Priority> <Effort size="l">3d</Effort>'
    );
    expect(body).toContain("P0");
    expect(body).toContain("blocker");
    expect(body).toContain("L");
    expect(body).toContain("3d");
  });

  it("colors Due by urgency computed at render time", async () => {
    const { body } = await render(
      '<Due date="2000-01-01" /> <Due date="2999-01-01" />'
    );
    expect(body).toContain("overdue");
    expect(body).toContain("border-red-300");
    expect(body).toContain("2999-01-01");
  });

  it("renders Owner with initials avatar and role", async () => {
    const { body } = await render('<Owner name="Bob Tanaka" role="sec" />');
    expect(body).toContain("BT");
    expect(body).toContain("sec");
  });

  it("converts :::timeline into Timeline and renders Events", async () => {
    const { body } = await render(
      ':::timeline{title="Milestones"}\n<Event date="2026-09-10" status="done" title="Ship" />\n:::'
    );
    expect(body).toContain("Milestones");
    expect(body).toContain("2026-09-10");
    expect(body).toContain("Done");
  });

  it("converts :::goal / :::nongoal / :::question into Callouts", async () => {
    const { body } = await render(
      ":::goal\nship it\n:::\n\n:::non-goal\nnot this\n:::\n\n:::question\nwhy\n:::"
    );
    expect(body).toContain("Goal");
    expect(body).toContain("Non-goal");
    expect(body).toContain("not this");
    expect(body).toContain("Question");
  });

  it("converts GitHub-style goal alerts into Callouts", async () => {
    const { body } = await render("> [!GOAL]\n> ship it\n");
    expect(body).toContain("Goal");
    expect(body).toContain("ship it");
  });

  it("renders Options inside Columns with status chips", async () => {
    const { body } = await render(
      '<Columns><Option title="A" status="recommended">good</Option><Option title="B" status="rejected">bad</Option></Columns>'
    );
    expect(body).toContain("grid");
    expect(body).toContain("Recommended");
    expect(body).toContain("Rejected");
  });

  it("renders Risk with level pill and mitigation line", async () => {
    const { body } = await render(
      '<Risk level="high" title="Drift" mitigation="Pin deps">eval changed</Risk>'
    );
    expect(body).toContain("High risk");
    expect(body).toContain("Mitigation:");
    expect(body).toContain("Pin deps");
  });

  it("renders Decision records with status", async () => {
    const { body } = await render(
      '<Decision title="Sync render" status="accepted" date="2026-09-12">no async</Decision>'
    );
    expect(body).toContain("Sync render");
    expect(body).toContain("Accepted");
    expect(body).toContain("2026-09-12");
  });

  it("renders Approvals rows with statuses", async () => {
    const { body } = await render(
      '<Approvals><Approval name="alice" status="approved" /><Approval name="bob" status="changes-requested">fix docs</Approval></Approvals>'
    );
    expect(body).toContain("Approved");
    expect(body).toContain("Changes requested");
    expect(body).toContain("fix docs");
  });

  it("renders Stats cards with signed deltas", async () => {
    const { body } = await render(
      '<Stats><Stat value="120ms" label="p95" delta="-34%" /></Stats>'
    );
    expect(body).toContain("120ms");
    expect(body).toContain("p95");
    expect(body).toContain("-34%");
  });

  it("renders Tree from a nested list with folder detection and notes", async () => {
    const { body } = await render(
      '<Tree root="rv/">\n\n- src/\n  - render.ts — pipeline entry\n- package.json\n\n</Tree>'
    );
    expect(body).toContain("rv/");
    expect(body).toContain("render.ts");
    expect(body).toContain("pipeline entry");
    expect(body).toContain("package.json");
  });

  it("adds an automatic progress bar to Steps with progress", async () => {
    const { body } = await render(
      '<Steps progress><Step status="done">a</Step><Step status="todo">b</Step></Steps>'
    );
    expect(body).toContain("Steps");
    expect(body).toContain("1/2");
  });

  it("renders owner/effort/priority/due chips on Step", async () => {
    const { body } = await render(
      '<Step status="doing" owner="@alice" effort="m" priority="p1" due="2999-01-01">work</Step>'
    );
    expect(body).toContain("P1");
    expect(body).toContain("M");
    expect(body).toContain("@alice");
    expect(body).toContain("2999-01-01");
  });

  it("renders <Icon> as an inline svg (decorative by default)", async () => {
    const { body } = await render('<Icon name="lucide:rocket" />');
    expect(body).toContain("<svg");
    expect(body).toContain("iconify--lucide");
    expect(body).toContain('aria-hidden="true"');
  });

  it("resolves bare icon names against the lucide set", async () => {
    const { body } = await render('<Icon name="check" />');
    expect(body).toContain("iconify--lucide");
  });

  it("marks <Icon> as an image when label is given", async () => {
    const { body } = await render('<Icon name="lucide:check" label="done" />');
    expect(body).toContain('aria-label="done"');
    expect(body).not.toContain('aria-hidden="true"');
  });

  it("rejects unknown icon names with a validation error", async () => {
    await expect(
      render('<Icon name="lucide:no-such-icon-xyz" />')
    ).rejects.toThrow(/unknown icon/u);
  });

  it("renders kind icons inside Callout", async () => {
    const { body } = await render(":::warning\nwatch out\n:::");
    expect(body).toContain("<svg");
    expect(body).toContain("iconify--lucide");
  });

  it("highlights meta line ranges ```ts {1,3}", async () => {
    const { body } = await render(
      "```ts {1,3}\nconst a = 1\nconst b = 2\nconst c = 3\n```"
    );
    expect(body.match(/line highlighted/gu)).toHaveLength(2);
  });

  it("adds has-line-numbers for ```ts ln", async () => {
    const { body } = await render("```ts ln\nconst a = 1\n```");
    expect(body).toContain("has-line-numbers");
  });

  it("supports // [!code hl] and strips the marker", async () => {
    const { body } = await render(
      "```ts\nconst a = 1 // [!code hl]\nconst b = 2\n```"
    );
    expect(body).toContain("line highlighted");
    expect(body).not.toContain("[!code");
  });

  it("supports [!code ++] / [!code --] diff markers", async () => {
    const { body } = await render(
      "```ts\nconst a = 1 // [!code --]\nconst a = 2 // [!code ++]\n```"
    );
    expect(body).toContain("diff add");
    expect(body).toContain("diff remove");
    expect(body).toContain("has-diff");
  });

  it("supports [!code focus] and [!code warning]", async () => {
    const { body } = await render(
      "```ts\nconst a = 1 // [!code focus]\nconst b = 2 // [!code warning]\n```"
    );
    expect(body).toContain("focused");
    expect(body).toContain("has-focused");
    expect(body).toContain("warning");
  });

  it("highlights words via /word/ meta and [!code word:x]", async () => {
    const { body } = await render(
      "```ts /beta/\nconst alpha = 1\nconst beta = 2 // [!code word:alpha]\n```"
    );
    expect(body).toContain("highlighted-word");
  });

  it("gives headings slug ids", async () => {
    const { body } = await render("## Alpha\n\n### Beta\n\n## Gamma\n");
    expect(body).toContain('id="alpha"');
    expect(body).toContain('id="beta"');
    expect(body).toContain('id="gamma"');
  });

  it("fills <Toc> with links to the headings", async () => {
    const { body } = await render(
      "<Toc />\n\n## Alpha\n\n### Beta\n\n## Gamma\n"
    );
    expect(body).toContain("<nav");
    expect(body).toContain("Contents");
    expect(body).toContain('href="#alpha"');
    expect(body).toContain('href="#beta"');
    expect(body).toContain('href="#gamma"');
  });

  it(":::toc produces the same table of contents", async () => {
    const { body } = await render(":::toc\n:::\n\n## Alpha\n");
    expect(body).toContain('href="#alpha"');
  });

  it("dedupes identical heading slugs", async () => {
    const { body } = await render("## Foo\n\n## Foo\n");
    expect(body).toContain('id="foo"');
    expect(body).toContain('id="foo-1"');
  });

  it("respects <Toc depth> bounds", async () => {
    const { body } = await render(
      '<Toc depth="2" />\n\n## Alpha\n\n### Beta\n'
    );
    expect(body).toContain('href="#alpha"');
    expect(body).not.toContain('href="#beta"');
  });

  it("embeds files via <CodeFile> with a sliced range", async () => {
    const { body } = await renderAt(
      '<CodeFile path="sample.ts" lines="1-2" />',
      fixtureDoc
    );
    expect(body).toContain("alpha");
    expect(body).toContain("beta");
    expect(body).not.toContain("gamma");
    expect(body).toContain("sample.ts:1-2");
    expect(body).toContain("language-ts");
  });

  it("fails <CodeFile> for a missing file", async () => {
    await expect(
      renderAt('<CodeFile path="nope.ts" />', fixtureDoc)
    ).rejects.toThrow(/cannot read/iu);
  });

  it("renders SymbolRef with kind icon and location", async () => {
    const { body } = await render(
      'call <SymbolRef name="mdxToHtml" kind="fn" path="src/mdx.ts" lines="70-106" /> here'
    );
    expect(body).toContain("mdxToHtml");
    expect(body).toContain("src/mdx.ts:70-106");
    expect(body).toContain("<svg");
  });

  it("renders Changes rows with kind labels", async () => {
    const { body } = await render(
      '<Changes><Change kind="add" path="src/new.ts">new parser</Change><Change kind="rename" path="a.ts" to="b.ts" /><Change kind="delete" path="old.ts" /></Changes>'
    );
    expect(body).toContain("Add");
    expect(body).toContain("Rename");
    expect(body).toContain("Delete");
    expect(body).toContain("new parser");
    expect(body).toContain("b.ts");
  });

  it("renders a Props table", async () => {
    const { body } = await render(
      '<Props of="Step"><Prop name="status" type="todo|doing|done" required>marker</Prop><Prop name="owner" type="string" /></Props>'
    );
    expect(body).toContain("Step");
    expect(body).toContain("status");
    expect(body).toContain("todo|doing|done");
    expect(body).toContain("marker");
    expect(body).toContain("<table");
  });

  it("renders Ref card and Issue/PR chips", async () => {
    const { body } = await render(
      '<Ref href="https://mdxjs.com" title="MDX docs">spec</Ref>\n\n<Issue repo="a/b" number="12">bug</Issue>\n<PR repo="a/b" number="5" />'
    );
    expect(body).toContain("https://mdxjs.com");
    expect(body).toContain("MDX docs");
    expect(body).toContain("github.com/a/b/issues/12");
    expect(body).toContain("github.com/a/b/pull/5");
    expect(body).toContain('rel="noopener noreferrer"');
  });

  it("renders Figure with caption", async () => {
    const { body } = await render(
      '<Figure src="a.png" alt="diagram" caption="Fig 1" />'
    );
    expect(body).toContain("<figure");
    expect(body).toContain('src="a.png"');
    expect(body).toContain('alt="diagram"');
    expect(body).toContain("Fig 1");
  });

  it("renders Glossary terms", async () => {
    const { body } = await render(
      '<Glossary><Term name="hast">HTML AST</Term><Term name="mdast">Markdown AST</Term></Glossary>'
    );
    expect(body).toContain("<dl");
    expect(body).toContain("hast");
    expect(body).toContain("HTML AST");
    expect(body).toContain("<dt");
    expect(body).toContain("<dd");
  });

  it("renders Before/After panels", async () => {
    const { body } = await render(
      "<Columns><Before>old way</Before><After>new way</After></Columns>"
    );
    expect(body).toContain("Before");
    expect(body).toContain("After");
    expect(body).toContain("old way");
    expect(body).toContain("new way");
  });

  it("renders Cmd with a copy payload", async () => {
    const { body } = await render("run <Cmd>pnpm build</Cmd> first");
    expect(body).toContain("pnpm build");
    expect(body).toContain('data-copy="pnpm build"');
  });

  it("renders Reqs with id chip and status", async () => {
    const { body } = await render(
      '<Reqs><Req id="REQ-1" status="done">handle it</Req><Req id="REQ-2">todo item</Req></Reqs>'
    );
    expect(body).toContain("REQ-1");
    expect(body).toContain("REQ-2");
    expect(body).toContain("Done");
    expect(body).toContain("handle it");
  });

  it("renders math via KaTeX", async () => {
    const { body } = await render("inline $x^2$ math\n\n$$E = mc^2$$");
    expect(body).toContain("katex");
  });
});
