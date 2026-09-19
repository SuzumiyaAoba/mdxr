import { Fragment, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import {
  defineComponent,
  flattenChildren,
  parseProps,
  textOf,
} from "../define.js";
import { asString, isRecord, nonEmpty } from "../guards.js";
import { fenceFilename, parseLineRange } from "../lines.js";
import { CommentStrip, MaybeLink, Panel, TrimBody } from "./bits.js";
import { indexChildren } from "./child-index.js";
import { isEl, propOf } from "./children.js";
import { parseDiff, parseDiffHl } from "./diff-parse.js";
import type { DiffCommentSpec } from "./diff.js";
import { DiffView } from "./diff.js";
import { useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";
import { initials } from "./owner.js";
import { CodeHeader, Pre } from "./pre.js";
import { Comment } from "./review.js";
import type { SeverityLevel } from "./severity.js";
import { SEVERITY_LEVELS, Severity } from "./severity.js";
import {
  BORDER_CLS,
  LINK_CLS,
  LOC_CLS,
  MINI_CHIP_CLS,
  SURFACE_CLS,
  TEXT,
  TONE,
} from "./tones.js";

/**
 * Line-anchored comment threads on a code or diff fence — GitHub's PR
 * review shape. `<Comments>` takes one fenced code block child plus
 * `<Comment>` children carrying `lines`/`side`/`file` anchors; each thread
 * renders inline under the line it targets. Anchoring and file/hunk
 * routing live here and in diff.tsx's `DiffCommentSpec` plumbing.
 */

const SIDES = ["old", "new"] as const;
type Side = (typeof SIDES)[number];

/** `<Comment>` props as read by `<Comments>` — the standalone schema is
 * `looseObject`, so anchor attributes pass through; this schema validates
 * them (incl. the `lines` grammar) for the anchored context. */
const ANNOTATION_SCHEMA = v.looseObject({
  author: v.optional(v.string()),
  file: v.optional(v.string()),
  href: v.optional(v.string()),
  lines: v.optional(
    v.pipe(
      v.string(),
      v.check(
        (s) => parseLineRange(s) !== undefined,
        'expected "40", "40-52" or "40-"'
      )
    )
  ),
  severity: v.optional(v.picklist(SEVERITY_LEVELS)),
  side: v.optional(v.picklist(SIDES), "new"),
  title: v.optional(v.string()),
});

interface Annotation {
  file?: string;
  /** Rendered card — injected at the anchor row. */
  node: ReactNode;
  range?: { end?: number; start: number };
  side: Side;
}

const isLineElement = (n: ReactElement): boolean =>
  /(?:^|\s)line(?:\s|$)/u.test(asString(propOf(n, "className")) ?? "");

/**
 * One rendered node per source line of a `code` element. Shiki output
 * already arrives as `span.line` children (separated by `\n` text nodes);
 * unhighlighted fences carry raw text, split here into matching `line`
 * spans so numbering/bands treat every row identically.
 */
const lineNodes = (children: ReactNode): ReactNode[] => {
  const lines = flattenChildren(children).filter(
    (n): n is ReactElement => isValidElement(n) && isLineElement(n)
  );
  if (lines.length > 0) {
    return lines;
  }
  const text = textOf(children).replace(/\n$/u, "");
  return text === ""
    ? []
    : text.split("\n").map((t, i) => (
        <span className="line" key={i}>
          {t}
        </span>
      ));
};

/** Avatar disc in the strip's left gutter — initials for a named author,
 * a thread icon otherwise (GitHub always shows the commenter's avatar). */
const Avatar = ({ author }: { author?: string }): ReactElement =>
  nonEmpty(author) ? (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-600 dark:text-neutral-100"
    >
      {initials(author)}
    </span>
  ) : (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
    >
      <Icon className="h-3.5 w-3.5" name="lucide:message-square-text" />
    </span>
  );

/** One GitHub-style review comment: avatar in the left gutter, then a
 * bordered box whose muted header reads `name commented · title` with a
 * right cluster of severity pill, `old`-side chip and the `:lines` anchor
 * link. `children` is the MDX body — nested fences render as ordinary
 * code panels, so ` ```diff ` suggestion blocks just work. */
const CommentCard = ({
  author,
  children,
  href,
  lines,
  path,
  severity,
  side,
  title,
}: {
  author?: string;
  children?: ReactNode;
  href?: string;
  lines?: string;
  path?: string;
  severity?: SeverityLevel;
  side?: Side;
  title?: string;
}): ReactElement => {
  const link = useFileLink(path, lines, href);
  const name = nonEmpty(author) ? author.replace(/^@+/u, "") : undefined;
  return (
    <div className="flex gap-2.5">
      <Avatar author={author} />
      <article
        className={`min-w-0 flex-1 overflow-hidden rounded-md border ${BORDER_CLS} bg-white dark:bg-neutral-950`}
      >
        <header
          className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b ${BORDER_CLS} ${SURFACE_CLS} px-3 py-1.5 text-xs`}
        >
          {name === undefined ? null : (
            <span className={`font-semibold ${TEXT.strong}`}>{name}</span>
          )}
          <span className={TEXT.muted}>commented</span>
          {nonEmpty(title) ? (
            <span className={`font-medium ${TEXT.strong}`}>· {title}</span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1.5">
            {severity === undefined ? null : <Severity level={severity} />}
            {side === "old" ? (
              <span className={`${MINI_CHIP_CLS} ${TONE.red}`}>old</span>
            ) : null}
            {nonEmpty(lines) ? (
              <MaybeLink className={`${LOC_CLS} ${LINK_CLS}`} href={link}>
                :{lines}
              </MaybeLink>
            ) : null}
          </span>
        </header>
        <TrimBody className="px-3.5 py-2.5 text-sm">{children}</TrimBody>
      </article>
    </div>
  );
};

/** Typed `props.children` off an element — `isValidElement` narrowing
 * keeps this free of type assertions. */
const childrenOf = (el: unknown): ReactNode =>
  isValidElement<{ children?: ReactNode }>(el) ? el.props.children : undefined;

/** Raw `<Comment>` element → annotation record with its rendered card. */
const toAnnotation = (
  el: ReactElement,
  i: number,
  fallbackPath: string | undefined
): Annotation => {
  const p = parseProps(ANNOTATION_SCHEMA, el.props, "Comment");
  const range = p.lines === undefined ? undefined : parseLineRange(p.lines);
  const node = (
    <CommentCard
      author={p.author}
      href={p.href}
      key={i}
      lines={p.lines}
      path={p.file ?? fallbackPath}
      severity={p.severity}
      side={p.side}
      title={p.title}
    >
      {childrenOf(el)}
    </CommentCard>
  );
  return { file: p.file, node, range, side: p.side };
};

/** Group comments by anchor line: a thread lands under `min(end, lines)`
 * — comments starting past EOF join the file-level `tail`. */
const anchorCode = (
  comments: readonly Annotation[],
  lineCount: number
): { after: ReadonlyMap<number, ReactNode[]>; tail: ReactNode[] } => {
  const after = new Map<number, ReactNode[]>();
  const tail: ReactNode[] = [];
  for (const c of comments) {
    if (c.range === undefined || c.range.start > lineCount) {
      tail.push(c.node);
      continue;
    }
    const end = Math.min(c.range.end ?? lineCount, lineCount);
    after.set(end, [...(after.get(end) ?? []), c.node]);
  }
  return { after, tail };
};

/** The fenced subject decomposed: `code` element attributes + raw text. */
interface SubjectBlock {
  children: ReactNode;
  className?: string;
  diffhl?: string;
  filename?: string;
  lang?: string;
  text: string;
}

const subjectBlock = (subject: ReactElement): SubjectBlock => {
  const codeEl = flattenChildren(childrenOf(subject)).find(
    (n): n is ReactElement => isValidElement(n) && n.type === "code"
  );
  const codeProps = isRecord(codeEl?.props) ? codeEl.props : {};
  const lang = /language-(?<lang>[\w-]+)/u.exec(
    asString(codeProps.className) ?? ""
  )?.groups?.lang;
  const meta =
    asString(propOf(subject, "meta")) ??
    asString(codeProps.meta) ??
    asString(codeProps.metastring) ??
    "";
  const children = childrenOf(codeEl);
  return {
    children,
    className: asString(codeProps.className),
    diffhl: asString(codeProps["data-diffhl"]),
    filename: fenceFilename(meta),
    lang,
    text: textOf(children),
  };
};

const isDiffBlock = (block: SubjectBlock): boolean =>
  (block.lang === "diff" || block.lang === "patch") &&
  block.text.trim() !== "" &&
  parseDiff(block.text).some((f) => f.raw.length > 0);

/** Code-block subject: `.line` rows with the comment strips interleaved —
 * the `.shiki` ancestor keeps token colors and the `has-line-numbers`
 * counter numbers rows across strip boundaries. */
const AnnotatedCode = ({
  block,
  comments,
}: {
  block: SubjectBlock;
  comments: readonly Annotation[];
}): ReactElement => {
  const lines = lineNodes(block.children);
  const anchored = anchorCode(comments, lines.length);
  // `language-*`/`has-*` classes off the code element keep feature flags
  // (focused lines, diff markers); `shiki`/`has-line-numbers` come back
  // canonically so the class list never duplicates.
  const codeCls = (block.className ?? "")
    .split(/\s+/u)
    .filter((c) => c !== "" && c !== "shiki" && c !== "has-line-numbers")
    .join(" ");
  return (
    <Panel>
      <CodeHeader
        filename={block.filename}
        lang={block.lang}
        text={block.text}
      />
      <div className="overflow-x-auto bg-white py-2 dark:bg-neutral-950">
        <div
          className={`${codeCls} shiki has-line-numbers px-4 font-mono text-[0.8125rem] leading-5 whitespace-pre`}
        >
          {lines.map((el, i) => (
            <Fragment key={i}>
              {el}
              {anchored.after.get(i + 1) === undefined ? null : (
                <CommentStrip bleed>{anchored.after.get(i + 1)}</CommentStrip>
              )}
            </Fragment>
          ))}
          {anchored.tail.length === 0 ? null : (
            <CommentStrip bleed>{anchored.tail}</CommentStrip>
          )}
        </div>
      </div>
    </Panel>
  );
};

export const Comments = defineComponent(
  {
    description:
      'コード/diff フェンスへの行アンカーコメント（GitHub レビュー形式）。最初のフェンス子が対象。<Comment> 子は lines="40"|"40-52"|"40-" で範囲指定 — diff では side="old|new"（左右）と file=（複数ファイル時の対象選択）も解釈。author/severity/title でヘッダ装飾。lines 省略やアンカー不能なコメントは末尾にファイルレベルコメントとして表示',
    schema: v.looseObject({}),
  },
  ({ children }) => {
    const flat = flattenChildren(children);
    const subject = flat.find((n) => isEl(n, Pre));
    if (subject === undefined) {
      // No fence to anchor to — comments still render as standalone cards.
      return (
        <div className="not-prose space-y-3">{indexChildren(children)}</div>
      );
    }
    const block = subjectBlock(subject);
    const annotations = flat
      .filter((n) => isEl(n, Comment))
      .map((el, i) => toAnnotation(el, i, block.filename));
    const rest = flat.filter((n) => n !== subject && !isEl(n, Comment));
    const view = isDiffBlock(block) ? (
      <DiffView
        comments={annotations.map((a): DiffCommentSpec => ({
          file: a.file,
          node: a.node,
          range: a.range,
          side: a.side,
        }))}
        filename={block.filename}
        hl={parseDiffHl(block.diffhl)}
        text={block.text}
      />
    ) : (
      <AnnotatedCode block={block} comments={annotations} />
    );
    return (
      <>
        {view}
        {rest.map((n, i) => (
          <Fragment key={i}>{n}</Fragment>
        ))}
      </>
    );
  }
);
