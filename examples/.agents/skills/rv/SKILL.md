---
name: rv
description: Write rich plan/report documents as MDX using the rv component catalog, then render them to standalone HTML with `npx @suzumiyaaoba/rv render`. Use when creating plan files, status reports, reviews, or any structured document meant to be viewed as a styled HTML page.
---

# rv — agent-authored documents rendered to HTML

Write documents as **Markdown + a small set of JSX components** (MDX). Do NOT write raw HTML: `rv render` compiles the document deterministically, so markup, styling and scripts are never emitted by the model.

## Workflow

1. Write the document as `*.mdx` using Markdown plus the components below.
2. Render: `npx @suzumiyaaoba/rv render plan.mdx -o plan.html`
3. On errors, the message includes `file:line:col` — fix and re-run. `npx @suzumiyaaoba/rv render plan.mdx --format json` prints machine-readable errors.
4. Preview while editing: `npx @suzumiyaaoba/rv serve plan.mdx`

## Rules

- **No JS in documents.** `import`/`export` and `{expressions}` are rejected. All attributes are strings: `<Step status="done">`, not `status={...}`.
- Prefer plain Markdown for prose; use components only for structure.
- If a needed component is missing, run `npx @suzumiyaaoba/rv catalog --json` to see the full catalog, then define it in the project's component file — see `references/components.md` for the extension mechanism.
- Use `references/components.md` for the full component reference.

## Conventions (no JSX needed)

| Write | Get |
| --- | --- |
| `:::note` / `:::warning` / `:::decision` … | `<Callout kind>` |
| `> [!NOTE]` GitHub alert | `<Callout>` |
| `:::phase{title="…" status="doing"}` | `<Phase>` |
| ` ```mermaid ` fenced block | rendered diagram |
| ` ```ts title="src/x.ts" ` | highlighted code block + filename bar |
| `- [ ]` / `- [x]` | styled task list |
