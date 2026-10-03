---
name: mdxr
description: Write rich plan/report documents as MDX using the mdxr component catalog, then preview them in the browser with `npx @suzumiyaaoba/mdxr serve` or render them to standalone HTML with `npx @suzumiyaaoba/mdxr render`. Use when creating plan files, status reports, reviews, or any structured document meant to be viewed as a styled HTML page — and whenever the user explicitly asks for a deliverable written or rendered with mdxr, regardless of document type.
---

# mdxr — agent-authored documents rendered to HTML

MDXR version: 0.17.0

Write documents as **Markdown + a small set of JSX components** (MDX). Do NOT write raw HTML: `mdxr render` compiles the document deterministically, so markup, styling and scripts are never emitted by the model.

## Version check

Before using these instructions for a task, run `npx @suzumiyaaoba/mdxr --version` and compare the version in `mdxr/<version>` with the **MDXR version** above. Use the same executable, working directory, and package version that you will use for `render`, `serve`, `text`, or `catalog`: if you use `pnpm exec mdxr`, a global `mdxr`, or a pinned `npx @suzumiyaaoba/mdxr@<version>`, check that exact command instead. Check again if you switch executables or package versions.

If the versions differ in either direction, tell the user both versions and recommend updating these instructions and their references to match the CLI. Use the same CLI with `init --force` and preserve the original installation target:

| Instructions being read | Update arguments |
| --- | --- |
| Global Codex `MDXR.md` in `$CODEX_HOME` or `~/.codex` | `init --tool codex --global --force` |
| Global Claude `~/.claude/MDXR.md` | `init --tool claude --global --force` |
| Project `.codex/MDXR.md` or `.claude/MDXR.md` | `init --tool codex --local --force` or `init --tool claude --local --force`, respectively |
| Agent Skill `SKILL.md` | `init --skill --tool <tool> --local --force` (use `--global` for a home-directory install); `<tool>` is `agents` for `.agents/skills/mdxr`, `claude` for `.claude/skills/mdxr`, or `devin` for `.devin/skills/mdxr` / `~/.config/devin/skills/mdxr` |

For example, when using `npx`, pin the update command to the **reported CLI version**: `npx @suzumiyaaoba/mdxr@<cli-version> init --tool codex --global --force`. Run local updates from the project containing this prompt, and preserve `CODEX_HOME` for global Codex installs. Do not switch to `@latest` just to refresh the prompt, since that may select a different CLI version. For a skill installed through another tool or at another path, use its original installation method and scope to obtain the skill from the matching MDXR version. `--force` replaces the generated prompt and references (including edits made directly to those files); existing `AGENTS.md` / `CLAUDE.md` contents are preserved. After an update, reread the installed prompt and any references already loaded, then check the versions again. If `--version` is unsupported, report that the CLI version could not be verified and recommend upgrading the CLI and reinstalling matching instructions.

## Workflow

1. Write new documents to `.mdxr/yyyyMMddhhmmss-<name>/index.mdx` at the project root. Use a zero-padded 14-digit timestamp from local time; the hour uses 24-hour time. Choose a concise, meaningful name such as `auth-plan`. Keep supporting MDX files, images, and other assets in the document's directory or its subdirectories, using relative references. If the user specifies a filename or full path, use it as given; if they specify only a directory, create a timestamped subdirectory containing `index.mdx` there. When editing an existing document, keep its current path. Record the chosen path once and reuse that exact path in every later command; if each shell call is separate, substitute the recorded path for `$doc` and do not regenerate the timestamp. For example: `doc=".mdxr/$(date +%Y%m%d%H%M%S)-auth-plan/index.mdx"`. Create the parent directory with `mkdir -p "$(dirname "$doc")"` before writing files. `.mdxr/` is untracked scratch space: if the project is a git repo, make sure `.gitignore` lists `.mdxr/` — append it when missing.
2. Show it to the user: in Codex, run `npx @suzumiyaaoba/mdxr serve .mdxr/ --agent codex --open "$doc"`; in Claude Code, use `--agent claude` instead. In other environments, run `npx @suzumiyaaoba/mdxr serve .mdxr/ --open "$doc"` without `--agent`. Serve the whole `.mdxr/` directory and pass the saved document path to `--open` so the browser opens that document's live workspace directly. If the user chose a document outside `.mdxr/`, serve its parent directory and still pass `"$doc"` to `--open`. Run the command **in the background** and leave it running. The directory listing provides access to the other documents; each workspace keeps live reload and, with `--agent`, its chat panel. The server prints `mdxr: library … at http://localhost:PORT` and selects the next free port if needed. Do NOT `mdxr render --open` when the goal is to show the document — that's a one-shot file, not the live preview.
3. Use a saved file when showing a deliverable or using an agent integration. For an ad hoc stdin preview without an agent, explicitly pass `-`: `cat "$doc" | npx @suzumiyaaoba/mdxr serve - --open`. Plain `mdxr serve` serves `.mdxr/`; `--agent` does not support stdin.
4. When a standalone `.html` file is the deliverable itself (to save or share), render it: `npx @suzumiyaaoba/mdxr render "$doc"` (default output is the source path with `.html`, so `index.html` sits beside `index.mdx`). For self-contained documents, piping also works: `cat "$doc" | npx @suzumiyaaoba/mdxr render > "${doc%.*}.html"` (`mdxr render -` also reads stdin; `-o out.html` sets the path).
5. On errors, the message includes `file:line:col` — fix and re-run. `npx @suzumiyaaoba/mdxr render "$doc" --format json` prints machine-readable errors.
6. Plain-text deliverable: `npx @suzumiyaaoba/mdxr text "$doc"` renders the document to Markdown readable in a terminal — components become ASCII stand-ins (checkbox lists, bar charts, GFM tables); interactive-only widgets degrade to their text.
7. Validate a saved document or a directory with `npx @suzumiyaaoba/mdxr check "$doc" --format json` (use `.mdxr/` to check all documents). Diagnostics include source locations, severity and spelling suggestions. Add `--strict` to fail on warnings. The default is static validation without executing project configuration or components; add `--render` to load project components and validate rendering too. No HTML output is written.

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
| `` `src/x.ts` `` naming a real file | `<FileRef>` chip — local preview in `mdxr serve`, editor link in generated HTML |
| `- [ ]` / `- [x]` | styled task list |
| frontmatter `status:` / `date:` / `owner:` | document header badge + meta row |
