<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-wordmark-dark.svg">
    <img src="assets/logo-wordmark.svg" alt="mdxr" width="218" height="70">
  </picture>
</h1>

Render agent-authored MDX documents (plans, reports) to standalone HTML with a semantic component catalog.

## Usage

Run directly with `npx` — no install required:

```sh
npx @suzumiyaaoba/mdxr render plan.mdx     # writes plan.html
npx @suzumiyaaoba/mdxr serve               # serve .mdxr at http://localhost:3737
npx @suzumiyaaoba/mdxr library             # browse and search .mdxr
npx @suzumiyaaoba/mdxr catalog             # list available components
npx @suzumiyaaoba/mdxr check               # validate all documents in .mdxr
npx @suzumiyaaoba/mdxr --version           # print the package version
npx @suzumiyaaoba/mdxr init                # install mdxr instructions for Codex and Claude
```

Or install it:

```sh
npm install -g @suzumiyaaoba/mdxr          # global CLI
npm install @suzumiyaaoba/mdxr             # library: import { render } from "@suzumiyaaoba/mdxr"
```

### `mdxr check [path]`

Validate one Markdown/MDX document or every document under a directory (defaults to `.mdxr`) without writing HTML. Checks include syntax, component names and attributes, local resources, Include cycles, citations, and cross references. Diagnostics include file, line, and column; errors exit with code 1, and checking continues after a malformed document.

```sh
mdxr check                           # validate .mdxr
mdxr check ./reports --format json   # structured diagnostics for CI and agents
mdxr check ./reports --strict        # fail on warnings too
mdxr check plan.mdx --render          # also load project components and validate rendering
cat plan.mdx | mdxr check -           # validate stdin
```

The default check does not execute document JavaScript, project configuration, or custom components. Use `--render` when checking trusted project components. See the [CLI reference](docs/docs/cli.mdx) for the diagnostic format and reference rules.

### `mdxr library [dir]`

Browse and search Markdown and MDX documents under a directory (defaults to `.mdxr`). The local browser UI searches titles, document text, and relative paths; supports status filtering and relevance, update-date, or title sorting; and opens each result in a new tab with the live preview workspace.

Delete a document from its row to permanently remove that file; its assets and parent directories remain.

```sh
mdxr library                         # browse .mdxr
mdxr library ./docs -p 3738 --open   # browse another directory
```

Search terms separated by spaces (including full-width spaces) use AND matching. Japanese text supports partial matches. Unicode NFKC normalization handles full-/half-width forms, including half-width kana with voiced marks; lowercasing makes letter case equivalent, and hiragana and katakana are treated as equivalent. For example, search for `かたろぐ ＡＰＩ`. The library indexes `.md`, `.markdown`, and `.mdx` files without running document JavaScript or custom components. Both the library and previews listen on loopback; generated and dependency directories such as `node_modules`, `dist`, `.git`, `.mdxr-cache`, `storybook-static`, and `.mdxr/history` are excluded, and symbolic links are not followed. Use the UI's refresh action to include added, changed, or deleted files.

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

### `mdxr serve [path]`

Serve all Markdown and MDX documents under `.mdxr/` by default, creating an empty directory when needed. The browser listing lets you search and open each document in its live workspace. Pass another directory to serve it instead (`-p, --port`, default `3737`; if taken, the next free port is used).

```sh
mdxr serve                                                        # serve .mdxr/
mdxr serve .mdxr/ --agent codex --open .mdxr/20260930170000-plan/index.mdx
mdxr serve ./reports --open ./reports/plan.mdx                     # open this document directly
mdxr serve --open                                                 # open the directory listing
cat plan.mdx | mdxr serve - --open                                 # explicit stdin preview
```

`--open <file>` takes a document path relative to the working directory, or an absolute path. It opens that document directly, with its relative file path in the preview URL. `--agent codex` or `--agent claude` enables chat in every document workspace. A file argument such as `mdxr serve .mdxr/20260930170000-plan/index.mdx --open` serves the containing `.mdxr/` library and opens that file; outside `.mdxr/`, it serves the file's parent directory.

### Review the rendered document

Select text and click **Add comment**, or open **Annotate → Select figure** to comment on an image, diagram, or chart. Edit or delete comments in the panel, then **Copy Markdown** to send the quoted targets, source locations, and feedback to a coding agent.

Saved annotations remain in your browser for that document; they do not modify the source file or travel with the HTML. Track comments as open or resolved, and resolve them against the version you reviewed. Copying or sending feedback keeps the current comments and hands off only open comments; each handoff saves a snapshot of the open comments it contains. If the document changes, targets that cannot be identified keep their original quotes and are marked unavailable. [Review annotations](https://suzumiyaaoba.com/mdxr/annotations) describes keyboard shortcuts, storage, and clipboard fallbacks.

Each document-level `##` section also has a **Not reviewed / Reviewed** toggle. Review status is saved locally per document and restored after reload; sections with changed content require review again. In **Pages** view, the sidebar shows section statuses and review progress. See [Section review status](https://suzumiyaaoba.com/mdxr/authoring#section-review-status).

In the `mdxr serve` workspace, choose **Export HTML**, select the contents, then **Download HTML**:

- **Document only** preserves the displayed document and entered values, omitting review controls and records. It does not fetch chat or version history.
- **Document and review** adds current comments, section review statuses, and answers. Chat, unsent drafts, comment handoff history, saved MDX versions, and diffs are excluded from both visible HTML and embedded JSON.
- **All records** (the default) includes the document, chat, comments, drafts, section reviews, every saved MDX version, and their diffs. Resolved comments retain their resolution time and reviewed version, with links to matching archived versions.

Images and stylesheets are embedded in every snapshot; if an external resource cannot be captured, export reports an error instead of omitting it. Open the file locally to review or share the captured state without running the server. Escape or **Cancel** closes the dialog without exporting.

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

The bundled prompts tell the agent to compare their recorded version with `--version` from the CLI used for the task. If they differ, the agent reports both versions and recommends refreshing with `init --force` from that same CLI, preserving the original tool and install scope; Skill installs also keep `--skill`. See [Agent setup](docs/docs/agent-skill.mdx) for details.

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

Plans, reports, reviews, investigation summaries, release notes, and postmortems all work. By default, new documents use `.mdxr/yyyyMMddhhmmss-<name>/index.mdx`, with a zero-padded 14-digit local creation time in 24-hour format (for example, `.mdxr/20260929140530-auth-plan/index.mdx`). Keep images and related MDX files in the document's directory. A file path you provide takes priority, and existing documents keep their current paths. If you specify only a directory, create a timestamped subdirectory there and save the document as `index.mdx`. Serve the directory and open the new document directly with `mdxr serve .mdxr/ --open .mdxr/20260929140530-auth-plan/index.mdx`.

## License

MIT
