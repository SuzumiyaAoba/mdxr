# rv component reference

MDX attributes are always strings (`status="done"`). `children` is Markdown.

This file is an index: each group lists what its components do and links to a detail file with full signatures and examples. Read only the detail file(s) the document needs. `rv catalog --json` is the machine-readable source of truth for component names and attributes.

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
| `<Decision>` | ADR-lite decision record (one-liner → `:::decision` callout) |
| `<Option>` | Alternative-comparison card (recommended/considered/rejected) |
| `<Risk>` | Risk block — severity pill + mitigation line |
| `<Approvals>` / `<Approval>` | Sign-off list |
| `<Stats>` / `<Stat>` | Metric card grid; `delta` colored by sign |
| `<Priority>` `<Effort>` `<Due>` `<Owner>` | Inline chips (priority, T-shirt effort, deadline, person) |
| `<Reqs>` / `<Req>` | Requirement / acceptance-criteria rows |
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
| `<Tree>` | File tree from a nested list, automatic icons |
| `<FileRef>` | Inline file-reference chip with copy button |
| `<SymbolRef>` | Inline symbol chip (fn/type/class/…) |
| `<CodeFile>` | Embeds a real file from disk as a code block |
| `<Props>` / `<Prop>` | API/props table for a component or function |

## Layout — details: [components/layout.md](components/layout.md)

| Component | What it is |
| --- | --- |
| `<Columns>` / `<Column>` | Simple side-by-side grid (2–4 columns) |
| `<Grid>` / `<Cell>` | 12-track grid — spans, dense flow, auto-fit card grids |
| `<Before>` / `<After>` | Red/green compare panels |

## Reader input — details: [components/forms.md](components/forms.md)

| Component | What it is |
| --- | --- |
| `<Ask>` / `<Question>` / `<Choice>` | Native-form question blocks; "Copy answers" serializes the filled state |

## shadcn/ui — details: [components/shadcn.md](components/shadcn.md)

The full shadcn/ui (Base UI) set is registered (`Button`, `Card`, `Table`, `Tabs`, …). Documents have no client-side hydration, so stateful primitives render their initial state only — prefer `Card`/`Alert`/`Badge`/`Table` and the native-element built-ins (`<Ask>`, `<Details>`, `<Toc>`) for interactivity.

## Project-defined components — details: [extending.md](extending.md)

Projects can register their own components via `rv.config.ts` + `defineComponent`; a same-name component overrides the built-in.
