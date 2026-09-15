# rv component reference

MDX attributes are always strings (`status="done"`). `children` is Markdown.

## Built-in components

### `<Plan title="…" status="doing">`

Document root. Renders a title header with an optional status badge. If frontmatter `title:` exists, a header is generated automatically.

### `<Phase title="…" status="todo|doing|done|blocked">`

A section heading with a status badge. Also produced by `:::phase{title="…"}`.

### `<Steps>` / `<Step status="…">`

Ordered, status-aware step list.

```mdx
<Steps>
  <Step status="done">Read the existing parser</Step>
  <Step status="doing">Add directive transform</Step>
  <Step status="todo">Update snapshots</Step>
</Steps>
```

### `<Callout kind="note|tip|important|warning|caution|danger|decision" title="…">`

Highlighted block. `:::note`, `:::warning` and `> [!NOTE]` produce the same output.

### `<FileRef path="src/mdx.ts" lines="40-52" />`

Inline file reference chip with a copy button.

### `<Summary done="3" total="8" label="Progress" />`

Progress bar.

### `<StatusBadge status="…" />`

Standalone status pill.

### Fenced code

````
```ts title="src/cli.ts"
…
```
````

renders a framed block with filename + copy button. ` ```mermaid ` renders a diagram.

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

export const Timeline = defineComponent(
  {
    description: "Chronological event list",
    schema: v.looseObject({ title: v.optional(v.string()) }),
  },
  ({ title, children }) => (
    <section className="my-4 border-l-2 border-neutral-300 pl-4">
      {title ? <h3 className="mt-0">{title}</h3> : null}
      {children}
    </section>
  )
);
```

- Tailwind classes in custom components are compiled automatically.
- `import { Callout, StatusBadge } from '@suzumiyaaoba/rv/components'` to compose built-ins (or from `rv/components` shorthand).
- A project component with the same name as a built-in overrides it (a warning is printed).
- Components must be synchronous — no Suspense / data fetching.
