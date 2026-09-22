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
import {
  ACTION_BUTTON_CLS,
  AddCommentButton,
  CommentReplyButton,
  CommentStrip,
  CopyFeedback,
  MaybeLink,
  Panel,
  TrimBody,
} from "./bits.js";
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
  CHIP_BORDER_CLS,
  commentStripCls,
  LINK_CLS,
  LOC_CLS,
  MINI_CHIP_CLS,
  SURFACE_CLS,
  TEXT,
  TONE,
  TRIM_CLS,
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
  /** Raw `lines` spec — strip anchors and the markdown serializer reuse it. */
  lines?: string;
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
  file,
  href,
  lines,
  path,
  severity,
  side,
  text,
  title,
}: {
  author?: string;
  children?: ReactNode;
  /** Authored `file` attr (not the resolved link path) — serialized back. */
  file?: string;
  href?: string;
  lines?: string;
  path?: string;
  severity?: SeverityLevel;
  side?: Side;
  /** Flattened body text — the markdown serializer's `<Comment>` payload. */
  text?: string;
  title?: string;
}): ReactElement => {
  const link = useFileLink(path, lines, href);
  const name = nonEmpty(author) ? author.replace(/^@+/u, "") : undefined;
  // data-mdxr-comment marks the card for the markdown serializer; each
  // data-comment-* attr maps back to a <Comment> attribute (doc-events.ts).
  return (
    <div
      className="flex gap-2.5"
      data-comment-author={author}
      data-comment-file={file}
      data-comment-href={href}
      data-comment-lines={lines}
      data-comment-severity={severity}
      data-comment-side={side === "old" ? "old" : undefined}
      data-comment-text={text}
      data-comment-title={title}
      data-mdxr-comment=""
    >
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
      file={p.file}
      href={p.href}
      key={i}
      lines={p.lines}
      path={p.file ?? fallbackPath}
      severity={p.severity}
      side={p.side}
      text={textOf(childrenOf(el)).trim()}
      title={p.title}
    >
      {childrenOf(el)}
    </CommentCard>
  );
  return { file: p.file, lines: p.lines, node, range, side: p.side };
};

/** Group comments by anchor line: a thread lands under `min(end, lines)`
 * — comments starting past EOF join the file-level `tail`. */
const anchorCode = (
  comments: readonly Annotation[],
  lineCount: number
): { after: ReadonlyMap<number, Annotation[]>; tail: Annotation[] } => {
  const after = new Map<number, Annotation[]>();
  const tail: Annotation[] = [];
  for (const c of comments) {
    if (c.range === undefined || c.range.start > lineCount) {
      tail.push(c);
      continue;
    }
    const end = Math.min(c.range.end ?? lineCount, lineCount);
    after.set(end, [...(after.get(end) ?? []), c]);
  }
  return { after, tail };
};

/** The anchor replies inherit — the thread's last comment's spec. */
const stripAnchor = (
  group: Annotation[] | undefined
): { file?: string; lines?: string; side?: Side } | undefined => {
  const last = group?.at(-1);
  return last === undefined
    ? undefined
    : { file: last.file, lines: last.lines, side: last.side };
};

/** The fenced subject decomposed: `code` element attributes + raw text. */
interface SubjectBlock {
  children: ReactNode;
  className?: string;
  diffhl?: string;
  filename?: string;
  lang?: string;
  /** Raw fence meta — the markdown serializer reproduces it verbatim. */
  meta: string;
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
    meta,
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
              <div className="mdxr-cline" data-comment-row="">
                <AddCommentButton line={i + 1} />
                {el}
              </div>
              {anchored.after.get(i + 1) === undefined ? null : (
                <CommentStrip
                  anchor={stripAnchor(anchored.after.get(i + 1))}
                  bleed
                >
                  {anchored.after.get(i + 1)?.map((a): ReactNode => a.node)}
                </CommentStrip>
              )}
            </Fragment>
          ))}
          {anchored.tail.length === 0 ? null : (
            <CommentStrip bleed>
              {anchored.tail.map((a): ReactNode => a.node)}
            </CommentStrip>
          )}
        </div>
      </div>
    </Panel>
  );
};

/** Field look shared by the comment form's textarea and name input. */
const FORM_CONTROL_CLS = `w-full min-w-0 rounded-lg border ${CHIP_BORDER_CLS} bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus-visible:border-neutral-400 focus-visible:ring-3 focus-visible:ring-neutral-200/70 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-800`;

const FORM_SUBMIT_CLS = `inline-flex cursor-pointer items-center rounded-md border border-transparent bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-700 active:translate-y-px dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300`;

/**
 * Inert markup the client clones for interactive bits — `data-comment-tpl`
 * names each fragment: `card` is the CommentCard skeleton with `data-cc-*`
 * fill slots, `form` the reply/new-comment form, `strip` a thread row (its
 * `bleed` variant follows the subject: code strips stretch across the px-4
 * code padding, diff strips don't). Hidden, inert containers keep the same
 * DOM shape during hydration: native template children live in `.content`,
 * where React cannot match them. The serializer excludes these containers.
 */
const CommentTemplates = ({ bleed }: { bleed: boolean }): ReactElement => (
  <>
    <div hidden inert data-comment-tpl="card">
      <div className="flex gap-2.5" data-mdxr-comment="">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
          data-cc-avatar-anon=""
        >
          <Icon className="h-3.5 w-3.5" name="lucide:message-square-text" />
        </span>
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-600 dark:text-neutral-100"
          data-cc-avatar=""
        />
        <article
          className={`min-w-0 flex-1 overflow-hidden rounded-md border ${BORDER_CLS} bg-white dark:bg-neutral-950`}
        >
          <header
            className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b ${BORDER_CLS} ${SURFACE_CLS} px-3 py-1.5 text-xs`}
          >
            <span className={`font-semibold ${TEXT.strong}`} data-cc-name="" />
            <span className={TEXT.muted}>commented</span>
            <span className="ml-auto inline-flex items-center gap-1.5">
              <span className={`${MINI_CHIP_CLS} ${TONE.red}`} data-cc-old="">
                old
              </span>
              <span className={LOC_CLS} data-cc-lines="" />
            </span>
          </header>
          <div
            className={`${TRIM_CLS} px-3.5 py-2.5 text-sm`}
            data-cc-body=""
          />
        </article>
      </div>
    </div>
    <div hidden inert data-comment-tpl="form">
      <div
        className={`rounded-md border ${BORDER_CLS} bg-white p-2.5 dark:bg-neutral-950`}
        data-comment-form=""
      >
        <textarea
          aria-label="Comment text"
          className={FORM_CONTROL_CLS}
          data-comment-input=""
          placeholder="Write a comment"
          rows={3}
        />
        <div className="mt-2 flex items-center gap-2">
          <input
            aria-label="Name (optional)"
            className={`${FORM_CONTROL_CLS} w-40`}
            data-comment-author=""
            placeholder="Name (optional)"
            type="text"
          />
          <span className="ml-auto flex items-center gap-1.5">
            <button
              className={ACTION_BUTTON_CLS}
              data-comment-cancel=""
              type="button"
            >
              Cancel
            </button>
            <button
              className={FORM_SUBMIT_CLS}
              data-comment-submit=""
              type="button"
            >
              Comment
            </button>
          </span>
        </div>
      </div>
    </div>
    <div hidden inert data-comment-tpl="strip">
      <div className={commentStripCls(bleed)} data-comment-strip="">
        <div className="mdxr-thread-tools" data-thread-tools="">
          <CommentReplyButton />
        </div>
      </div>
    </div>
  </>
);

export const Comments = defineComponent(
  {
    description:
      'コード/diff フェンスへの行アンカーコメント（GitHub レビュー形式）。最初のフェンス子が対象。<Comment> 子は lines="40"|"40-52"|"40-" で範囲指定 — diff では side="old|new"（左右）と file=（複数ファイル時の対象選択）も解釈。author/severity/title でヘッダ装飾。lines 省略やアンカー不能なコメントは末尾にファイルレベルコメントとして表示。読者は行ホバーの + でコメント追加、各スレッドの Reply で返信でき、「Copy markdown」がコード+全コメントを <Comments> マークアップとしてコピーする（貼り戻せば永続化できる）',
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
    const diff = isDiffBlock(block);
    const view = diff ? (
      <DiffView
        comments={annotations.map((a): DiffCommentSpec => ({
          file: a.file,
          lines: a.lines,
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
    // data-comments* feeds the markdown serializer (doc-events.ts): the
    // fence round-trips verbatim, cards carry their own <Comment> attrs.
    return (
      <div
        data-comments=""
        data-comments-code={block.text}
        data-comments-lang={block.lang}
        data-comments-meta={nonEmpty(block.meta) ? block.meta : undefined}
      >
        {view}
        {rest.map((n, i) => (
          <Fragment key={i}>{n}</Fragment>
        ))}
        <div className="not-prose mt-2 flex items-center justify-between gap-3">
          <span className={`text-xs ${TEXT.faint}`}>
            Hover a line or hit Reply to comment, then copy the markup.
          </span>
          <button
            className={ACTION_BUTTON_CLS}
            data-comments-copy=""
            type="button"
          >
            <CopyFeedback
              done="Copied"
              icon="lucide:clipboard-list"
              label="Copy markdown"
            />
          </button>
        </div>
        <CommentTemplates bleed={!diff} />
      </div>
    );
  }
);
