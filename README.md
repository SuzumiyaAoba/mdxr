# mdxr

Render agent-authored MDX documents (plans, reports) to standalone HTML with a semantic component catalog.

## Usage

Run directly with `npx` — no install required:

```sh
npx @suzumiyaaoba/mdxr render plan.mdx     # writes plan.html
npx @suzumiyaaoba/mdxr serve plan.mdx      # live preview at http://localhost:3737
npx @suzumiyaaoba/mdxr catalog             # list available components
npx @suzumiyaaoba/mdxr init                # install mdxr instructions for Codex and Claude
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

Preview a document in the browser with live reload (`-p, --port`, default `3737`; if taken, the next free port is used; `--open` to launch the browser once serving).

### Review the rendered document

Select text and click **Add comment**, or open **Annotate → Select figure** to comment on an image, diagram, or chart. Edit or delete comments in the panel, then **Copy Markdown** to send the quoted targets, source locations, and feedback to a coding agent.

Saved annotations remain in your browser for that document; they do not modify the source file or travel with the HTML. If the document changes, targets that cannot be identified keep their original quotes and are marked unavailable. [Review annotations](https://suzumiyaaoba.com/mdxr/annotations) describes keyboard shortcuts, storage, and clipboard fallbacks.

Each document-level `##` section also has a **Not reviewed / Reviewed** toggle. Review status is saved locally per document and restored after reload; sections with changed content require review again. In **Pages** view, the sidebar shows section statuses and review progress. See [Section review status](https://suzumiyaaoba.com/mdxr/authoring#section-review-status).

In the `mdxr serve` workspace, choose **Export HTML** to download one standalone review archive with the rendered document, chat, comments, section review statuses, every saved MDX version, and their diffs. Images and stylesheets are embedded in the snapshot; if an external resource cannot be captured, export reports an error instead of omitting it. Open the file locally to review or share the captured state without running the server.

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

Install mdxr's authoring instructions for Codex and Claude. By default, the instructions go into your home directory and are referenced from the global agent config files.

```sh
mdxr init                              # Codex + Claude, in your home directory
mdxr init --tool codex                 # Codex only
mdxr init --tool claude --local        # Claude only, in this project
mdxr init --global                     # explicitly install into your home directory
mdxr init --force                      # refresh generated instructions and references
mdxr init --skill                      # install the Agent Skill instead
```

The global install creates `$CODEX_HOME/MDXR.md` (or `~/.codex/MDXR.md` when `CODEX_HOME` is unset) and its `mdxr/references/`, plus matching files under `~/.claude/`. It adds a read instruction to `$CODEX_HOME/AGENTS.md`; Claude's `~/.claude/CLAUDE.md` imports `@./MDXR.md`. Use `--local` to create `.codex/MDXR.md` and `.claude/MDXR.md` in the project, with references from the root `AGENTS.md` and `CLAUDE.md`. A local install also adds `.mdxr/` to `.gitignore` for agent-authored documents and rendered HTML. `--force` refreshes generated instruction files and references while preserving the rest of your config files.

## Wireframes

Build screen mockups with the built-in `Wireframe*` components, adapted from [wireframe-ui](https://wireframe-ui.vercel.app/components). All 45 upstream UI families and nine blocks are included, with their compound parts and wireframe helpers. No imports or extra installation are needed in MDX:

```mdx
<Wireframe title="Sign in" device="mobile">
  <WireframeStack>
    <WireframeHeading>Welcome back</WireframeHeading>
    <WireframeInput label="Email" type="email" />
    <WireframeInput label="Password" type="password" />
    <WireframeButton>Sign in</WireframeButton>
  </WireframeStack>
</Wireframe>
```

Render with `mdxr render wireframe.mdx`. Text/media placeholders, cards, avatars, lists, section presets, and editable fields support light/dark themes and Markdown output. See the [guide](docs/docs/wireframe.mdx) and [examples](examples/catalog/wireframe.mdx). Adapted source retains the [upstream MIT license](src/wireframe-ui.LICENSE.md).

## Agent Skill

If you prefer the Agent Skills format, `mdxr init --skill` installs the bundled skill. You can also install it from the repo with the [`skills` CLI](https://github.com/vercel-labs/skills):

```sh
mdxr init --skill
npx skills add Suzumiyaaoba/mdxr --skill mdxr
# add -g for a global install, or -a claude-code to target a specific agent
```

Once the instructions or skill are installed, ask your agent, for example:

> Write an implementation plan for the auth feature and render it to HTML with mdxr.

Plans, reports, reviews, investigation summaries, release notes, and postmortems all work. Documents go in `.mdxr/` unless you specify another location.

## License

MIT
