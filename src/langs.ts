import { own } from "./guards.js";

/**
 * Fence-language sets shared by the rehype highlighter and the `Terminal`
 * component. `Terminal` renders these as transcripts; shiki must skip them.
 */

/** Session/transcript fence languages rendered by the `Terminal` component. */
export const TERMINAL_LANGS: ReadonlySet<string> = new Set([
  "console",
  "shell-session",
  "shellsession",
  "terminal",
]);

/** Languages with no grammar — left as plain `<pre>` text. */
export const PLAIN_LANGS: ReadonlySet<string> = new Set([
  "plain",
  "plaintext",
  "text",
  "txt",
]);

/** Fences the shiki highlighter skips entirely (terminal + mermaid + plain). */
export const SKIP_LANGS: ReadonlySet<string> = new Set([
  ...TERMINAL_LANGS,
  ...PLAIN_LANGS,
  "mermaid",
]);

/** Exact basenames (lowercased) → shiki language id, for files with no
 * meaningful extension. */
const FILE_LANGS: Record<string, string> = {
  ".babelrc": "json",
  ".editorconfig": "ini",
  ".eslintrc": "json",
  ".gitignore": "ini",
  ".npmrc": "ini",
  ".prettierrc": "json",
  brewfile: "ruby",
  "cmakelists.txt": "cmake",
  containerfile: "dockerfile",
  dockerfile: "dockerfile",
  gemfile: "ruby",
  gnumakefile: "makefile",
  guardfile: "ruby",
  jenkinsfile: "groovy",
  makefile: "makefile",
  podfile: "ruby",
  rakefile: "ruby",
  vagrantfile: "ruby",
};

/** Extensions (lowercase, no dot) → shiki language id. Unknown ids are safe:
 * the highlighter's lazy loader rejects names outside shiki's bundle and the
 * caller falls back to unhighlighted rows. */
const EXT_LANGS: Record<string, string> = {
  astro: "astro",
  bash: "bash",
  c: "c",
  cc: "cpp",
  cfg: "ini",
  cjs: "javascript",
  clj: "clojure",
  cljs: "clojure",
  cmake: "cmake",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  cts: "typescript",
  cxx: "cpp",
  dart: "dart",
  dockerfile: "dockerfile",
  ex: "elixir",
  exs: "elixir",
  fish: "fish",
  fs: "fsharp",
  fsx: "fsharp",
  gql: "graphql",
  graphql: "graphql",
  h: "c",
  hh: "cpp",
  hpp: "cpp",
  hs: "haskell",
  htm: "html",
  html: "html",
  hxx: "cpp",
  ini: "ini",
  java: "java",
  jl: "julia",
  js: "javascript",
  json: "json",
  json5: "json5",
  jsonc: "jsonc",
  jsx: "jsx",
  kt: "kotlin",
  kts: "kotlin",
  less: "less",
  lua: "lua",
  md: "markdown",
  mdx: "markdown",
  mjs: "javascript",
  ml: "ocaml",
  mts: "typescript",
  php: "php",
  pl: "perl",
  pm: "perl",
  prisma: "prisma",
  proto: "proto",
  ps1: "powershell",
  py: "python",
  pyi: "python",
  r: "r",
  rb: "ruby",
  rs: "rust",
  sc: "scala",
  scala: "scala",
  scss: "scss",
  sh: "bash",
  sql: "sql",
  svelte: "svelte",
  svg: "xml",
  swift: "swift",
  tf: "terraform",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  vb: "vb",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zig: "zig",
  zsh: "zsh",
};

/** Best-guess shiki language for a file path — basename first, then the
 * extension. `x.d.ts` keeps `ts` (the declaration grammar is the same). */
export const langForPath = (path: string): string | undefined => {
  const base = path.split(/[\\/]/u).at(-1)?.toLowerCase() ?? "";
  const named = own(FILE_LANGS, base);
  if (named !== undefined) {
    return named;
  }
  const ext = /\.(?<e>[^.]+)$/u.exec(base)?.groups?.e;
  return ext === undefined ? undefined : own(EXT_LANGS, ext);
};
