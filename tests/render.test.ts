import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { mdxToHtml } from "../src/mdx.js";
import { renderDoc } from "./helpers.js";

const render = renderDoc;

/** A filePath inside tests/ so <CodeFile> resolves fixtures/ relatively. */
const renderAt = renderDoc;

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
    expect(body).toContain("bg-red-100");
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

  it("renders a flexible Grid with Cell spans", async () => {
    const { body } = await render(
      '<Grid><Cell span="8" rowSpan="2">main</Cell><Cell span="4">side</Cell></Grid>'
    );
    expect(body).toContain("sm:grid-cols-12");
    expect(body).toContain("sm:col-span-8");
    expect(body).toContain("sm:row-span-2");
    expect(body).toContain("sm:col-span-4");
    expect(body).toContain("main");
  });

  it("switches Grid to auto-fit tracks when min is given", async () => {
    const { body } = await render(
      '<Grid min="14rem" gap="sm"><Cell>a</Cell><Cell>b</Cell></Grid>'
    );
    expect(body).toContain("auto-fit");
    expect(body).toContain("minmax(14rem,1fr)");
    expect(body).toContain("gap-2");
  });

  it("rejects a non-length Grid min", async () => {
    await expect(render('<Grid min="wide">x</Grid>')).rejects.toThrow(
      /Invalid props/u
    );
  });

  it("groups inline components in a flex-wrap Row with a gap", async () => {
    const { body } = await render(
      "<Row><Button>a</Button><Button>b</Button></Row>"
    );
    expect(body).toContain("flex-wrap");
    expect(body).toContain("items-center");
    expect(body).toContain("gap-2");
    expect(body).toContain("my-6");
  });

  it("stacks components vertically in Stack with a gap", async () => {
    const { body } = await render(
      '<Stack gap="lg"><Input /><Textarea /></Stack>'
    );
    expect(body).toContain("flex-col");
    expect(body).toContain("gap-6");
    expect(body).toContain("my-6");
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
      '<Tree root="mdxr/">\n\n- src/\n  - render.ts — pipeline entry\n- package.json\n\n</Tree>'
    );
    expect(body).toContain("mdxr/");
    expect(body).toContain("render.ts");
    expect(body).toContain("pipeline entry");
    expect(body).toContain("package.json");
  });

  it("renders Tree folders as collapsible <details> (open by default)", async () => {
    const { body } = await render(
      "<Tree>\n\n- src/\n  - render.ts\n- empty/\n- package.json\n\n</Tree>"
    );
    expect(body).toContain("<details open");
    expect(body).toContain("<summary");
    // A bare `dir/` renders collapsed and reveals a `…` placeholder.
    expect(body).toContain("<details>");
  });

  it('starts Tree folders collapsed with open="false"', async () => {
    const { body } = await render(
      '<Tree open="false">\n\n- src/\n  - render.ts\n\n</Tree>'
    );
    expect(body).toContain("<details>");
    expect(body).not.toContain("<details open");
  });

  it("renders `...`/`…` Tree entries as placeholders without icons", async () => {
    const { body } = await render(
      "<Tree>\n\n- src/\n  - index.ts\n  - ...\n- …\n\n</Tree>"
    );
    const placeholders = body.match(/>…</gu) ?? [];
    expect(placeholders.length).toBeGreaterThanOrEqual(2);
  });

  it("highlights bold Tree entries", async () => {
    const { body } = await render(
      "<Tree>\n\n- **important.ts**\n- plain.ts\n\n</Tree>"
    );
    expect(body).toContain("<strong>important.ts</strong>");
    expect(body).toContain("bg-amber-500/15");
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

  it("links Issue/PR/Commit chips to non-github.com hosts", async () => {
    const { body } = await render(
      '<Issue repo="ghe.acme.dev/a/b" number="12" />\n<PR repo="https://ghe.acme.dev/a/b/" number="5" />\n<Commit repo="http://git.internal/a/b" sha="0123456" />'
    );
    expect(body).toContain("https://ghe.acme.dev/a/b/issues/12");
    expect(body).toContain("https://ghe.acme.dev/a/b/pull/5");
    expect(body).toContain("http://git.internal/a/b/commit/0123456");
  });

  it("links path-bearing components to the editor (vscode:// default)", async () => {
    const { body } = await renderAt(
      '<FileRef path="sample.ts" lines="10-20" />\n\n:::files\n<File path="sample.ts" lines="3" />\n:::\n\n:::trace\n<TraceFrame name="f" path="sample.ts" lines="7" />\n:::',
      fixtureDoc
    );
    expect(body).toContain("vscode://file/");
    expect(body).toContain("sample.ts:10");
    expect(body).toContain("sample.ts:3");
    expect(body).toContain("sample.ts:7");
  });

  it("links fenced-code filename headers when the file exists", async () => {
    const { body } = await renderAt(
      '```ts title="sample.ts:2"\nconst x = 1\n```',
      fixtureDoc
    );
    expect(body).toContain("vscode://file/");
    expect(body).toContain("sample.ts:2");
  });

  it("honors frontmatter editor: picklist, template, none", async () => {
    const zed = await renderAt(
      '---\neditor: zed\n---\n\n<FileRef path="sample.ts" />',
      fixtureDoc
    );
    expect(zed.body).toContain("zed://file/");

    const tpl = await renderAt(
      '---\neditor: "myed://open?f={path}&l={line}"\n---\n\n<FileRef path="sample.ts" lines="7" />',
      fixtureDoc
    );
    expect(tpl.body).toContain("myed://open?f=");
    expect(tpl.body).toContain("&amp;l=7");

    const none = await renderAt(
      '---\neditor: none\n---\n\n<FileRef path="sample.ts" />\n\n<FileRef path="sample.ts" href="https://x.test/f" />',
      fixtureDoc
    );
    expect(none.body).not.toContain("vscode://");
    expect(none.body).toContain('href="https://x.test/f"');
  });

  it("leaves missing files unlinked", async () => {
    const { body } = await renderAt('<FileRef path="nope.ts" />', fixtureDoc);
    expect(body).not.toContain("vscode://");
    expect(body).toContain("nope.ts");
  });

  it("turns inline-code file paths into FileRef links", async () => {
    const { body } = await renderAt(
      "open `../fixtures/sample.ts` but not `sample.ts`",
      fixtureDoc
    );
    expect(body).toContain("vscode://file/");
    expect(body).toContain("../fixtures/sample.ts");
    // A bare filename stays plain inline code.
    expect(body).toContain("<code>sample.ts</code>");
  });

  it("turns `path:lines` inline code into a ranged FileRef", async () => {
    const { body } = await renderAt("`../fixtures/sample.ts:2-3`", fixtureDoc);
    expect(body).toMatch(/vscode:\/\/file\/[^"]*sample\.ts:2/iu);
    expect(body).toContain(":2-3</span>");
  });

  it("leaves non-existent inline-code paths as plain code", async () => {
    const { body } = await renderAt(
      "`no/such.ts` and `https://x.test/a`",
      fixtureDoc
    );
    expect(body).toContain("<code>no/such.ts</code>");
    expect(body).not.toContain("vscode://");
  });

  it("does not convert inline-code paths inside links", async () => {
    const { body } = await renderAt(
      "[`../fixtures/sample.ts`](https://x.test)",
      fixtureDoc
    );
    expect(body).not.toContain("vscode://");
    expect(body).toContain("<code>../fixtures/sample.ts</code>");
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

  it("renders :::terminal as a transcript with cmd and exit badge", async () => {
    const { body } = await render(
      ':::terminal{cmd="pnpm test" exit="1" title="test run"}\n\n```\nFAIL x.test.ts\n```\n\n:::'
    );
    expect(body).toContain("$ pnpm test");
    expect(body).toContain("exit 1");
    expect(body).toContain("FAIL x.test.ts");
    expect(body).toContain("test run");
    expect(body).toContain('data-copy="$ pnpm test');
  });

  it("marks the exit badge by status", async () => {
    const { body } = await render(
      ':::terminal{cmd="pnpm build" exit="0"}\n\n```\ndone\n```\n\n:::'
    );
    expect(body).toContain("exit 0");
    expect(body).toContain("bg-emerald-900");
  });

  it("renders ```console fences as transcripts with $ prompt lines", async () => {
    const { body } = await render(
      '```console exit="0"\n$ rg foo src/\nsrc/x.ts: 3\n```'
    );
    expect(body).toContain("exit 0");
    expect(body).toContain("src/x.ts: 3");
    // prompt line renders the literal `$ ` prefix in emerald
    expect(body).toContain(">$</span> rg foo src/");
    // no code figure / shiki highlighting
    expect(body).not.toContain("language-console");
  });

  it("still highlights plain fenced code normally", async () => {
    const { body } = await render("```bash\necho hi\n```");
    expect(body).toContain("--shiki-light:");
  });

  it("renders :::hypotheses with status pills", async () => {
    const { body } = await render(
      ':::hypotheses\n\n<Hypothesis status="supported" title="A holds" />\n<Hypothesis status="refuted" title="B ruled out" />\n<Hypothesis status="untested" title="C open" />\n\n:::'
    );
    expect(body).toContain("Supported");
    expect(body).toContain("Refuted");
    expect(body).toContain("Untested");
  });

  it("summarizes hypothesis counts in the container", async () => {
    const { body } = await render(
      ':::hypotheses\n\n<Hypothesis status="supported" />\n<Hypothesis status="refuted" />\n<Hypothesis status="untested" />\n\n:::'
    );
    expect(body).toContain("3 hypotheses");
    expect(body).toContain("1 supported");
    expect(body).toContain("1 refuted");
  });

  it("renders :::trace with an error line and numbered frames", async () => {
    const { body } = await render(
      ':::trace{error="TypeError: boom"}\n\n<TraceFrame name="parse" path="src/a.ts" lines="10" />\n<TraceFrame name="run" path="src/b.ts" />\n\n:::'
    );
    expect(body).toContain("TypeError: boom");
    expect(body).toContain("#0");
    expect(body).toContain("#1");
    expect(body).toContain("parse");
    expect(body).toContain("src/a.ts:10");
  });

  it("dims lib frames with a tag", async () => {
    const { body } = await render(
      ':::trace\n\n<TraceFrame name="visit" path="node_modules/x/index.js" kind="lib" />\n\n:::'
    );
    expect(body).toContain("lib");
    expect(body).toContain("opacity-60");
  });

  it("renders :::searches rows with hit badges", async () => {
    const { body } = await render(
      ':::searches\n\n<Search pattern="evaluate" path="src/" tool="rg" hits="3" />\n<Search pattern="hydrateRoot" path="src/" hits="0">dead end</Search>\n\n:::'
    );
    expect(body).toContain("evaluate");
    expect(body).toContain("in src/");
    expect(body).toContain("3 hits");
    expect(body).toContain("no hits");
    expect(body).toContain("dead end");
  });

  it("summarizes search totals in the container", async () => {
    const { body } = await render(
      ':::searches{title="Method"}\n\n<Search pattern="a" hits="3" />\n<Search pattern="b" hits="0" />\n\n:::'
    );
    expect(body).toContain("Method");
    expect(body).toContain("2 searches");
    expect(body).toContain("3 hits");
  });

  it("renders <Toc> as a collapsible outline", async () => {
    const { body } = await render("<Toc />\n\n## Alpha\n");
    expect(body).toContain("mdxr-toc");
    expect(body).toContain("<details");
    expect(body).toContain("<summary");
    expect(body).toContain("mdxr-toc-body");
  });

  it("renders <Details> as a native collapsible", async () => {
    const { body } = await render(
      '<Details summary="Why">because</Details>\n\n<Details open summary="Open">shown</Details>'
    );
    expect(body).toContain('class="mdxr-details');
    expect(body).toContain("<summary");
    expect(body).toContain(">because<");
    expect(body).toContain("open");
    expect(body).toContain("shown");
  });

  it("renders <Ask> questions on native form controls", async () => {
    const { body } = await render(
      '<Ask title="Decide"><Question name="approach" type="choice" label="How"><Choice value="a">A案</Choice><Choice value="b" checked>B案</Choice></Question><Question name="scope" type="multi" label="Scope"><Choice value="api">API</Choice></Question></Ask>'
    );
    expect(body).toContain("data-ask");
    expect(body).toContain('type="radio"');
    // Choice groups carry the question name plus a per-question useId so two
    // questions sharing `name` can't clobber each other's selection.
    expect(body).toContain('name="approach_');
    expect(body).toContain('type="checkbox"');
    expect(body).toContain('name="scope_');
  });

  it("renders text/textarea/select/toggle questions", async () => {
    const { body } = await render(
      '<Ask><Question name="when" type="text" label="期限" placeholder="yyyy-mm-dd" /><Question name="note" type="textarea" label="補足" /><Question name="prio" type="select" label="優先度"><Choice value="h">高</Choice></Question><Question name="beta" type="toggle" label="ベータ" checked /></Ask>'
    );
    expect(body).toContain('type="text"');
    expect(body).toContain("<textarea");
    expect(body).toContain("<select");
    expect(body).toContain("<option");
    expect(body).toContain("mdxr-switch");
  });

  it("wires the Copy answers button for the client handler", async () => {
    const { body } = await render(
      '<Ask title="T"><Question name="x" type="text" /></Ask>'
    );
    expect(body).toContain("data-ask-copy");
    expect(body).toContain('data-ask-title="T"');
    expect(body).toContain("Copy answers");
  });

  it("renders the Markdown answer pane and Save .md button", async () => {
    const { body } = await render(
      '<Ask title="T"><Question name="x" type="text" /></Ask>'
    );
    expect(body).toContain("data-ask-output");
    expect(body).toContain("data-ask-save");
    expect(body).toContain("Save .md");
  });

  it("tags each question wrapper with its label and type", async () => {
    const { body } = await render(
      '<Ask><Question name="when" type="text" label="期限" /><Question name="beta" type="toggle" label="ベータ" /><Question name="x" type="text" /></Ask>'
    );
    expect(body).toContain('data-q-label="期限"');
    expect(body).toContain('data-q-type="text"');
    expect(body).toContain('data-q-type="toggle"');
    // No label falls back to the answer key.
    expect(body).toContain('data-q-label="x"');
  });

  it("renders Flow as a numbered chain with locations", async () => {
    const { body } = await render(
      '<Flow title="Request path"><FlowStep name="cli()" path="src/cli.ts" lines="12-30">parse argv</FlowStep><FlowStep name="mdxToHtml()" path="src/mdx.ts">compile</FlowStep></Flow>'
    );
    expect(body).toContain("Request path");
    expect(body).toContain("cli()");
    expect(body).toContain("src/cli.ts:12-30");
    expect(body).toContain("mdxToHtml()");
    expect(body).toContain("<ol");
  });

  it("converts :::flow into Flow", async () => {
    const { body } = await render(
      ':::flow{title="Pipeline"}\n<FlowStep name="a" />\n:::'
    );
    expect(body).toContain("Pipeline");
    expect(body).toContain(">a<");
  });

  it("renders Findings with confidence pills and a count summary", async () => {
    const { body } = await render(
      '<Findings><Finding confidence="confirmed" title="Sync render">evidence</Finding><Finding confidence="unverified">guess</Finding></Findings>'
    );
    expect(body).toContain("Confirmed");
    expect(body).toContain("Unverified");
    expect(body).toContain("Sync render");
    expect(body).toContain("2 findings");
  });

  it("counts findings by confidence in the summary", async () => {
    const { body } = await render(
      '<Findings><Finding confidence="confirmed" title="Sync render">evidence</Finding><Finding confidence="unverified">guess</Finding></Findings>'
    );
    expect(body).toContain("1 confirmed");
    expect(body).toContain("1 unverified");
  });

  it("converts :::finding into Finding", async () => {
    const { body } = await render(
      ':::finding{confidence="inferred"}\nprobably caches\n:::'
    );
    expect(body).toContain("Inferred");
    expect(body).toContain("probably caches");
  });

  it("rejects an unknown Finding confidence", async () => {
    await expect(
      render('<Finding confidence="maybe">x</Finding>')
    ).rejects.toThrow(/Invalid props/u);
  });

  it("renders Files rows with kind chips and notes", async () => {
    const { body } = await render(
      '<Files><File path="src/mdx.ts" kind="entry">pipeline entry</File><File path="tests/x.ts" kind="test" /></Files>'
    );
    expect(body).toContain("src/mdx.ts");
    expect(body).toContain("entry");
    expect(body).toContain("pipeline entry");
    expect(body).toContain("test");
  });

  it("renders Deps edges with kind labels", async () => {
    const { body } = await render(
      '<Deps><Dep from="src/cli.ts" to="src/render.ts" kind="calls" /><Dep from="src/mdx.ts" to="remark-gfm" kind="imports">plugin</Dep></Deps>'
    );
    expect(body).toContain("src/cli.ts");
    expect(body).toContain("src/render.ts");
    expect(body).toContain("calls");
    expect(body).toContain("imports");
    expect(body).toContain("plugin");
  });

  it("converts :::files and :::deps into containers", async () => {
    const { body } = await render(
      ':::files\n<File path="a.ts" />\n:::\n\n:::deps\n<Dep from="a" to="b" />\n:::'
    );
    expect(body).toContain("a.ts");
    expect(body).toContain("imports");
  });

  it("renders Commit chips linking to the commit", async () => {
    const { body } = await render(
      '<Commit repo="a/b" sha="0123456789abcdef">initial</Commit>'
    );
    expect(body).toContain("github.com/a/b/commit/0123456789abcdef");
    expect(body).toContain("0123456");
    expect(body).toContain("initial");
  });

  it("converts :::answer and [!ANSWER] into an Answer callout", async () => {
    const { body } = await render(
      ":::answer\nThe entry point is src/cli.ts.\n:::\n\n> [!ANSWER]\n> yes\n"
    );
    expect(body).toContain("Answer");
    expect(body).toContain("The entry point is src/cli.ts.");
    expect(body).toContain("yes");
  });

  it("renders a ```diff fence as structured per-file cards", async () => {
    const { body } = await render(
      "```diff\ndiff --git a/src/a.ts b/src/a.ts\nindex 111..222 100644\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,2 +1,2 @@\n-old\n+new\n context\n```"
    );
    for (const s of [
      "src/a.ts",
      "+1",
      "−1",
      "@@ -1,2 +1,2 @@",
      "old",
      "new",
      "index 111..222 100644",
    ]) {
      expect(body).toContain(s);
    }
  });

  it("renders a ```patch fence the same way", async () => {
    const { body } = await render(
      "```patch\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-a\n+b\n```"
    );
    expect(body).toContain("x.ts");
    expect(body).toContain("+1");
  });

  it("marks new and deleted files in diffs", async () => {
    const { body } = await render(
      "```diff\n--- /dev/null\n+++ b/added.ts\n@@ -0,0 +1 @@\n+hi\n```\n\n```diff\n--- a/gone.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-bye\n```"
    );
    expect(body).toContain("new file");
    expect(body).toContain("deleted");
  });

  it("renders bare +/- streams without headers", async () => {
    const { body } = await render("```diff\n+added line\n-removed line\n```");
    expect(body).toContain("added line");
    expect(body).toContain("removed line");
    expect(body).toContain("+1");
    expect(body).toContain("−1");
  });

  it("renders a Graph with svg edges and node cards", async () => {
    const { body } = await render(
      '<Graph title="Pipeline"><Node id="a" label="parse" /><Node id="b" label="render" /><Edge from="a" to="b" label="html" /></Graph>'
    );
    expect(body).toContain("<svg");
    expect(body).toContain("Pipeline");
    expect(body).toContain("parse");
    expect(body).toContain("render");
    expect(body).toContain("html");
  });

  it("accepts :::graph directives", async () => {
    const { body } = await render(
      ':::graph\n<Node id="a" />\n<Node id="b" />\n<Edge from="a" to="b" />\n:::'
    );
    expect(body).toContain("<svg");
  });

  it("renders Tests with per-status counts", async () => {
    const { body } = await render(
      '<Tests title="unit" tool="vitest"><Test name="parses" status="pass" duration="12ms" /><Test name="renders" status="fail" duration="800ms">boom</Test><Test name="skips" status="skip" /></Tests>'
    );
    for (const s of [
      "parses",
      "1 passed",
      "1 failed",
      "1 skipped",
      "vitest",
      "boom",
    ]) {
      expect(body).toContain(s);
    }
  });

  it("accepts :::tests directives", async () => {
    const { body } = await render(
      ':::tests\n<Test name="t" status="pass" />\n:::'
    );
    expect(body).toContain("1 passed");
  });

  it("renders Endpoints with method chips and a base prefix", async () => {
    const { body } = await render(
      '<Endpoints base="/api/v1" title="API"><Endpoint method="POST" path="/users" auth="admin">create</Endpoint><Endpoint method="get" path="/users" /></Endpoints>'
    );
    for (const s of ["POST", "GET", "/api/v1", "/users", "admin", "create"]) {
      expect(body).toContain(s);
    }
  });

  it("renders Json as a collapsible tree", async () => {
    const { body } = await render(
      '<Json title="cfg" value=\'{"a":1,"b":[true,null],"c":{"d":"x"}}\' />'
    );
    for (const s of [
      "mdxr-json",
      "<details",
      'open=""',
      "&quot;a&quot;",
      "&quot;d&quot;",
      "true",
      "null",
    ]) {
      expect(body).toContain(s);
    }
  });

  it("renders Json from a fenced child and honors open", async () => {
    const { body } = await render(
      '<Json open="false">\n\n```json\n{"k": [1, 2]}\n```\n\n</Json>'
    );
    expect(body).toContain("mdxr-json");
    expect(body).toContain("&quot;k&quot;");
    expect(body).not.toContain('open=""');
  });

  it("rejects invalid JSON in Json", async () => {
    await expect(render('<Json value="{oops" />')).rejects.toThrow(
      /invalid JSON/iu
    );
  });

  it("renders a Waterfall with positioned span bars", async () => {
    const { body } = await render(
      '<Waterfall title="request" unit="ms"><Span name="db" start="0" duration="120ms" /><Span name="api" start="120" duration="80" /></Waterfall>'
    );
    expect(body).toContain("request");
    expect(body).toContain("db");
    expect(body).toContain("api");
    expect(body).toContain("left:60%");
    expect(body).toContain("200");
  });

  it("accepts :::waterfall directives", async () => {
    const { body } = await render(
      ':::waterfall\n<Span name="s" duration="50ms" />\n:::'
    );
    expect(body).toContain("s");
    expect(body).toContain("50ms");
  });

  it("renders a Gantt with positioned task bars and a milestone", async () => {
    const { body } = await render(
      '<Gantt title="release"><Task name="impl" start="2026-09-01" end="2026-09-10" status="doing" progress="40" /><Task name="docs" start="2026-09-11" end="2026-09-20" /><Milestone name="v1" date="2026-09-20" /></Gantt>'
    );
    for (const s of [
      "release",
      "impl",
      "docs",
      "v1",
      "left:0%",
      "width:50%",
      "left:50%",
      "rotate-45",
      "Sep 1–10",
      "Sep 11–20",
      "Sep 20",
      "bg-sky-500",
    ]) {
      expect(body).toContain(s);
    }
  });

  it("accepts :::gantt directives", async () => {
    const { body } = await render(
      ':::gantt{title="g"}\n<Task name="t" start="2026-10-01" end="2026-10-05" />\n:::'
    );
    expect(body).toContain("g");
    expect(body).toContain("t");
    expect(body).toContain("Oct 1–5");
  });

  it("honors Gantt start/end overrides and the today marker", async () => {
    const { body } = await render(
      '<Gantt start="2026-09-01" end="2026-09-30" today="2026-09-16"><Task name="t" start="2026-09-01" end="2026-09-10" /></Gantt>'
    );
    // day 15 of 30 → the today line sits at 50%
    expect(body).toContain("bg-red-500/70");
    expect(body).toContain("left:50%");
  });

  it('hides the Gantt today marker with today="false"', async () => {
    const { body } = await render(
      '<Gantt start="2026-09-01" end="2026-09-30" today="false"><Task name="t" start="2026-09-01" /></Gantt>'
    );
    expect(body).not.toContain("bg-red-500/70");
  });

  it("renders a Board with lanes, counts, and card chips", async () => {
    const { body } = await render(
      '<Board><Lane title="Todo" status="todo"><BoardCard title="Write docs" priority="p1" owner="aoba" /></Lane><Lane title="Done" status="done"><BoardCard title="Ship" status="done" /></Lane></Board>'
    );
    for (const s of [
      "Todo",
      "Done",
      "Write docs",
      "Ship",
      "aoba",
      ">1</span>",
    ]) {
      expect(body).toContain(s);
    }
  });

  it("emits the board's interactive hooks (drag, move, copy)", async () => {
    const { body } = await render(
      '<Board title="Sprint"><Lane title="Todo" status="todo"><BoardCard title="Write docs" priority="p1" owner="aoba">some notes</BoardCard></Lane></Board>'
    );
    for (const s of [
      'data-board=""',
      'data-board-title="Sprint"',
      'data-board-lane=""',
      'data-lane-title="Todo"',
      'data-lane-status="todo"',
      'data-board-cards=""',
      'data-board-card=""',
      'draggable="true"',
      'data-card-title="Write docs"',
      'data-card-priority="p1"',
      'data-card-owner="aoba"',
      'data-card-text="some notes"',
      'data-board-move="-1"',
      'data-board-move="1"',
      'data-board-copy=""',
      "Copy markdown",
    ]) {
      expect(body).toContain(s);
    }
  });

  it("accepts :::board directives", async () => {
    const { body } = await render(
      ':::board\n<Lane title="T"><BoardCard title="c" /></Lane>\n:::'
    );
    expect(body).toContain("T");
    expect(body).toContain("c");
  });

  it("renders a Matrix with column headers and icon cells", async () => {
    const { body } = await render(
      '<Matrix title="Compare" cols="mdx, mdxr">\n- syntax | yes | no\n- charts | ~ | yes\n</Matrix>'
    );
    for (const s of [
      "Compare",
      "mdx",
      "mdxr",
      "syntax",
      "charts",
      'aria-label="yes"',
      'aria-label="no"',
      'aria-label="partial"',
    ]) {
      expect(body).toContain(s);
    }
  });

  it("accepts :::matrix directives", async () => {
    const { body } = await render(':::matrix{cols="a,b"}\n- f | yes | no\n:::');
    expect(body).toContain('aria-label="yes"');
  });

  it("renders Ins and Del as semantic inline edits", async () => {
    const { body } = await render(
      "change <Del>old</Del> to <Ins>new</Ins> here"
    );
    expect(body).toContain("<del");
    expect(body).toContain("<ins");
    expect(body).toContain("old");
    expect(body).toContain("new");
  });
});
