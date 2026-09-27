// Attribute in the emitted markup, always `name="v"`: JSX decodes entities
// in attribute strings, so `&`/`"`/`<`/control chars escape as entities —
// the emitted markup stays expression-free (mdxr forbids JS expressions).
export const jsxAttr = (name: string, value: string): string =>
  ` ${name}="${value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\t", "&#9;")}"`;

// Card children serialize as markdown text inside <BoardCard>…</BoardCard>:
// entities cover `&`/`<`/braces (JSX markers), backslash escapes cover
// markdown's inline specials and line-leading block markers, so the text
// re-parses as it reads. Formatting the children had is already lost —
// data-card-text is the flattened visible text.
export const mdText = (s: string): string =>
  s
    .replaceAll("\\", "\\\\")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;")
    .replaceAll(/(?<ch>[`*_[\]])/gu, "\\$<ch>")
    .replaceAll(
      /(?<bol>^|\n)(?<ws>[ \t]*)(?<mark>[-+>#])/gu,
      "$<bol>$<ws>\\$<mark>"
    )
    .replaceAll(
      /(?<bol>^|\n)(?<ws>[ \t]*)(?<num>\d+)(?<dot>[.)])(?=\s|$)/gu,
      "$<bol>$<ws>$<num>\\$<dot>"
    );
