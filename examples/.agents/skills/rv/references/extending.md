# Project-defined components

Index: [components.md](components.md).

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
