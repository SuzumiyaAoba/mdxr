# rv component reference

MDX attributes are always strings (`status="done"`). `children` is Markdown.

## Built-in components

### `<Plan title="…" status="…" date owner version updated>`

Document root. Renders a title header with an optional status badge and a metadata row. If frontmatter `title:` exists, a header is generated automatically — frontmatter `status:`, `date:`, `owner:`, `version:` and `updated:` are picked up too.

```mdx
<Plan title="Renderer rewrite" status="doing" owner="@alice" date="2026-09-10" version="v3">
```

### `<Meta date owner version updated>` / `<MetaItem label="…" icon="…">`

Document metadata row (muted line: `Date: … · Owner: …`). Usable anywhere, not only inside `<Plan>`. For custom entries nest `<MetaItem label="Spec" icon="lucide:tag">…</MetaItem>` — `MetaItem` children may contain Markdown links; `icon` takes any Iconify name (`lucide` bundled, prefix optional).

### `<Phase title="…" status="todo|doing|done|blocked" owner due>`

A section heading with a status badge, plus optional owner chip and deadline. Also produced by `:::phase{title="…"}`.

### `<Steps progress>` / `<Step status owner effort priority due>`

Ordered, status-aware step list. `progress` on `<Steps>` renders an automatic progress bar counting `<Step>` children. `Step` accepts `owner="…"`, `effort="xs|s|m|l|xl"`, `priority="p0|p1|p2|p3"` and `due="YYYY-MM-DD"` — each renders a chip under the step text.

```mdx
<Steps progress>
  <Step status="done">Read the existing parser</Step>
  <Step status="doing" owner="@alice" priority="p1" due="2026-09-18">
    Add directive transform
  </Step>
  <Step status="todo" effort="m">
    Update snapshots
  </Step>
</Steps>
```

### `<Timeline title="…">` / `<Event date status title>`

Chronological milestone list with a left rail. `Event` requires `date` (any string), optional `status` (todo|doing|done|blocked) and `title`. Also produced by `:::timeline{title="…"}`.

```mdx
<Timeline title="Milestones">
  <Event date="2026-09-10" status="done" title="Skeleton merged" />
  <Event date="2026-09-30" status="todo" title="v1.0 freeze" />
</Timeline>
```

### `<Callout kind="…" title="…">`

Highlighted block. `:::note`, `:::warning`, `> [!NOTE]` produce the same output. Kinds: `note` `tip` `important` `warning` `caution` `danger` `decision` `goal` `nongoal` `question` — the last three cover plan-doc conventions (goals / non-goals / open questions). `:::non-goal` and `> [!NON-GOAL]` are aliases of `nongoal`.

### `<Decision title="…" status="…" date="…">`

Decision record (ADR-lite). `status` is `proposed|accepted|rejected|deprecated| superseded`. Children hold context and rationale. For a one-line record prefer `:::decision` (the Callout kind).

```mdx
<Decision
  title="Use renderToStaticMarkup (sync)"
  status="accepted"
  date="2026-09-12"
>
  Documents have no data fetching — a synchronous renderer keeps the CLI simple.
</Decision>
```

### `<Option title="…" status="recommended|considered|rejected">`

Alternative-comparison card. Pair with `<Columns>` for side-by-side layout.

```mdx
<Columns>
  <Option title="Template literals" status="rejected">
    Escaping bugs keep recurring.
  </Option>
  <Option title="Component pipeline" status="recommended">
    Deterministic + validated.
  </Option>
</Columns>
```

### `<Columns cols="2|3|4">` / `<Column>`

Responsive grid layout for side-by-side content (options, before/after).

### `<Risk level="low|medium|high" title="…" mitigation="…">`

Risk block with a severity pill; `mitigation` renders a dedicated line.

```mdx
<Risk level="high" title="Ecosystem drift" mitigation="Pin @mdx-js/mdx">
  `evaluate()` semantics changed across majors before.
</Risk>
```

### `<Approvals>` / `<Approval name role status date>`

Sign-off list. `status` is `pending|approved|rejected|changes-requested`; children render as a comment next to the approver.

```mdx
<Approvals>
  <Approval name="alice" role="tech lead" status="approved" date="2026-09-14" />
  <Approval name="bob" role="security" status="pending" />
</Approvals>
```

### `<Stats>` / `<Stat value label delta>`

Metric card grid. `delta` colors by sign (`"+12"` green, `"-34%"` red).

### `<Priority level="p0|p1|p2|p3">` / `<Effort size="xs|s|m|l|xl">` / `<Due date="YYYY-MM-DD">` / `<Owner name="…" role="…">`

Inline chips: priority pill, T-shirt effort estimate (children = e.g. `3d`), deadline chip colored by urgency at render time (overdue → red, ≤3d → amber), and an initials-avatar person chip.

### `<Tree root="…">`

File tree rendered from a nested Markdown list. Items ending in `/` or with children get a folder icon; `name — note` or `name # note` adds a muted note.

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

Inline file reference chip with a copy button.

### `<SymbolRef name="mdxToHtml" kind="fn" path="src/mdx.ts" lines="70-106" />`

Inline symbol reference chip for code explanations. `kind` picks the icon: `fn` `type` `class` `interface` `const` `enum` `prop` `component` (omit for no icon). `path`/`lines` show the definition site muted; the copy button copies `path` (or `name` when absent).

```mdx
<SymbolRef name="mdxToHtml" kind="fn" path="src/mdx.ts" /> returns
<SymbolRef name="MdxResult" kind="interface" />.
```

### `<Changes>` / `<Change kind="add|modify|delete|rename" path="…" to="…">`

Change-set list — the "files this plan touches" section. `kind` drives the icon and color (`to` is the new path on `rename`); children render as a muted note.

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

### `<Ref href="…" title="…">` / `<Issue repo="o/r" number="12">` / `<PR repo="o/r" number="5">`

`Ref` is a linked reference card (use for a "References" section). `Issue`/`PR` are inline chips linking to `github.com/{repo}/issues|pull/{number}` — children become the title; `href` overrides the URL.

### `<Figure src="…" alt="…" caption="…">`

Image with an optional caption (children work too). Use for screenshots or diagrams mermaid can't express.

### `<Toc depth="3" min="2" title="Contents" />` / `:::toc`

Table of contents auto-built from the document's headings (h2–h3 by default — h1 is the document title). Headings always get slug `id`s, so `[link](#slug)` deep links work anywhere.

### `<Glossary>` / `<Term name="…">`

Definition list (`<dl>`) for domain terms. `name` is the term; children are the definition.

### `<Before>` / `<After>`

Semantic before/after panels (red / green header). Wrap in `<Columns>` for side-by-side; `title` overrides the label ("Current" / "Proposed").

### `<Cmd>`

Inline command chip — terminal icon + copy button.

```mdx
Run <Cmd>pnpm build</Cmd> then <Cmd>rv render plan.mdx</Cmd>.
```

### `<Reqs>` / `<Req id="REQ-1" status="…">`

Requirement / acceptance-criteria rows: `id` renders a mono chip, optional `status` (todo|doing|done|blocked) a badge; children are the requirement text.

### `<Summary done="3" total="8" label="Progress" />`

Progress bar.

### `<StatusBadge status="…" />`

Standalone status pill.

### `<Icon name="lucide:rocket" label className />`

Inline Iconify icon rendered as SVG — no runtime fetch. The `lucide` set is bundled; the `lucide:` prefix may be omitted (`name="check"`). Unknown names are render-time validation errors. Decorative by default (`aria-hidden`); pass `label` to expose it as an image with `aria-label`. Size and color come from `className` (`h-4 w-4 text-teal-500`).

Status badges, step markers, callouts, chips and the file tree all carry appropriate icons automatically.

```mdx
Launch checklist <Icon name="lucide:rocket" className="h-4 w-4" />
```

Icons also work as CSS classes (mask-image, single-color) on any element:

```mdx
<span className="icon-[lucide--github] h-5 w-5" />
```

### Fenced code

````
```ts title="src/cli.ts"
…
```
````

renders a framed block with filename + copy button. Code is syntax-highlighted with Shiki (light/dark dual theme), so always tag the fence with a language (`ts`, `python`, `diff`, …). ` ```mermaid ` renders a diagram.

The fence meta also controls line presentation:

````
```ts {1,3-4} ln title="src/cli.ts"
…
```
````

- `{1,3-4}` highlights those lines; `/pattern/` highlights every match (word highlight).
- `ln` shows line numbers (also `line-numbers`, `lineNumbers`, `showLineNumbers`).

Inside the code, `// [!code …]` markers annotate lines and are stripped from output:

| Marker | Effect |
| --- | --- |
| `// [!code hl]` / `// [!code highlight]` | highlight the line |
| `// [!code ++]` / `// [!code --]` | green/red diff rows (works in any language) |
| `// [!code warning]` / `// [!code error]` | amber/red line bands |
| `// [!code focus]` | dim all other lines |
| `// [!code word:foo]` | highlight every `foo` occurrence |

### `<CodeFile path="src/x.ts" lines="40-52" lang="ts" />`

Embeds a real file from disk as a fenced block — code explanations quote the actual source instead of drifting copies. `path` resolves relative to the document; `lines` slices a 1-based range (`"40"`, `"40-52"`, `"40-"`); `lang` overrides the extension-derived language. Missing files and bad ranges are render errors.

### Math

`$…$` inline and `$$…$$` blocks render via KaTeX (stylesheet from CDN, only linked when math is present).

## shadcn/ui components (Base UI)

The full shadcn/ui set (Base UI primitives) is registered: `Button`, `Badge`, `Card`/`CardHeader`/…, `Alert`, `Tabs`, `Accordion`, `Dialog`, `Input`, `Label`, `Table`, `Progress`, `Skeleton`, `Separator`, `Kbd`, `Spinner`, and more — run `rv catalog` for the complete list. Use them as plain MDX elements; attributes are strings (`variant="outline"`, `size="sm"`).

**Important:** documents render to static HTML with no client-side hydration. Stateful primitives (`Dialog`, `Tabs`, `Accordion`, `Tooltip`, `Select`, menus, …) render only their initial state — e.g. a dialog stays closed, tabs show the `defaultValue` panel. Prefer them for layout/structure; for always-visible content use `Card`, `Alert`, `Badge`, `Table`, `Kbd`, `Separator`, `Progress`, `Skeleton`.

```mdx
<Alert>
  <AlertTitle>Heads up</AlertTitle>
  <AlertDescription>Fully static and safe in documents.</AlertDescription>
</Alert>

<Badge variant="secondary">beta</Badge>
<Button variant="outline">Action</Button>
```

Theme: shadcn CSS variables (`--primary`, `--background`, …) are emitted with the document CSS; `.dark` variants follow `prefers-color-scheme` via a `<html>` class toggle.

## Project-defined components

Create `rv.config.ts` in the project root:

```ts
import { defineConfig } from "@suzumiyaaoba/rv";

export default defineConfig({
  components: "./components/index.tsx", // named exports become MDX components
  theme: "./rv.css", // optional: @theme token overrides
});
```

Define components with `defineComponent` (adds a valibot schema — used for runtime validation **and** `rv catalog` documentation):

```tsx
// components/index.tsx
import { defineComponent, v } from "@suzumiyaaoba/rv";

export const LinkCard = defineComponent(
  {
    description: "External reference card",
    schema: v.looseObject({ href: v.string(), title: v.string() }),
  },
  ({ href, title, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border p-3 no-underline"
    >
      <div className="font-medium">{title} ↗</div>
      {children}
    </a>
  )
);
```

- Tailwind classes in custom components are compiled automatically.
- `import { Callout, StatusBadge } from '@suzumiyaaoba/rv/components'` to compose built-ins (or from `rv/components` shorthand).
- A project component with the same name as a built-in overrides it (a warning is printed).
- Components must be synchronous — no Suspense / data fetching.
