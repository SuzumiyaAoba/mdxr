# Wireframes

Screen mockups using built-in components adapted from [wireframe-ui](https://wireframe-ui.vercel.app/components). Write these directly in MDX, without imports or expressions. Existing `Card`, `Button`, `Tabs`, and other shadcn components remain available.

```mdx
<Wireframe title="Account / Sign in" device="mobile">
  <WireframeCard wireframe="compact">
    <WireframeCardHeader>
      <WireframeCardTitle>Welcome back</WireframeCardTitle>
      <WireframeCardDescription>
        Sign in to your workspace.
      </WireframeCardDescription>
    </WireframeCardHeader>
    <WireframeCardContent>
      <WireframeStack>
        <WireframeInput label="Email" type="email" />
        <WireframeInput label="Password" type="password" />
        <WireframeButton>Sign in</WireframeButton>
      </WireframeStack>
    </WireframeCardContent>
  </WireframeCard>
</Wireframe>
```

- `Wireframe`: `title`, `device="desktop|tablet|mobile"`; widths shrink to fit. Put responsive section presets inside a frame.
- `WireframeStack`: `direction="vertical|horizontal"`, `spacing="xs|sm|md|lg|xl"`, `align="start|center|end|stretch"`, `justify="start|center|end|between|around"`. Horizontal stacks wrap.
- `WireframeSection`: `variant="custom|hero|content-two-column|feature-grid"`, `spacing="tight|normal|relaxed"`. Empty presets supply content; children replace it. Columns respond to the frame width.
- `WireframeText`: `size="xs|sm|base|lg|xl"`, `width="xs|sm|md|lg|xl|full"`, `color="default|muted|subtle|primary|secondary|accent"`, `emphasis="primary|secondary|tertiary|subtle"`, `animate="none|pulse|shimmer|typing"`, optional `label`. Emphasis wins over color. Animations respect reduced motion.
- `WireframeHeading`: `level="1"`–`"6"` (default `2`), `label`; children supply real heading text.
- `WireframeParagraph`: `lines="1"`–`"50"` (default `3`), `lastLineWidth`, `size`, `color`, `emphasis`, `spacing`, `label`.
- `WireframeList`: `items="1"`–`"50"`, `variant="bullet|number|none"`, `itemWidth`, `size`, `spacing`, `label`.
- `WireframeMedia`: `type="image|video|audio"`, `aspectRatio="square|video|portrait|auto"`, `label`. Use `src`, `alt`, `loading`, and `captions` for real media; omit `src` for a placeholder.
- `WireframeAvatar`: `size="sm|md|lg"`, `label`, optional initials as children. `WireframeBadge` accepts text children or a placeholder `label`.
- `WireframeButton`: text children or placeholder `label`; `variant="default|outline|secondary|ghost"`, `size="default|sm|lg|icon"`, `href`, `disabled`. Without `href`, buttons are mock actions, not form submissions.
- `WireframeInput` / `WireframeTextarea`: `label`, `name`, `defaultValue`, `placeholder`, `variant="wireframe|default"`, `disabled`, `readOnly`, `required`. Input also has `type`, `autoComplete`; textarea has `rows="1"`–`"30"`. Empty skeletons disappear on focus or typing. Values are local to the page, not submitted or persisted.
- `WireframeCard`: `wireframe="none|compact|detailed"`; children: `WireframeCardHeader`, `WireframeCardTitle`, `WireframeCardDescription`, `WireframeCardAction`, `WireframeCardContent`, `WireframeCardFooter`.

All components accept `className` and `id`. Numeric and boolean attributes use strings, including `disabled="false"`. Use meaningful labels and heading levels. `mdxr text` keeps labels and placeholder markers; render HTML for visual review. `mdxr catalog --json` provides the complete prop schema.

## Complete upstream catalog

All 45 UI families and nine blocks from wireframe-ui commit `30ba352497760d13e26993928bd90a60ac34640e` are registered. Prefix every upstream component export with `Wireframe`, including compound parts and helpers: `WireframeDialogContent`, `WireframeTableCellWireframe`, `WireframeSidebarMenuButtonWireframe`, etc. `WireframeList` aliases `WireframeListGroup`; `WireframeChart` aliases `WireframeChartWireframe`.

Use string booleans (`asChild="true"`, `defaultOpen="false"`), numeric strings, and literal JSON for `responsive`, `hideOn`, slider values, `config`, `payload`, `opts`, `snapPoints`, `errors`, and form `defaultValues`/`rules`. Functions still belong in project TSX components. Interactive Radix parts require hydration. Native inputs and media also have usable initial markup.

Blocks: `WireframeHeroSection`, `WireframeLoginForm`, `WireframeRegisterForm`, `WireframeContactForm`, `WireframeDashboard`, `WireframePricing`, `WireframeProductGrid`, `WireframeProfilePage`, `WireframeSettingsPage`.

`WireframeForm` and `WireframeFormField` accept declarative native-input children in MDX; project React components can use `control`/`render` and `useWireframeForm`. Other exports: `useWireframeFormField`, `useWireframeSidebar`, `wireframeToast`, and `wireframe*Variants`.

The upstream registry's `file` entry is the Field component family (`WireframeField`, `WireframeFieldSet`, etc.), not a file preview. Run `mdxr catalog --json` to discover all 262 registered Wireframe names and props.
