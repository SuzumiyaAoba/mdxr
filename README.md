# mdxr

Render agent-authored MDX documents (plans, reports) to standalone HTML with a semantic component catalog.

## Usage

Run directly with `npx` — no install required:

```sh
npx @suzumiyaaoba/mdxr render plan.mdx     # writes plan.html
npx @suzumiyaaoba/mdxr serve plan.mdx      # live preview at http://localhost:3737
npx @suzumiyaaoba/mdxr catalog             # list available components
npx @suzumiyaaoba/mdxr init                # install the mdxr agent skill into the project
```

Or install it:

```sh
npm install -g @suzumiyaaoba/mdxr          # global CLI
npm install @suzumiyaaoba/mdxr             # library: import { render } from "@suzumiyaaoba/mdxr"
```

### `mdxr render [file]`

Render an `.mdx` file (or stdin) to a standalone HTML file.

```sh
mdxr render plan.mdx                 # → plan.html
mdxr render plan.mdx -o out.html     # custom output path
cat plan.mdx | mdxr render > out.html # stdin → stdout
mdxr render plan.mdx --open          # also open plan.html in the default browser
mdxr render plan.mdx --no-hydrate    # static HTML, no client bundle
mdxr render plan.mdx --format json   # machine-readable errors
```

### `mdxr serve [file]`

Preview a document in the browser with live reload (`-p, --port`, default `3737`; `--open` to launch the browser once serving).

### Review the rendered document

Select text and click **Add comment**, or open **Annotate → Select figure** to comment on an image, diagram, or chart. Edit or delete comments in the panel, then **Copy Markdown** to send the quoted targets, source locations, and feedback to a coding agent.

Saved annotations remain in your browser for that document; they do not modify the source file or travel with the HTML. If the document changes, targets that cannot be identified keep their original quotes and are marked unavailable. [Review annotations](https://suzumiyaaoba.com/mdxr/annotations) describes keyboard shortcuts, storage, and clipboard fallbacks.

### `mdxr text [file]`

Render an `.mdx` document to plain Markdown — every component becomes an ASCII/text stand-in (status checkbox lists, block-bar charts, GFM tables, `<details>` disclosures) so the document stays readable in any Markdown viewer or terminal. Interactive-only widgets (dialogs, menus, shadcn chrome) degrade to their text content; unknown components warn to stderr and keep their children.

```sh
mdxr text plan.mdx                  # → plan.txt.md
mdxr text plan.mdx -o plan.md       # custom output path
cat plan.mdx | mdxr text > plan.md  # stdin → stdout
```

### `mdxr catalog`

List built-in and project-defined components (`--json` for machine-readable output, `--dir` to target a project).

### `mdxr init`

Install the mdxr agent skill so coding agents know the component catalog.

```sh
mdxr init                  # → .agents/skills/mdxr/
mdxr init --tool claude    # → .claude/skills/mdxr/
mdxr init --tool all       # all supported tools
mdxr init --global         # into your home directory instead
```

Local installs also add `.mdxr/` to the project's `.gitignore` — the untracked scratch dir agents write documents to.

## Agent skill

The `mdxr` skill teaches coding agents the component catalog and the render workflow. Install it into your project (or globally) with the [`skills` CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add Suzumiyaaoba/mdxr --skill mdxr
# add -g for a global install, or -a claude-code to target a specific agent
```

Then ask your agent, for example:

> Use the mdxr skill to write an implementation plan for the auth feature and render it to HTML.

Not just plans — any deliverable works (reports, reviews, investigation summaries, …). To make this automatic, add a standing instruction to your agent config (e.g. `AGENTS.md` / `CLAUDE.md`):

```md
- Whenever the user explicitly asks for a deliverable with mdxr, use the mdxr skill to write and render it.
```

## License

MIT
