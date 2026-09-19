---
name: mdxr
description: Write rich plan/report documents as MDX using the mdxr component catalog, then render them to standalone HTML with `npx mdxr render`. Use when creating plan files, status reports, reviews, or any structured document meant to be viewed as a styled HTML page.
---

# mdxr — agent-authored documents rendered to HTML

Write documents as **Markdown + a small set of JSX components** (MDX). Do NOT write raw HTML: `mdxr render` compiles the document deterministically, so markup, styling and scripts are never emitted by the model.

## Workflow

1. Write the document as `*.mdx` using Markdown plus the components below.
2. Render: `npx mdxr render plan.mdx -o plan.html`
3. Or pipe MDX directly: `cat plan.mdx | npx mdxr render > plan.html` (`mdxr render -` also reads stdin; `-o out.html` writes a file).
4. On errors, the message includes `file:line:col` — fix and re-run. `npx mdxr render plan.mdx --format json` prints machine-readable errors.
5. Preview while editing: `npx mdxr serve plan.mdx` — or pipe: `cat plan.mdx | npx mdxr serve`

## Rules

- **No JS in documents.** `import`/`export` and `{expressions}` are rejected. All attributes are strings: `<Step status="done">`, not `status={...}`.
- Prefer plain Markdown for prose; use components only for structure.
- If a needed component is missing, run `npx mdxr catalog --json` to see the full catalog, then define it in the project's component file — see `references/extending.md` for the extension mechanism.
- For component usage, read `references/components.md` (the index), then only the `references/components/*.md` detail file(s) the document needs.

## Conventions (no JSX needed)

| Write | Get |
| --- | --- |
| `:::note` / `:::warning` / `:::decision` … | `<Callout kind>` |
| `:::goal` / `:::nongoal` / `:::question` / `:::answer` | goal / non-goal / open-question / conclusion callouts |
| `> [!NOTE]` GitHub alert | `<Callout>` |
| `:::phase{title="…" status="doing"}` | `<Phase>` |
| `:::flow{title="…"}` + `<FlowStep>` | `<Flow>` numbered call/execution chain |
| `:::findings` + `<Finding confidence>` | findings list with confidence pills |
| `:::hypotheses` + `<Hypothesis status>` | hypothesis ledger (supported/refuted/untested) |
| `:::searches` + `<Search pattern hits>` | search-query log |
| `:::trace` + `<TraceFrame>` | stack/call trace with error line |
| `:::terminal{cmd="…" exit="…"}` / ` ```console ` fence | terminal transcript |
| `:::files` / `:::deps` | `<Files>` related-file list / `<Deps>` dependency edges |
| `:::tests` + `<Test>` / `:::endpoints` + `<Endpoint>` | `<Tests>` run report / `<Endpoints>` API list |
| `:::board` + `<Lane>`/`<BoardCard>` | `<Board>` kanban |
| `:::graph` + `<Node>`/`<Edge>` | `<Graph>` static node/edge diagram (dagre layout, no client JS) |
| `:::waterfall` + `<Span>` / `:::matrix` + list | `<Waterfall>` timing bars / `<Matrix>` comparison grid |
| `:::timeline{title="…"}` | `<Timeline>` |
| `:::gantt{title="…"}` + `<Task>`/`<Milestone>` | `<Gantt>` date-based schedule chart |
| `:::barchart` / `:::linechart` / `:::piechart` / `:::scatter` / `:::radar` / `:::funnel` / `:::quadrant` / `:::bridge` / `:::treemap` / `:::sankey` / `:::venn` | static chart panels — see `references/components/charts.md` |
| frontmatter `status:` / `date:` / `owner:` | document header badge + meta row |
| `path`-carrying components (`<FileRef>`, `<File>`, `<TraceFrame>`, `<FlowStep>`, `<Change>`, `<SymbolRef path>`) + `title="…"` code headers | `vscode://file/…` editor links when the file exists; frontmatter `editor:` picks the scheme (`cursor`, `zed`, `none`, …) |
| `` `src/x.ts` `` inline code naming a real file (optional `:L`/`:L-M`) | `<FileRef>` chip — icon, copy button, editor link (a bare `x.ts` stays plain code) |
| ` ```mermaid ` fenced block | rendered diagram |
| ` ```diff ` / ` ```patch ` fenced block | structured per-file diff cards |
| ` ```ts title="src/x.ts" ` | highlighted code block + filename bar with file-type icon |
| `- [ ]` / `- [x]` | styled task list |
| nested list inside `<Tree>` | file tree |
| `<Icon name="lucide:rocket">` / `icon-[lucide--rocket]` class | inline Iconify icon |
