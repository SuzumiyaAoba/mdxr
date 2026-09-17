# shadcn/ui components (Base UI)

Index: [../components.md](../components.md). MDX attributes are always strings; `children` is Markdown.

The full shadcn/ui set (Base UI primitives) is registered: `Button`, `Badge`, `Card`/`CardHeader`/…, `Alert`, `Tabs`, `Accordion`, `Dialog`, `Input`, `Label`, `Table`, `Progress`, `Skeleton`, `Separator`, `Kbd`, `Spinner`, and more — run `mdxr catalog` for the complete list. Use them as plain MDX elements; attributes are strings (`variant="outline"`, `size="sm"`).

**Important:** documents render to static HTML with no client-side hydration. Stateful primitives (`Dialog`, `Tabs`, `Accordion`, `Tooltip`, `Select`, `Switch`, menus, …) render only their initial state — e.g. a dialog stays closed, a switch can't be flipped. Prefer them for layout/structure; for always-visible content use `Card`, `Alert`, `Badge`, `Table`, `Kbd`, `Separator`, `Progress`, `Skeleton`. For _actual_ interactivity use the built-ins backed by native elements: `<Ask>`/`<Question>`/`<Choice>` (form controls), `<Details>` and `<Toc>` (collapsible `<details>`), and the copy buttons.

```mdx
<Alert>
  <AlertTitle>Heads up</AlertTitle>
  <AlertDescription>Fully static and safe in documents.</AlertDescription>
</Alert>

<Badge variant="secondary">beta</Badge>
<Button variant="outline">Action</Button>
```

Theme: shadcn CSS variables (`--primary`, `--background`, …) are emitted with the document CSS; `.dark` variants follow `prefers-color-scheme` via a `<html>` class toggle.
