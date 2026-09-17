import { isValidElement, useContext } from "react";
import type { ReactElement, ReactNode } from "react";

import type { DocProps } from "../define.js";
import { textOf } from "../define.js";
import { DocContext } from "../doc-context.js";
import { firstLine } from "../editor.js";
import { isRecord, nonEmpty } from "../guards.js";
import { fileIcon } from "./file-icon.js";
import { linkTarget } from "./file-link.js";
import { Icon } from "./icon.js";
import { TERMINAL_LANGS, Transcript } from "./terminal.js";

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/** "src/x.ts:40-52" → { path: "src/x.ts", line: "40" }; labels stay untouched. */
const splitFileLine = (filename: string): { line?: string; path: string } => {
  const m = /^(?<p>.+?):(?<ls>\d+(?:-\d*)?)$/u.exec(filename);
  return m?.groups === undefined
    ? { path: filename }
    : { line: firstLine(m.groups.ls), path: m.groups.p };
};

/** Editor link for a code-header filename, when it resolves to a real file. */
const useFilenameLink = (filename: string | undefined): string | undefined => {
  const { fileLink } = useContext(DocContext);
  if (filename === undefined || fileLink === undefined) {
    return undefined;
  }
  const target = splitFileLine(filename);
  return nonEmpty(target.path) ? fileLink(target.path, target.line) : undefined;
};

/** Filename/language bar for a fenced block; links to the file when it exists. */
const CodeHeader = (props: {
  filename?: string;
  lang?: string;
  text: string;
}): ReactElement => {
  const link = useFilenameLink(props.filename);
  const label = (
    <>
      <Icon
        className="h-3.5 w-3.5"
        name={fileIcon(props.filename ?? props.lang ?? "code")}
      />
      {props.filename ?? props.lang ?? "code"}
    </>
  );
  return (
    <figcaption className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      {link === undefined ? (
        <span className="inline-flex items-center gap-1.5 font-mono">
          {label}
        </span>
      ) : (
        <a
          className="inline-flex items-center gap-1.5 font-mono text-inherit no-underline hover:underline"
          href={link}
          {...linkTarget(link)}
        >
          {label}
        </a>
      )}
      <button
        type="button"
        data-copy={props.text}
        className="mdxr-copy cursor-pointer opacity-60"
        title="Copy code"
        aria-label="Copy code"
      >
        <span className="mdxr-copy-idle inline-flex">
          <Icon className="h-3.5 w-3.5" name="lucide:copy" />
        </span>
        <span className="mdxr-copy-done hidden items-center text-emerald-600 dark:text-emerald-400">
          <Icon className="h-3.5 w-3.5" name="lucide:check" />
        </span>
      </button>
    </figcaption>
  );
};

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
    <figure className="not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <CodeHeader filename={filename} lang={lang} text={text} />
      <pre className="m-0 overflow-x-auto bg-white p-4 text-sm dark:bg-neutral-950">
        {cleanCode}
      </pre>
    </figure>
  );
};
