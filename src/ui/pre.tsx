import type { ReactElement } from "react";

import type { DocProps } from "../define.js";
import { textOf } from "../define.js";
import { isRecord } from "../guards.js";

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/**
 * Overrides the `pre` element: fenced code blocks become framed blocks with a
 * filename/language header and a copy button. ```mermaid fences render as
 * diagrams (mermaid is loaded from CDN only when present).
 */
export const Pre = (props: DocProps): ReactElement => {
  const code = props.children;
  const codeProps: Record<string, unknown> =
    isRecord(code) && isRecord(code.props) ? code.props : {};
  const lang = /language-(?<lang>[\w-]+)/u.exec(str(codeProps.className) ?? "")
    ?.groups?.lang;
  const meta =
    str(props.meta) ?? str(codeProps.meta) ?? str(codeProps.metastring) ?? "";
  const filename =
    /(?:title|filename)="(?<name>[^"]+)"/u.exec(meta)?.groups?.name ??
    /(?:title|filename)=(?<name>[^\s"']+)/u.exec(meta)?.groups?.name;
  const text = textOf(codeProps.children);

  if (lang === "mermaid") {
    return (
      <pre className="mermaid my-6 flex justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        {text}
      </pre>
    );
  }

  return (
    <figure className="not-prose my-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <figcaption className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <span className="font-mono">{filename ?? lang ?? "code"}</span>
        <button
          type="button"
          data-copy={text}
          className="rv-copy cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          title="Copy code"
          aria-label="Copy code"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="currentColor"
            aria-hidden
          >
            <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z" />
          </svg>
        </button>
      </figcaption>
      <pre className="m-0 overflow-x-auto bg-white p-4 text-sm dark:bg-neutral-950">
        {code}
      </pre>
    </figure>
  );
};
