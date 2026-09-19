import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { formatAnswerSheet } from "../ask-sheet.js";
import type { SheetEntry } from "../ask-sheet.js";
import type { DocProps } from "../define.js";
import { defineComponent, flattenChildren, textOf } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Choice, Question, QUESTION_TYPES } from "./ask-question.js";
import type { QuestionType } from "./ask-question.js";
import { attrTrue } from "./attrs.js";
import {
  ACTION_BUTTON_CLS,
  CAPTION_CLS,
  CopyFeedback,
  PANEL_CLS,
} from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import { BORDER_CLS, DIVIDE_CLS, SURFACE_CLS, TEXT } from "./tones.js";

export { Choice, Question, QUESTION_TYPES } from "./ask-question.js";
export type { QuestionType } from "./ask-question.js";

type QuestionEl = ReactElement<DocProps>;

// The initial sheet must match what client/doc-events.ts would compute —
// syncAsk rewrites [data-ask-output] before hydration, so SSR renders the
// seeded sheet rather than a placeholder; otherwise hydrateRoot would patch
// the pane back and revert the reader's default answers.

/** choiceText: a <Choice>'s visible label text, falling back to `value`. */
const choiceLabel = (c: QuestionEl): string => {
  const text = textOf(propOf(c, "children")).replaceAll(/\s+/gu, " ").trim();
  if (text !== "") {
    return text;
  }
  const value = propOf(c, "value");
  return typeof value === "string" ? value : "";
};

const choicesOf = (q: QuestionEl): QuestionEl[] =>
  flattenChildren(q.props.children).filter((c): c is QuestionEl =>
    isEl(c, Choice)
  );

const checkedChoicesOf = (q: QuestionEl): QuestionEl[] =>
  choicesOf(q).filter((c) => attrTrue(propOf(c, "checked")));

// Same defaulting as Question's render: explicit `type`, else `choice` when
// <Choice> children exist, else `text`.
const questionType = (q: QuestionEl): QuestionType =>
  QUESTION_TYPES.find((t) => t === propOf(q, "type")) ??
  (choicesOf(q).length > 0 ? "choice" : "text");

const selectAnswer = (q: QuestionEl): string => {
  const [checked] = checkedChoicesOf(q);
  // <select defaultValue> only lands when the checked choice's `value` is
  // non-empty; otherwise the browser stays on the first option — the
  // placeholder (value "", i.e. unanswered) when present, else the first
  // choice. The client reads s.value, so a picked option with value=""
  // still reports "".
  const sel =
    checked !== undefined && nonEmpty(propOf(checked, "value"))
      ? checked
      : undefined;
  const picked =
    sel ?? (nonEmpty(propOf(q, "placeholder")) ? undefined : choicesOf(q)[0]);
  if (picked === undefined || !nonEmpty(propOf(picked, "value"))) {
    return "";
  }
  return choiceLabel(picked);
};

// answerOf for the untouched default state: checked choices read as their
// visible text, a select as its first selected option, a toggle as yes/no,
// free-form fields as their `value`.
const defaultAnswer = (q: QuestionEl): string => {
  const t = questionType(q);
  if (t === "multi") {
    return checkedChoicesOf(q)
      .map(choiceLabel)
      .filter((s) => s !== "")
      .join(", ");
  }
  if (t === "choice") {
    const [first] = checkedChoicesOf(q);
    return first === undefined ? "" : choiceLabel(first);
  }
  if (t === "select") {
    return selectAnswer(q);
  }
  if (t === "toggle") {
    return attrTrue(propOf(q, "checked")) ? "yes" : "no";
  }
  const value = propOf(q, "value");
  return typeof value === "string" ? value.trim() : "";
};

// Every <Question> under <Ask>, matching the client's
// querySelectorAll("[data-mdxr-q]") reach — descend through element children
// (a Question's own children are choices, never questions).
const collectQuestions = (node: ReactNode, out: QuestionEl[]): void => {
  for (const c of flattenChildren(node)) {
    if (isEl<DocProps>(c, Question)) {
      out.push(c);
    } else if (isValidElement<DocProps>(c)) {
      collectQuestions(c.props.children, out);
    }
  }
};

// askMarkdown for the initial DOM — the client's formatter (ask-sheet.ts)
// applied to the untouched default answers.
const answerSheet = (title: unknown, children: ReactNode): string => {
  const questions: QuestionEl[] = [];
  collectQuestions(children, questions);
  const entries: SheetEntry[] = [];
  for (const q of questions) {
    const rawLabel = nonEmpty(propOf(q, "label"))
      ? propOf(q, "label")
      : propOf(q, "name");
    entries.push({
      answer: defaultAnswer(q),
      label: typeof rawLabel === "string" ? rawLabel : "",
    });
  }
  return formatAnswerSheet(
    typeof title === "string" ? title : undefined,
    entries
  );
};

/**
 * A block of questions asking the reader for input — e.g. open decisions in
 * a plan. Built on native form controls so it is interactive in static HTML.
 * Answers are rendered live as a Markdown sheet (`- **label**: answer` lines
 * under `# title`) in the output pane; "Copy answers" copies it to the
 * clipboard and "Save .md" downloads it (nothing is submitted anywhere).
 * `Choice`/`Question` and the per-type field chrome live in
 * `ask-question.tsx`.
 */
export const Ask = defineComponent(
  {
    description:
      "ユーザーへの質問フォーム。<Question> を並べる。ネイティブコントロールで JS なしに操作可能。回答はラベル付きの Markdown として表示され、「Copy answers」でコピー、「Save .md」で保存できる",
    schema: v.looseObject({
      description: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, description, children }) => (
    <section
      className={`mdxr-ask ${PANEL_CLS}`}
      data-ask
      data-ask-title={nonEmpty(title) ? title : undefined}
    >
      <div className={CAPTION_CLS}>
        <div className="flex items-center gap-1.5 font-semibold">
          <Icon className="h-3.5 w-3.5" name="lucide:list-checks" />
          {nonEmpty(title) ? title : "Questions"}
        </div>
        {nonEmpty(description) ? <p className="mt-1">{description}</p> : null}
      </div>
      <div className={DIVIDE_CLS}>{children}</div>
      <div className={`border-t ${BORDER_CLS}`}>
        <div
          className={`flex items-center gap-1.5 px-4 pt-2.5 text-xs font-medium ${TEXT.faint}`}
        >
          <Icon className="h-3 w-3" name="lucide:file-text" />
          Markdown
        </div>
        <pre
          className={`m-0 max-h-64 overflow-auto px-4 pt-1 pb-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap ${TEXT.body}`}
          data-ask-output
        >
          {answerSheet(title, children)}
        </pre>
      </div>
      <div
        className={`flex items-center justify-between gap-3 border-t ${SURFACE_CLS} px-4 py-2 ${BORDER_CLS}`}
      >
        <span className={`text-xs ${TEXT.faint}`}>
          Updates live as you answer — copy or save it.
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button className={ACTION_BUTTON_CLS} data-ask-copy type="button">
            <CopyFeedback
              done="Copied"
              icon="lucide:clipboard-list"
              label="Copy answers"
            />
          </button>
          <button className={ACTION_BUTTON_CLS} data-ask-save type="button">
            <CopyFeedback
              done="Saved"
              icon="lucide:download"
              label="Save .md"
            />
          </button>
        </div>
      </div>
    </section>
  )
);
