# mdxr

Render agent-authored MDX documents (plans, reports) to standalone HTML with a semantic component catalog.

## Usage

Run directly with `npx` — no install required:

```sh
npx mdxr render plan.mdx     # writes plan.html
npx mdxr serve plan.mdx      # live preview at http://localhost:3737
npx mdxr catalog             # list available components
npx mdxr init                # install the mdxr agent skill into the project
```

Or install it:

```sh
npm install -g mdxr          # global CLI
npm install mdxr             # library: import { render } from "mdxr"
```

### `mdxr render [file]`

Render an `.mdx` file (or stdin) to a standalone HTML file.

```sh
mdxr render plan.mdx                 # → plan.html
mdxr render plan.mdx -o out.html     # custom output path
cat plan.mdx | mdxr render > out.html # stdin → stdout
mdxr render plan.mdx --no-hydrate    # static HTML, no client bundle
mdxr render plan.mdx --format json   # machine-readable errors
```

### `mdxr serve [file]`

Preview a document in the browser with live reload (`-p, --port`, default `3737`).

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
