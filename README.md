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
