---
name: mdxr
description: Write rich plan/report documents as MDX using the mdxr component catalog, then preview them in the browser with `npx @suzumiyaaoba/mdxr serve` or render them to standalone HTML with `npx @suzumiyaaoba/mdxr render`. Use when creating plan files, status reports, reviews, or any structured document meant to be viewed as a styled HTML page — and whenever the user explicitly asks for a deliverable written or rendered with mdxr, regardless of document type.
---

# mdxr — agent-authored documents rendered to HTML

Write documents as **Markdown + a small set of JSX components** (MDX). Do NOT write raw HTML: `mdxr render` compiles the document deterministically, so markup, styling and scripts are never emitted by the model.

## Workflow

1. Write new documents to `.mdxr/yyyyMMddhhmmss-<name>.mdx` at the project root. Use a zero-padded 14-digit timestamp from local time; the hour uses 24-hour time. Choose a concise, meaningful name such as `auth-plan`. If the user specifies a filename or full path, use it as given; if they specify only a directory, create the timestamped filename there. When editing an existing document, keep its current path. Record the chosen path once and reuse that exact path in every later command; if each shell call is separate, substitute the recorded path for `$doc` and do not regenerate the timestamp. For example: `doc=".mdxr/$(date +%Y%m%d%H%M%S)-auth-plan.mdx"`. Create `.mdxr/` if needed. `.mdxr/` is untracked scratch space: if the project is a git repo, make sure `.gitignore` lists `.mdxr/` — append it when missing.
2. Show it to the user: run `npx @suzumiyaaoba/mdxr serve "$doc" --open` **in the background** and leave it running — `serve` stays attached for live reload. It prints `mdxr: serving … at http://localhost:PORT` (if the port is taken it picks the next free one) and `--open` launches that URL in the user's default browser. Do NOT `mdxr render --open` when the goal is to show the document — that's a one-shot file, not the live preview.
3. Or pipe MDX directly: `cat "$doc" | npx @suzumiyaaoba/mdxr serve --open`
4. When a standalone `.html` file is the deliverable itself (to save or share), render it: `npx @suzumiyaaoba/mdxr render "$doc"` (default output is the source path with `.html`). Piping also works: `cat "$doc" | npx @suzumiyaaoba/mdxr render > "${doc%.*}.html"` (`mdxr render -` also reads stdin; `-o out.html` sets the path).
5. On errors, the message includes `file:line:col` — fix and re-run. `npx @suzumiyaaoba/mdxr render "$doc" --format json` prints machine-readable errors.
6. Plain-text deliverable: `npx @suzumiyaaoba/mdxr text "$doc"` renders the document to Markdown readable in a terminal — components become ASCII stand-ins (checkbox lists, bar charts, GFM tables); interactive-only widgets degrade to their text.

## Rules

- **No JS in documents.** `import`/`export` and `{expressions}` are rejected. All attributes are strings: `<Step status="done">`, not `status={...}`.
- **Use the most specific component for the job.** The catalog has dedicated components for structured content — task/status lists → `<Steps>`, file inventories → `<Files>`, test reports → `<Tests>`, API routes → `<Endpoints>`, comparisons → `<Matrix>`/`<Before>`/`<After>`, findings → `<Findings>`, diffs → ` ```diff ` fences. Reach for generic building blocks (plain lists/tables, shadcn `Card`/`Table`/`Tabs`, `Wireframe*`) only when no dedicated component fits — a generic substitute loses the semantic chrome (status badges, counts, editor file links, verdict pills).
- Prefer plain Markdown for prose; use components only for structure.
- If a needed component is missing, run `npx @suzumiyaaoba/mdxr catalog --json` to see the full catalog, then define it in the project's component file — see `references/extending.md` for the extension mechanism.
- For component usage, read `references/components.md` (the index — includes a syntax cheatsheet), then only the `references/components/*.md` detail file(s) the document needs.

## Component categories

| Category | Covers | Details |
| --- | --- | --- |
| Document scaffolding | `<Plan>` root, meta row, callouts, TOC, glossary, refs, code blocks | `references/components/document.md` |
| Planning & status | phases, steps, timeline, gantt, decisions, risks, board, matrix, stats | `references/components/planning.md` |
| Code investigation | findings, hypotheses, terminal, traces, searches, files, flows, trees | `references/components/investigation.md` |
| Output artifacts | diff cards, graphs, tests, endpoints, JSON, waterfalls | `references/components/output.md` |
| Reports | code review, CI checks, vuln/dep audits, metrics, schema/env docs, status/release/incident | `references/components/reports.md` |
| Data visualization | bar/line/pie/scatter/radar/funnel/quadrant/bridge/treemap/sankey/venn | `references/components/charts.md` |
| Layout | columns, grid, row, stack, before/after panels | `references/components/layout.md` |
| Reader input | `<Ask>` question forms with copyable Markdown answers | `references/components/forms.md` |
| shadcn/ui | `Button`, `Card`, `Table`, `Tabs`, … — interactive via hydration | `references/components/shadcn.md` |
| Wireframes | `Wireframe`, `WireframeText`, `WireframeMedia`, `WireframeCard`, inputs and screen layouts from wireframe-ui | `references/components/wireframe.md` |

## Common syntax

| Write | Get |
| --- | --- |
| `:::note` / `:::warning` / `:::decision` / `> [!NOTE]` | `<Callout>` |
| `:::phase{title="…" status="doing"}` | `<Phase>` heading with status badge |
| ` ```ts title="src/x.ts" ` | highlighted code block + filename bar |
| ` ```diff ` / ` ```mermaid ` / ` ```console ` | diff cards / diagram / terminal transcript |
| `` `src/x.ts` `` naming a real file | `<FileRef>` chip with editor link |
| `- [ ]` / `- [x]` | styled task list |
| frontmatter `status:` / `date:` / `owner:` | document header badge + meta row |
