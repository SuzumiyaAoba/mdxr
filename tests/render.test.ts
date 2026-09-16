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
});
