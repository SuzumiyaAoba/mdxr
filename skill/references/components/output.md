# Output artifacts — diffs, graphs, test reports, endpoints, JSON, timing

Index: [../components.md](../components.md). MDX attributes are always strings; `children` is Markdown.

### ` ```diff ` / ` ```patch ` fences → structured diff cards

An ordinary unified-diff fence becomes one card per file: file-type icon, path (editor link when the file exists), a `new file` / `deleted` / `renamed` chip, `+N −M` counts with a proportional stat bar, a copy button, and hunks with dual old/new line numbers. Git meta lines (`index`, `similarity index`, `rename from/to`, modes) collapse into a muted strip. Diffs without `diff --git`/`---`/`+++` headers — bare `+`/`-` streams — still render. `title="path"` in the fence meta supplies the filename when the patch itself lacks headers.

````mdx
```diff title="src/render.ts"
@@ -40,7 +40,8 @@
-  const out = compile(src);
+  const doc = compile(src);
+  const out = minify(doc);
   return out;
```
````

For word-level inline edits inside prose use `<Ins>`/`<Del>`; for block alternatives use `<Before>`/`<After>`.

### `<Graph title direction>` / `<Node>` / `<Edge>` / `:::graph`

A static node/edge diagram — the "React Flow" shape without client JS: dagre computes the layout at render time and the output is absolute-positioned node cards over an SVG edge layer (printable, deterministic). Children are `<Node>` and `<Edge>` elements; anything else renders under the diagram.

`direction` is `down` (default) / `right` / `up` / `left` — dagre `TB`/`LR`/`BT`/`RL`.

`<Node>` props: `id` (required), `label` (display text, defaults to `id`), `note` (muted second line), `icon` (Iconify name), `path` + optional `lines`/`href` (file icon + editor link — something mermaid can't do), `status` (todo|doing|done|blocked → status icon), `external="true"` (dashed "outside the repo" styling).

`<Edge>` props: `from` / `to` (required, node ids), `kind` (`imports` `calls` `extends` `implements` `reads` `writes` — same palette as `<Dep>`; edges without `kind` render neutral), `label` (chip at the path midpoint). Edges referencing unknown node ids are dropped.

```mdx
<Graph title="mdx → html pipeline" direction="right">
  <Node id="doc" label="plan.mdx" path="examples/plan.mdx" />
  <Node id="eval" label="evaluate" note="@mdx-js/mdx" />
  <Node id="out" label="out.html" path="examples/out.html" />
  <Edge from="doc" to="eval" kind="reads" />
  <Edge from="eval" to="out" kind="writes" label="static markup" />
</Graph>
```

When the nodes/edges don't need 2-D layout prefer `<Deps>` (a list); for sequence/state/ER diagrams prefer ` ```mermaid `.

### `<Tests title tool>` / `<Test name status duration file>` / `:::tests`

Structured test-run report. `Tests` renders a caption bar that counts `<Test>` children per status and sums parseable durations (`120ms`, `1.2s`, `2m`); `tool` adds a runner chip (`vitest`, `jest`, …). `Test` needs `name`; `status` is `pass` (default) / `fail` / `skip` / `todo`, `duration` shows right-aligned, `file`/`lines`/`href` link to the test file. Children render as an indented detail block — the failure output for `status="fail"`.

```mdx
<Tests title="render.test.ts" tool="vitest">
  <Test name="renders markdown prose" status="pass" duration="12ms" />
  <Test
    name="rejects invalid props"
    status="fail"
    duration="800ms"
    file="tests/render.test.ts"
    lines="96"
  >
    AssertionError: expected body to contain "Invalid props"
  </Test>
</Tests>
```

### `<Endpoints title base>` / `<Endpoint method path auth deprecated>` / `:::endpoints`

API route inventory. `Endpoint` renders a colored method chip (`GET` `POST` `PUT` `PATCH` `DELETE` `HEAD` `OPTIONS`; case-insensitive), the path in mono (with `base` prefixed in muted text), an optional `auth` chip, a `Deprecated` pill when `deprecated` is set, and children as the description.

```mdx
<Endpoints title="User service" base="/api/v1">
  <Endpoint method="GET" path="/users">
    List users, paginated.
  </Endpoint>
  <Endpoint method="POST" path="/users" auth="admin">
    Create a user.
  </Endpoint>
  <Endpoint method="GET" path="/legacy/users" deprecated="true" />
</Endpoints>
```

### `<Json title value open>` — collapsible JSON tree

Renders a JSON payload as a nested tree of native `<details>` folds — no client JS; closed nodes show a `N keys`/`N items` badge. Supply the payload either as the `value` string attribute or as a fenced ` ```json ` block child (write the JSON inside the fence — bare `{…}` children are MDX expressions and rejected). `open="false"` starts every level folded. `title` adds a caption bar with a copy button. Values are typed: strings quoted/emerald, numbers sky, booleans violet, `null` dimmed; long strings truncate. Invalid JSON fails the render with `<Json> invalid JSON: …`.

````mdx
<Json title="tool result">

```json
{ "name": "mdxr", "stats": { "files": 12 }, "tags": ["agent", "render"] }
```

</Json>
````

### `<Waterfall title total unit>` / `<Span name start duration note>` / `:::waterfall`

Timing waterfall — OTel-trace-style horizontal bars. Each `<Span>` needs `name` and `duration`; `start` is the offset from zero (both accept numbers or strings like `"120ms"` — the unit suffix is display-only). `total` overrides the scale end (defaults to the latest span end); `unit` labels the axis (default `ms`). Bars are colored by position automatically.

```mdx
<Waterfall title="GET /api/users" unit="ms">
  <Span name="route match" start="0" duration="3ms" />
  <Span name="db query" start="21" duration="120ms" note="users + roles" />
  <Span name="serialize" start="141" duration="9ms" />
</Waterfall>
```

### `<Ins>` / `<Del>` — inline edits

Semantic `<ins>`/`<del>` inline elements for word-level changes inside a sentence or code span: `<Ins>` renders green with underline, `<Del>` red with strikethrough; `title` sets the hover tooltip. Pair them for a before→after edit.

```mdx
The compiler <Del>concatenates strings</Del> <Ins>streams tokens</Ins> and

<Del>always</Del> <Ins>optionally</Ins> minifies the output.
```
