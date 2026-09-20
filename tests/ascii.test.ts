import { describe, expect, it } from "vitest";

import { asciiRenderers, mdxToAscii } from "../src/ascii/index.js";
import { builtinComponents } from "../src/ui/index.js";

const render = async (src: string) => await mdxToAscii(src, "test.mdx");

describe(mdxToAscii, () => {
  it("passes plain markdown through", async () => {
    const src = "# Title\n\nSome **bold** and `code`.\n\n- a\n- b\n";
    const { markdown, warnings } = await render(src);
    expect(warnings).toStrictEqual([]);
    expect(markdown).toContain("# Title");
    expect(markdown).toContain("**bold**");
    expect(markdown).toContain("- a");
  });

  it("renders Plan/Phase/Steps as headings and checkbox lists", async () => {
    const src = `<Plan title="Launch" status="doing" owner="rin">
<Phase title="Build" status="done" />
<Phase title="Ship" status="doing">
<Steps progress>
<Step status="done">compile</Step>
<Step status="doing">package</Step>
<Step status="todo">publish</Step>
</Steps>
</Phase>
</Plan>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("# Launch");
    expect(markdown).toContain("## Build `done`");
    expect(markdown).toContain("[x] compile");
    expect(markdown).toContain("[ ] publish");
  });

  it("shows step progress as a bar", async () => {
    const { markdown } = await render(
      `<Steps progress><Step status="done">a</Step><Step status="todo">b</Step><Step status="todo">c</Step></Steps>`
    );
    expect(markdown).toContain("1/3");
  });

  it("renders callouts and details readably", async () => {
    const src = `:::warning[Careful]\nMind the gap.\n:::\n\n<Details summary="More">\nhidden stuff\n</Details>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("[!WARNING]");
    expect(markdown).toContain("Mind the gap");
    expect(markdown).toContain("<details>");
    expect(markdown).toContain("<summary>More</summary>");
    expect(markdown).toContain("hidden stuff");
  });

  it("renders findings as a numbered confidence list", async () => {
    const src = `<Findings title="Results">
<Finding confidence="high" title="Race in loader" />
<Finding confidence="low" title="Cosmetic drift" />
</Findings>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("**Results**");
    expect(markdown).toContain("1. `HIGH` **Race in loader**");
    expect(markdown).toContain("2. `LOW` **Cosmetic drift**");
  });

  it("renders bar charts as an ASCII bar fence", async () => {
    const src = `<BarChart title="Coverage" unit="%">
<Bar name="core" value="80" />
<Bar name="ui" value="40" />
</BarChart>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("```");
    expect(markdown).toContain("Coverage");
    expect(markdown).toContain("core");
    expect(markdown).toMatch(/core\s+█+░*\s+80%/u);
  });

  it("renders sparklines and scores inline", async () => {
    const src = `Latency <Spark values="1,4,2,8,3" /> done at <Score value="78" max="100" label="audit" />`;
    const { markdown } = await render(src);
    expect(markdown).toMatch(/Latency ▁▄▂█▃ done/u);
    expect(markdown).toContain("78/100");
  });

  it("renders Gantt as an aligned day chart", async () => {
    const src = `<Gantt title="Schedule" start="2026-01-01" end="2026-01-11">
<Task name="build" start="2026-01-01" end="2026-01-05" status="done" />
<Task name="ship" start="2026-01-05" end="2026-01-10" status="doing" />
<Milestone name="v1" date="2026-01-10" />
</Gantt>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("Schedule");
    expect(markdown).toContain("2026-01-01 → 2026-01-11");
    expect(markdown).toMatch(/build\s+█+/u);
    expect(markdown).toContain("◆");
  });

  it("renders reviews with a verdict and quoted comments", async () => {
    const src = `<Review title="PR #42" verdict="changes">
<Comment severity="high" title="N+1 query" file="db.ts" lines="30-40">
Use a join instead.
</Comment>
</Review>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("**PR #42 — Changes requested — 1 high**");
    expect(markdown).toContain("> `HIGH` **N+1 query** — db.ts:30-40");
    expect(markdown).toContain("Use a join instead");
  });

  it("renders endpoints as a GFM table", async () => {
    const src = `<Endpoints base="/api" title="Routes">
<Endpoint method="GET" path="/users" auth="token">list users</Endpoint>
<Endpoint method="POST" path="/users" deprecated />
</Endpoints>`;
    const { markdown } = await render(src);
    // mdast-util-to-markdown pads cells for alignment — compare squashed.
    const squashed = markdown
      .replaceAll(/ +\|/gu, "|")
      .replaceAll(/\| +/gu, "|");
    expect(squashed).toContain("|method|path|flags|description|");
    expect(markdown).toContain("`GET`");
    expect(markdown).toContain("`/api/users`");
    expect(markdown).toContain("deprecated");
  });

  it("renders diffs and terminals as fenced blocks", async () => {
    const src = `<Terminal cmd="pnpm test" exit="0">
3 passed
</Terminal>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("```console");
    expect(markdown).toContain("$ pnpm test");
    expect(markdown).toContain("3 passed");
    expect(markdown).toContain("exit 0");
  });

  it("renders matrix rows as a glyph table", async () => {
    const src = `<Matrix cols="web,cli" title="Support">
- charts | yes | no
- tables | yes | yes
</Matrix>`;
    const { markdown } = await render(src);
    const squashed = markdown
      .replaceAll(/ +\|/gu, "|")
      .replaceAll(/\| +/gu, "|");
    expect(squashed).toContain("|charts|✓|✗|");
    expect(squashed).toContain("|tables|✓|✓|");
  });

  it("renders asks as a readable questionnaire", async () => {
    const src = `<Ask title="Setup">
<Question name="env" label="Environment" type="choice">
<Choice value="dev" />
<Choice value="prod" />
</Question>
</Ask>`;
    const { markdown } = await render(src);
    expect(markdown).toContain("**Setup**");
    expect(markdown).toContain("**Environment**");
    expect(markdown).toContain("`( )` dev");
    expect(markdown).toContain("`( )` prod");
  });

  it("keeps code fences and frontmatter intact", async () => {
    const src = `---\ndraft: true\n---\n\n\`\`\`ts\nconst x: number = 1\n\`\`\`\n`;
    const { markdown } = await render(src);
    expect(markdown).toContain("draft: true");
    expect(markdown).toContain("```ts");
    expect(markdown).toContain("const x: number = 1");
  });

  it("synthesizes a header from frontmatter when no <Plan> exists", async () => {
    const src = `---\ntitle: Weekly report\nstatus: doing\nowner: "@rin"\ndate: 2026-09-16\n---\n\nBody text.`;
    const { markdown } = await render(src);
    expect(markdown).toContain("# Weekly report");
    expect(markdown).toContain(
      "Status: doing · Date: 2026-09-16 · Owner: @rin"
    );
    expect(markdown).not.toContain("title: Weekly report");
  });

  it("keeps the yaml block when a <Plan> supplies the header", async () => {
    const src = `---\ntitle: Doc title\n---\n\n<Plan title="Real plan" />`;
    const { markdown } = await render(src);
    expect(markdown).toContain("title: Doc title");
    expect(markdown).toContain("# Real plan");
  });

  it("warns on unknown components but keeps their text", async () => {
    const { markdown, warnings } = await render(
      `<Wat style="x">inner text</Wat>`
    );
    expect(markdown).toContain("inner text");
    expect(warnings.some((w) => w.includes("Wat"))).toBeTruthy();
  });

  it("unwraps unregistered builtin names without warnings", async () => {
    const { markdown, warnings } = await render(
      `<Dialog><DialogTitle>Hey</DialogTitle></Dialog>`
    );
    expect(markdown).toContain("**Hey**");
    expect(warnings).toStrictEqual([]);
  });
});

describe("registry coverage", () => {
  it("covers or knowingly unwraps every builtin component", () => {
    // Registered names without a renderer still unwrap — but the semantic
    // components must all have one. Shadcn primitives fall back to unwrap.
    const shadcnOnly = Object.keys(builtinComponents).filter(
      (k) => !(k in asciiRenderers)
    );
    expect(shadcnOnly.toSorted()).toMatchSnapshot();
  });
});
