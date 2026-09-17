import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

import type { DocProps } from "../define.js";
import { textOf } from "../define.js";
import { isRecord } from "../guards.js";
import { fileIcon } from "./file-icon.js";
import { Icon } from "./icon.js";
import { TERMINAL_LANGS, Transcript } from "./terminal.js";

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/**
 * ```console / ```terminal / ```shellsession fences render as a terminal
 * transcript; `exit="N"` in the fence meta adds an exit-code badge and
 * `title="…"` becomes the window title.
 */
const terminalView = (
  lang: string | undefined,
  meta: string,
  text: string,
  filename: string | undefined
): ReactElement | undefined => {
  if (lang === undefined || !TERMINAL_LANGS.has(lang)) {
    return undefined;
  }
  const exit =
    /(?:^|\s)exit=(?:"(?<dq>[^"]*)"|'(?<sq>[^']*)'|(?<bare>\S+))/u.exec(
      meta
    )?.groups;
  return (
    <Transcript
      exit={exit?.dq ?? exit?.sq ?? exit?.bare}
      text={text}
      title={filename}
    />
  );
};

/**
 * Fences that render as something other than a code block: ```mermaid becomes
 * a diagram (mermaid loads from CDN only when present), console/terminal
 * sessions become transcripts. Returns undefined for ordinary code fences.
 */
const specialView = (
  lang: string | undefined,
  meta: string,
  text: string,
  filename: string | undefined
): ReactElement | undefined => {
  if (lang === "mermaid") {
    return (
      <pre className="mermaid my-6 flex justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        {text}
      </pre>
    );
  }
  return terminalView(lang, meta, text, filename);
};

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

  const special = specialView(lang, meta, text, filename);
  if (special !== undefined) {
    return special;
  }

  // `meta`/`metastring` are plumbing for the filename header, not markup —
  // rebuild <code> with just class+children so they don't leak as attributes.
  const cleanCode = isValidElement<{
    children?: ReactNode;
    className?: unknown;
  }>(code) ? (
    <code className={str(code.props.className)}>{code.props.children}</code>
  ) : (
    code
  );

  return (
    <figure className="not-prose my-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <figcaption className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <span className="inline-flex items-center gap-1.5 font-mono">
          <Icon
            className="h-3.5 w-3.5"
            name={fileIcon(filename ?? lang ?? "code")}
          />
          {filename ?? lang ?? "code"}
        </span>
        <button
          type="button"
          data-copy={text}
          className="rv-copy cursor-pointer opacity-60"
          title="Copy code"
          aria-label="Copy code"
        >
          <span className="rv-copy-idle inline-flex">
            <Icon className="h-3.5 w-3.5" name="lucide:copy" />
          </span>
          <span className="rv-copy-done hidden items-center text-emerald-600 dark:text-emerald-400">
            <Icon className="h-3.5 w-3.5" name="lucide:check" />
          </span>
        </button>
      </figcaption>
      <pre className="m-0 overflow-x-auto bg-white p-4 text-sm dark:bg-neutral-950">
        {cleanCode}
      </pre>
    </figure>
  );
};
