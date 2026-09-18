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
