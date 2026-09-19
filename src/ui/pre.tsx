import { isValidElement, useContext } from "react";
import type { ReactElement, ReactNode } from "react";

import type { DocProps } from "../define.js";
import { textOf } from "../define.js";
import { DocContext } from "../doc-context.js";
import { asString, isRecord, nonEmpty } from "../guards.js";
import { fenceFilename, firstLine, splitPathLines } from "../lines.js";
import { CaptionBar, CopyButton, MaybeLink, Panel } from "./bits.js";
import type { DiffHl } from "./diff-parse.js";
import { parseDiffHl } from "./diff-parse.js";
import { DiffView } from "./diff.js";
import { fileIcon } from "./file-icon.js";
import { Icon } from "./icon.js";
import { TERMINAL_LANGS, Transcript } from "./terminal.js";
import { BORDER_CLS, LINK_CLS, SURFACE_CLS } from "./tones.js";

/** "src/x.ts:40-52" → { path: "src/x.ts", line: "40" }; labels stay untouched. */
const splitFileLine = (filename: string): { line?: string; path: string } => {
  const { lines, path } = splitPathLines(filename);
  return { line: firstLine(lines), path };
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
export const CodeHeader = (props: {
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
    <CaptionBar className="flex items-center justify-between">
      <MaybeLink
        className={`inline-flex items-center gap-1.5 font-mono ${LINK_CLS}`}
        href={link}
      >
        {label}
      </MaybeLink>
      <CopyButton copy={props.text} title="Copy code" />
    </CaptionBar>
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
 * sessions become transcripts, ```diff/```patch become structured per-file
 * diff cards. Returns undefined for ordinary code fences.
 */
const specialView = (
  lang: string | undefined,
  meta: string,
  text: string,
  filename: string | undefined,
  hl: DiffHl | undefined
): ReactElement | undefined => {
  if (lang === "mermaid") {
    return (
      <pre
        className={`mermaid my-6 flex justify-center rounded-lg border p-4 ${SURFACE_CLS} ${BORDER_CLS}`}
      >
        {text}
      </pre>
    );
  }
  if (lang === "diff" || lang === "patch") {
    // An empty diff fence renders as nothing — fall back to a code block.
    if (text.trim() === "") {
      return undefined;
    }
    return <DiffView filename={filename} hl={hl} text={text} />;
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
  const lang = /language-(?<lang>[\w-]+)/u.exec(
    asString(codeProps.className) ?? ""
  )?.groups?.lang;
  const meta =
    asString(props.meta) ??
    asString(codeProps.meta) ??
    asString(codeProps.metastring) ??
    "";
  // Boundary-anchored: `data-title="x"` must not yield a filename header.
  const filename = fenceFilename(meta);
  const text = textOf(codeProps.children);

  const special = specialView(
    lang,
    meta,
    text,
    filename,
    parseDiffHl(asString(codeProps["data-diffhl"]))
  );
  if (special !== undefined) {
    return special;
  }

  // `meta`/`metastring` are plumbing for the filename header, not markup —
  // rebuild <code> with just class+children so they don't leak as attributes.
  const cleanCode = isValidElement<{
    children?: ReactNode;
    className?: unknown;
  }>(code) ? (
    <code className={asString(code.props.className)}>
      {code.props.children}
    </code>
  ) : (
    code
  );

  return (
    <Panel>
      <CodeHeader filename={filename} lang={lang} text={text} />
      <pre className="m-0 overflow-x-auto bg-white p-4 text-sm dark:bg-neutral-950">
        {cleanCode}
      </pre>
    </Panel>
  );
};
