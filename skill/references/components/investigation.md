# Code investigation components

Index: [../components.md](../components.md). MDX attributes are always strings; `children` is Markdown.

### `<Findings title>` / `<Finding confidence="confirmed|inferred|unverified" title="…">` / `:::findings` / `:::finding`

Investigation findings with an epistemic-status pill: `confirmed` (read from the code), `inferred` (deduced from evidence), `unverified` (claimed, not checked). `Findings` numbers each `Finding` and renders a count summary on top; children carry the evidence (`<FileRef>`, `<CodeFile>`).

```mdx
<Findings title="Investigation results">
  <Finding confidence="confirmed" title="Rendering is synchronous">
    `mdxToHtml` awaits `evaluate()` then calls `renderToStaticMarkup`.
  </Finding>
  <Finding confidence="unverified" title="Watch-mode reloads">
    Probably, but no test covers it.
  </Finding>
</Findings>
```

### `<Files title>` / `<File path kind lines>` / `:::files`

Related-file inventory — "the files this investigation touches". The row icon is picked automatically from the file name/extension (`vscode-icons` set: `package.json` → npm, `Dockerfile` → Docker, `*.test.ts` → test TS, …). `kind` is a free-form chip; known values get an icon and color: `entry` `core` `types` `config` `test` `docs` `generated`. Children render as a muted note. For change-sets (what a plan modifies) use `Changes` instead.

```mdx
<Files title="Files involved">
  <File path="src/mdx.ts" kind="entry" lines="70-106">
    Pipeline entry.
  </File>
  <File path="src/define.ts" kind="types" />
  <File path="tests/render.test.ts" kind="test" />
</Files>
```

### `<Deps title>` / `<Dep from to kind>` / `:::deps`

Dependency-edge list — compact alternative to a mermaid graph for module relationships. `kind` (default `imports`): `imports` `calls` `extends` `implements` `reads` `writes`. `from`/`to` accept paths, module names, or symbols; children render as a muted note.

```mdx
<Deps title="Module dependencies">
  <Dep from="src/cli.ts" to="src/render.ts" kind="calls" />
  <Dep from="src/mdx.ts" to="remark-directive" kind="imports" />
  <Dep from="src/render.ts" to="dist/out.html" kind="writes" />
</Deps>
```

### `<Changes>` / `<Change kind="add|modify|delete|rename" path="…" to="…">`

Change-set list — the "files this plan touches" section. `kind` drives the icon and color (`to` is the new path on `rename`); the file path also gets an extension-based icon automatically. Children render as a muted note.

```mdx
<Changes>
  <Change kind="add" path="src/remark/headings.ts">
    slug + toc expansion
  </Change>
  <Change kind="modify" path="src/mdx.ts" />
  <Change kind="rename" path="src/old.ts" to="src/new.ts" />
  <Change kind="delete" path="src/dead.ts" />
</Changes>
```

### `<Flow title="…">` / `<FlowStep name path lines>` / `:::flow{title="…"}`

Numbered call/execution chain — "how a request travels through the code". Each `FlowStep` renders a numbered node on a connecting rail; `name` is the function/phase label (mono), `path`/`lines` pin the location, children describe what happens there. Use `Steps` for task checklists and `Timeline` for dates — `Flow` is for hops through code.

```mdx
<Flow title="Request path">
  <FlowStep name="cli()" path="src/cli.ts" lines="12-30">
    Parses argv, loads config.
  </FlowStep>
  <FlowStep name="mdxToHtml()" path="src/mdx.ts">
    Compiles MDX and evaluates it.
  </FlowStep>
</Flow>
```

### `<Tree root="…">`

File tree rendered from a nested Markdown list. Items ending in `/` or with children get a folder icon; `name — note` or `name # note` adds a muted note. Icons are picked automatically from the file extension or directory name (VS Code-style `vscode-icons` set, e.g. `.ts` → TypeScript logo, `src/` → src folder).

```mdx
<Tree root="rv/">

- src/
  - render.ts — pipeline entry
  - ui/
    - plan.tsx
- package.json

</Tree>
```

### `<FileRef path="src/mdx.ts" lines="40-52" />`

Inline file reference chip with a copy button. The icon is picked automatically from the file extension (`vscode-icons` set).

### `<SymbolRef name="mdxToHtml" kind="fn" path="src/mdx.ts" lines="70-106" />`

Inline symbol reference chip for code explanations. `kind` picks the icon: `fn` `type` `class` `interface` `const` `enum` `prop` `component` (omit for no icon). `path`/`lines` show the definition site muted; the copy button copies `path` (or `name` when absent).

```mdx
<SymbolRef name="mdxToHtml" kind="fn" path="src/mdx.ts" /> returns
<SymbolRef name="MdxResult" kind="interface" />.
```

### `<CodeFile path="src/x.ts" lines="40-52" lang="ts" />`

Embeds a real file from disk as a fenced block — code explanations quote the actual source instead of drifting copies. `path` resolves relative to the document; `lines` slices a 1-based range (`"40"`, `"40-52"`, `"40-"`); `lang` overrides the extension-derived language. Missing files and bad ranges are render errors.

### `<Props of="…">` / `<Prop name type required default>`

API/props table for documenting a component or function signature. `of` renders a caption bar; `required` (bare attr) adds a `*`; children are the description cell.

```mdx
<Props of="Step">
  <Prop name="status" type="todo | doing | done | blocked" required>
    Marker state.
  </Prop>
  <Prop name="effort" type="xs | s | m | l | xl" default="m" />
</Props>
```
