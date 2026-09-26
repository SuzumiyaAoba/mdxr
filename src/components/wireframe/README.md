# wireframe-ui source

Vendored from [aguiarsc/wireframe-ui](https://github.com/aguiarsc/wireframe-ui/tree/30ba352497760d13e26993928bd90a60ac34640e), commit `30ba352497760d13e26993928bd90a60ac34640e` (2026-01-16), under the [MIT license](../../wireframe-ui.LICENSE.md).

All 45 `registry:ui` entries and nine `registry:block` entries are included. The upstream module named `file` contains Field components. `src/wireframe/registry.json` pins the registry's public component exports, including compound parts and wireframe helpers. `src/ui/wireframe-library-*.tsx` exposes them with a `Wireframe` prefix through the shared SSR/hydration adapter in `src/wireframe/component.tsx`.

Local integration changes:

- Relative imports, existing `cn` utility, React 19 ref props, and prefixed `data-slot` markers.
- MDX boolean/number/JSON attributes and URL validation at the adapter boundary.
- Accessible input labels, editable skeleton inputs, media sources/error fallback, and stable IDs when blocks repeat.
- Semantic heading content, responsive text classes, reduced-motion styles, and frame-relative Section columns.
- Card headers and dashboard rows shrink within document columns; pricing badges remain visible outside their card border.
- Stable sidebar skeleton widths, no sidebar cookie writes, and carousel subscription cleanup.
- Recharts 3 types and the existing mdxr chart CSS sanitization.
- Declarative native-input Form children in addition to React Hook Form's normal render callbacks.

The tests compare the pinned manifest against every component export and render all 54 entries. Interactive browser tests exercise hydration and representative controls. The original mdxr `Wireframe` device frame remains available; `WireframeList` and `WireframeChart` are convenience aliases.

After updating the pinned manifest, run `node scripts/sync-wireframe-catalog.ts` and format the generated adapters. The generator does not download or overwrite the adapted upstream sources.
