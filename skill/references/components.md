# mdxr component reference

MDX attributes are always strings (`status="done"`). `children` is Markdown.

This file is an index: each group lists what its components do and links to a detail file with full signatures and examples. Read only the detail file(s) the document needs. `mdxr catalog --json` is the machine-readable source of truth for component names and attributes.

**File links.** Components carrying `path` (`FileRef`, `SymbolRef`, `File`, `TraceFrame`, `FlowStep`, `Change`) and fenced-code filename headers become editor links — `vscode://file/…` by default — when the file exists on disk (paths resolve relative to the document). Frontmatter `editor:` or `editor` in `mdxr.config.ts` picks another editor: `cursor`, `zed`, `vscode-insiders`, `windsurf`, `sublime`, `textmate`, `idea`, a custom `{path}`/`{line}` URL template, or `none` to disable. `href="…"` on a component overrides the URL entirely. Inline code works too: `` `src/mdx.ts` `` (optional `:40-52` lines suffix) auto-converts to `<FileRef>` when it resolves to a real file — a bare `mdx.ts` without a `/` stays plain code.

## Document scaffolding — details: [components/document.md](components/document.md)

| Component | What it is |
| --- | --- |
| `<Plan>` | Document root — title header, status badge, meta row (auto-built from frontmatter) |
| `<Meta>` / `<MetaItem>` | Metadata row (`Date · Owner · …`); custom items with an icon |
| `<Callout>` | Highlighted block — `:::note`/`:::warning`/`:::goal`/`:::decision`/…, `> [!NOTE]` |
| `<Details>` | Collapsible section on native `<details>` (works without JS) |
| `<Toc>` | Collapsible, auto-built table of contents — `:::toc` |
| `<Glossary>` / `<Term>` | Definition list for domain terms |
| `<Figure>` | Image with a caption |
| `<Ref>` / `<Issue>` / `<PR>` / `<Commit>` | Linked reference card / inline GitHub chips |
| `<Cmd>` | Inline command chip with copy button |
| `<Icon>` | Inline Iconify SVG — `lucide` + `vscode-icons` bundled, no runtime fetch |
| fenced code / math | Highlighted code block with filename bar and line markers; ` ```mermaid ` diagrams; KaTeX `$…$` |

## Planning & status — details: [components/planning.md](components/planning.md)

| Component | What it is |
| --- | --- |
| `<Phase>` | Section heading with a status badge — `:::phase` |
| `<Steps>` / `<Step>` | Status-aware task list with optional progress bar; owner/effort/priority/due chips |
| `<Timeline>` / `<Event>` | Dated milestone rail — `:::timeline` |
| `<Gantt>` / `<Task>` / `<Milestone>` | Date-based schedule chart — `:::gantt` |
| `<Decision>` | ADR-lite decision record (one-liner → `:::decision` callout) |
| `<Option>` | Alternative-comparison card (recommended/considered/rejected) |
| `<Risk>` | Risk block — severity pill + mitigation line |
| `<Approvals>` / `<Approval>` | Sign-off list |
| `<Stats>` / `<Stat>` | Metric card grid; `delta` colored by sign |
| `<Priority>` `<Effort>` `<Due>` `<Owner>` | Inline chips (priority, T-shirt effort, deadline, person) |
| `<Reqs>` / `<Req>` | Requirement / acceptance-criteria rows |
| `<Board>` / `<Lane>` / `<BoardCard>` | Interactive kanban — lanes with status dots and card counts; cards drag between lanes, "Copy markdown" copies the updated `<Board>` markup — `:::board` |
| `<Matrix>` | Comparison grid — nested list rows, `yes`/`no`/`partial`/`✓`/`✗`/`△` cells render as icons — `:::matrix` |
| `<Summary>` | Progress bar |
| `<StatusBadge>` | Standalone status pill |

## Code investigation — details: [components/investigation.md](components/investigation.md)

| Component | What it is |
| --- | --- |
| `<Findings>` / `<Finding>` | Numbered findings with confidence pills — `:::findings` |
| `<Hypotheses>` / `<Hypothesis>` | Hypothesis ledger (supported/refuted/untested) — `:::hypotheses` |
| `<Terminal>` | Command transcript (`$` prompts, output, exit badge) — `:::terminal`, ` ```console ` |
| `<Trace>` / `<TraceFrame>` | Stack/call trace with error line, dimmed lib frames — `:::trace` |
| `<Searches>` / `<Search>` | Search-query log (pattern/scope/tool/hits) — `:::searches` |
| `<Files>` / `<File>` | Related-file inventory — `:::files` |
| `<Deps>` / `<Dep>` | Dependency-edge list — `:::deps` |
| `<Changes>` / `<Change>` | Change-set list (add/modify/delete/rename) |
| `<Flow>` / `<FlowStep>` | Numbered call/execution chain — `:::flow` |
| `<Tree>` | File tree from a nested list — collapsible folders, `…` placeholders, bold highlights, automatic icons |
| `<FileRef>` | Inline file-reference chip with copy button |
| `<SymbolRef>` | Inline symbol chip (fn/type/class/…) |
| `<CodeFile>` | Embeds a real file from disk as a code block |
| `<Props>` / `<Prop>` | API/props table for a component or function |

## Output artifacts — details: [components/output.md](components/output.md)

| Component | What it is |
| --- | --- |
| ` ```diff ` / ` ```patch ` fence | Structured per-file diff cards — editor links, `+N −M` stats, hunk line numbers |
| `<Graph>` / `<Node>` / `<Edge>` | Static node/edge diagram — dagre layout at render time, SVG edges, editor-linked nodes — `:::graph` |
| `<Tests>` / `<Test>` | Test-run report — status pills, auto counts and duration sum — `:::tests` |
| `<Endpoints>` / `<Endpoint>` | API route list — method chips, `base` prefix, `auth`/`deprecated` — `:::endpoints` |
| `<Json>` | Collapsible JSON tree on nested `<details>` — `value` attr or fenced child |
| `<Waterfall>` / `<Span>` | Timing waterfall (OTel-trace-style bars) — `:::waterfall` |
| `<Ins>` / `<Del>` | Inline word-level edits — semantic `<ins>`/`<del>` |

## Data visualization — details: [components/charts.md](components/charts.md)

All charts are static SVG/HTML at render time (no client JS); `tone` pins a color, `unit` labels values.

| Component | What it is |
| --- | --- |
| `<BarChart>` / `<Bar>` | Category comparison — vertical/horizontal, grouped or stacked series — `:::barchart` |
| `<LineChart>` / `<Series>` | Trend lines over ordered categories; `area` fill, `dash` series — `:::linechart` |
| `<PieChart>` / `<Slice>` | Part-of-whole pie/donut with legend — `:::piechart` |
| `<Scatter>` / `<Point>` | Two-axis correlation; `size` bubbles — `:::scatter` |
| `<Radar>` / `<Series>` | Spider chart on 3+ shared axes — `:::radar` |
| `<Funnel>` / `<Stage>` | Stage-by-stage narrowing with conversion percents — `:::funnel` |
| `<Quadrant>` / `<Pin>` | 2-axis positioning map with labeled regions — `:::quadrant` |
| `<Bridge>` / `<Delta>` | Running-total waterfall (start→deltas→end) — `:::bridge` |
| `<Treemap>` / `<Tile>` | Squarified part-of-whole areas — `:::treemap` |
| `<Sankey>` / `<Link>` / `<Node>` | Flow split/merge across stage columns — `:::sankey` |
| `<Venn>` / `<Set>` / `<Overlap>` | 2–3 set overlap diagram — `:::venn` |

## Layout — details: [components/layout.md](components/layout.md)

| Component | What it is |
| --- | --- |
| `<Columns>` / `<Column>` | Simple side-by-side grid (2–4 columns) |
| `<Grid>` / `<Cell>` | 12-track grid — spans, dense flow, auto-fit card grids |
| `<Row>` | Horizontal flex-wrap row — groups inline components (`Button`, `Badge`, …) that MDX would otherwise render glued together |
| `<Stack>` | Vertical stack with `gap` — for margin-less components (`Input`, `Textarea`, `Progress`, …) |
| `<Before>` / `<After>` | Red/green compare panels |

## Reader input — details: [components/forms.md](components/forms.md)

| Component | What it is |
| --- | --- |
| `<Ask>` / `<Question>` / `<Choice>` | Native-form question blocks; answers show live as Markdown to copy or save |

## shadcn/ui — details: [components/shadcn.md](components/shadcn.md)

The full shadcn/ui (Base UI) set is registered (`Button`, `Card`, `Table`, `Tabs`, …). Rendered documents carry a hydration bundle, so stateful primitives (`Tabs`, `Accordion`, `Switch`, …) are interactive in the browser — pass `--no-hydrate` for purely static output.

## Project-defined components — details: [extending.md](extending.md)

Projects can register their own components via `mdxr.config.ts` + `defineComponent`; a same-name component overrides the built-in.
