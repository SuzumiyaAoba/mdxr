import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, textOf } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH } from "./attrs.js";
import { CopyButton } from "./bits.js";

/**
 * Fence languages rendered as a command transcript instead of highlighted
 * code: ` ```console `, ` ```terminal `, ` ```shellsession `. Shared from
 * langs.ts — rehype/shiki.ts SKIP_LANGS includes them so the raw text
 * reaches `Pre` untouched.
 */
export { TERMINAL_LANGS } from "../langs.js";

const PROMPT_RE = /^\$(?:\s|$)/u;

/**
 * Flatten children to transcript text. A fenced code block child contributes
 * its raw code (highlight spans are `\n`-separated, so `textOf` preserves
 * line breaks); paragraphs and text join on newlines.
 */
const transcriptText = (children: ReactNode): string =>
  flattenChildren(children)
    .map((child) => textOf(child))
    .join("\n")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .replaceAll(/^\n+|\n+$/gu, "");

export interface TranscriptProps {
  /** Prepended as a `$ …` prompt line when given. */
  cmd?: string;
  /** Exit code badge in the title bar — `0`/empty renders green, others red. */
  exit?: string;
  /** Transcript text; `$ `-prefixed lines render as command prompts. */
  text: string;
  /** Title bar label (defaults to "Terminal"). */
  title?: string;
}

/** Shared terminal-window renderer — used by `Terminal` and `Pre` console fences. */
export const Transcript = ({
  cmd,
  exit,
  text,
  title,
}: TranscriptProps): ReactElement => {
  const body = nonEmpty(cmd) ? `$ ${cmd}\n${text}` : text;
  const lines = body.replace(/\n+$/u, "").split("\n");
  const succeeded = exit === "" || exit === "0";
  return (
    <figure className="not-prose my-6 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <figcaption className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-xs">
        <span aria-hidden className="flex shrink-0 gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-neutral-500">
          {nonEmpty(title) ? title : "Terminal"}
        </span>
        {exit === undefined ? null : (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.7rem] font-medium ${
              succeeded
                ? "bg-emerald-900/70 text-emerald-300"
                : "bg-red-900/70 text-red-300"
            }`}
          >
            exit {exit === "" ? "0" : exit}
          </span>
        )}
        <CopyButton
          className="shrink-0 text-neutral-500 opacity-60"
          copy={body}
          doneClassName="text-emerald-400"
          title="Copy transcript"
        />
      </figcaption>
      <pre className="m-0 overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        {lines.map((line, i) =>
          PROMPT_RE.test(line) ? (
            <span className="block text-neutral-100" key={i}>
              <span className="text-emerald-400 select-none">$</span>
              {line.slice(1)}
            </span>
          ) : (
            <span className="block text-neutral-400" key={i}>
              {nonEmpty(line) ? line : " "}
            </span>
          )
        )}
      </pre>
    </figure>
  );
};

export const Terminal = defineComponent(
  {
    description:
      "ターミナル実行結果ブロック。cmd は `$ ` プロンプト行として先頭に表示、exit は終了コードバッジ (0=緑/他=赤)、title はタイトルバー。children は出力（フェンスドコードブロック推奨）。本文中 `$ ` 始まりの行はコマンド行として強調",
    schema: v.looseObject({
      cmd: v.optional(v.string()),
      exit: v.optional(NUMISH),
      title: v.optional(v.string()),
    }),
  },
  ({ cmd, exit, title, children }) => (
    <Transcript
      cmd={cmd}
      exit={exit === undefined ? undefined : String(exit)}
      text={transcriptText(children)}
      title={title}
    />
  )
);
