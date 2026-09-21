# Component stories

Run `pnpm storybook` and open the **Components** section. The extended catalog has a separate entry for every public component, including helpers such as `Source`, `Cite`, `Request`, `Response`, `TabItem`, `PageBreak`, and `RecordItem`.

The stories in `extended/` import the component's own module. Use Controls to edit the example's props, including JSON data and options. Components that consume children are shown with the surrounding structure they need. Empty reports, paginated and CSV tables, and calculator validation have extra stories.

`Sources`, `Source`, `Cite`, `CrossRef`, `TermRef`, `Include`, `TableOfFigures`, `NumberedEquation`, and `Theorem` use small MDX fixtures in `.storybook/fixtures/`. A Vite virtual module compiles each fixture with the real renderer, including reference resolution, inclusion, math, and numbering. These stories disable Controls because their inputs are resolved at build time. Editing a fixture or renderer source refreshes the preview during development.

Images, audio, video, captions, and the example PDF are served from `examples/catalog/assets/` by Storybook's `staticDirs` configuration. Media and download components render directly in the Storybook canvas so their controls work without an additional sandboxed frame. PDF rendering requires a browser with a PDF viewer; the source link is always available.

`pnpm test` includes each story through the existing Storybook/Vitest browser project. `tests/component-stories.test.ts` checks that the public extended catalog and the individual story entries stay in sync. `pnpm build-storybook` also verifies the static distribution and copies its media assets.
