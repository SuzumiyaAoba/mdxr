import { createContext, isValidElement, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import type { DocProps } from "../define.js";
import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

export const QUESTION_TYPES = [
  "choice",
  "multi",
  "select",
  "text",
  "textarea",
  "toggle",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

type ChoiceKind = "checkbox" | "option" | "radio";

/** The control each question type renders <Choice> children as. */
const CHOICE_MODE: Record<QuestionType, ChoiceKind> = {
  choice: "radio",
  multi: "checkbox",
  select: "option",
  text: "radio",
  textarea: "radio",
  toggle: "radio",
};

/** MDX attributes arrive as strings; accept `x`, `x="true"`, `x="false"`. */
const truthy = (x: unknown): boolean => x === true || x === "" || x === "true";

/** How a <Choice> renders, provided by the enclosing <Question>. */
const ChoiceMode = createContext<{ mode: ChoiceKind; name: string }>({
  mode: "radio",
  name: "",
});

const CONTROL_CLS =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus-visible:border-neutral-400 focus-visible:ring-3 focus-visible:ring-neutral-200/70 dark:border-neutral-700 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-800";

/**
 * A single option inside a `<Question type="choice|multi|select">`. Renders
 * as a radio card, a checkbox card, or an `<option>` depending on the
 * question's type — all native controls, so they work in static HTML.
 */
export const Choice = defineComponent(
  {
    description:
      "<Question> の選択肢。choice=ラジオ / multi=チェックボックス / select=option として描画。checked で初期選択",
    schema: v.looseObject({
      checked: v.optional(v.union([v.boolean(), v.string()])),
      description: v.optional(v.string()),
      value: v.string(),
    }),
  },
  ({ value, checked, description, children }) => {
    const { mode, name } = useContext(ChoiceMode);
    if (mode === "option") {
      // `checked` is read by the parent <select defaultValue> — React
      // rejects `selected` on <option>.
      return <option value={value}>{children}</option>;
    }
    return (
      <label className="mdxr-choice flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800/60">
        <input
          className="sr-only"
          defaultChecked={truthy(checked)}
          name={name}
          type={mode}
          value={value}
        />
        <span
          aria-hidden
          className={`mdxr-mark ${mode === "radio" ? "mdxr-mark-radio" : "mdxr-mark-box"}`}
        >
          {mode === "radio" ? null : (
            <Icon className="h-3 w-3" name="lucide:check" />
          )}
        </span>
        <span className="mdxr-choice-text min-w-0 flex-1 leading-snug">
          {children}
          {nonEmpty(description) ? (
            <span className="mdxr-choice-desc mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </span>
          ) : null}
        </span>
      </label>
    );
  }
);

const isCheckedChoice = (node: ReactNode): node is ReactElement<DocProps> =>
  isValidElement<DocProps>(node) && truthy(node.props.checked);

/** Label/description/data-attrs chrome shared by every question frame. */
interface QuestionChrome {
  descEl: ReactNode;
  id: string;
  labelEl: ReactNode;
  qAttrs: {
    readonly "data-mdxr-q": "";
    readonly "data-q-label": string;
    readonly "data-q-type": QuestionType;
  };
}

interface ChoiceCtx {
  mode: ChoiceKind;
  name: string;
}

// choice/multi: each <Choice> renders its own card under a shared <fieldset>.
const ChoiceField = ({
  children,
  chrome,
  ctx,
}: {
  children?: ReactNode;
  chrome: QuestionChrome;
  ctx: ChoiceCtx;
}): ReactElement => (
  // <legend> sits at the fieldset's top edge regardless of the
  // fieldset's padding-top, so the top padding lives on the legend.
  <fieldset className="mdxr-q m-0 px-4 pb-3.5" {...chrome.qAttrs}>
    <legend className="p-0 pt-4.5 text-sm font-medium">{chrome.labelEl}</legend>
    {chrome.descEl}
    <div className="mt-2 space-y-1.5">
      <ChoiceMode.Provider value={ctx}>{children}</ChoiceMode.Provider>
    </div>
  </fieldset>
);

const ToggleField = ({
  checked,
  chrome,
  name,
}: {
  checked: boolean | string | undefined;
  chrome: QuestionChrome;
  name: string;
}): ReactElement => (
  <div className="mdxr-q px-4 py-3.5" {...chrome.qAttrs}>
    <label
      className="flex cursor-pointer items-center justify-between gap-3"
      htmlFor={chrome.id}
    >
      <span className="text-sm font-medium">
        {chrome.labelEl}
        {chrome.descEl}
      </span>
      <input
        className="sr-only"
        defaultChecked={truthy(checked)}
        id={chrome.id}
        name={name}
        type="checkbox"
        value="yes"
      />
      <span aria-hidden className="mdxr-switch" />
    </label>
  </div>
);

/** label + description + control wrapper used by the text-like types. */
const FieldFrame = ({
  children,
  chrome,
}: {
  children?: ReactNode;
  chrome: QuestionChrome;
}): ReactElement => (
  <div className="mdxr-q px-4 py-3.5" {...chrome.qAttrs}>
    <label className="text-sm font-medium" htmlFor={chrome.id}>
      {chrome.labelEl}
    </label>
    {chrome.descEl}
    <div className="mt-2">{children}</div>
  </div>
);

const SelectControl = ({
  children,
  ctx,
  id,
  name,
  placeholder,
}: {
  children?: ReactNode;
  ctx: ChoiceCtx;
  id: string;
  name: string;
  placeholder: string | undefined;
}): ReactElement => {
  const sel = flattenChildren(children).find(isCheckedChoice);
  const selValue = nonEmpty(sel?.props.value) ? sel.props.value : "";
  return (
    <select className={CONTROL_CLS} defaultValue={selValue} id={id} name={name}>
      {nonEmpty(placeholder) ? (
        <option disabled value="">
          {placeholder}
        </option>
      ) : null}
      <ChoiceMode.Provider value={ctx}>{children}</ChoiceMode.Provider>
    </select>
  );
};

const FieldControl = ({
  children,
  ctx,
  id,
  name,
  placeholder,
  rows,
  t,
  value,
}: {
  children?: ReactNode;
  ctx: ChoiceCtx;
  id: string;
  name: string;
  placeholder: string | undefined;
  rows: string | undefined;
  t: QuestionType;
  value: string | undefined;
}): ReactElement => {
  if (t === "textarea") {
    return (
      <textarea
        className={CONTROL_CLS}
        defaultValue={nonEmpty(value) ? value : undefined}
        id={id}
        name={name}
        placeholder={nonEmpty(placeholder) ? placeholder : undefined}
        rows={Number(rows) || 3}
      />
    );
  }
  if (t === "select") {
    return (
      <SelectControl ctx={ctx} id={id} name={name} placeholder={placeholder}>
        {children}
      </SelectControl>
    );
  }
  return (
    <input
      className={CONTROL_CLS}
      defaultValue={nonEmpty(value) ? value : undefined}
      id={id}
      name={name}
      placeholder={nonEmpty(placeholder) ? placeholder : undefined}
      type="text"
    />
  );
};

/**
 * One question inside `<Ask>`. `name` is the answer key; the Markdown answer
 * sheet shows `label` (falling back to `name`). Types: `choice` (radio
 * cards), `multi` (checkbox cards), `select` (dropdown), `text`, `textarea`,
 * `toggle` (switch). Defaults to `choice` when it has <Choice> children,
 * otherwise `text`.
 */
export const Question = defineComponent(
  {
    description:
      "<Ask> 内の質問。name は回答キー。type は choice|multi|select|text|textarea|toggle (省略時は <Choice> があれば choice、なければ text)",
    schema: v.looseObject({
      checked: v.optional(v.union([v.boolean(), v.string()])),
      description: v.optional(v.string()),
      label: v.optional(v.string()),
      name: v.string(),
      placeholder: v.optional(v.string()),
      required: v.optional(v.union([v.boolean(), v.string()])),
      rows: v.optional(v.string()),
      type: v.optional(v.picklist(QUESTION_TYPES)),
      value: v.optional(v.string()),
    }),
  },
  ({
    name,
    type,
    label,
    required,
    placeholder,
    value,
    description,
    rows,
    checked,
    children,
  }) => {
    const t: QuestionType =
      type ?? (flattenChildren(children).length > 0 ? "choice" : "text");
    const ctx = useMemo(() => ({ mode: CHOICE_MODE[t], name }), [t, name]);
    // Resolved label + type ride on the wrapper so the client handler can
    // pair every control with the text the reader saw (Markdown sheet).
    const labelText = nonEmpty(label) ? label : name;
    const chrome: QuestionChrome = {
      descEl: nonEmpty(description) ? (
        <p className="mt-0.5 text-xs font-normal text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      ) : null,
      id: `mdxr-q-${name}`,
      labelEl: (
        <>
          {labelText}
          {truthy(required) ? (
            <span className="ml-0.5 text-red-500">*</span>
          ) : null}
        </>
      ),
      qAttrs: {
        "data-mdxr-q": "",
        "data-q-label": labelText,
        "data-q-type": t,
      } as const,
    };

    if (t === "choice" || t === "multi") {
      return (
        <ChoiceField chrome={chrome} ctx={ctx}>
          {children}
        </ChoiceField>
      );
    }
    if (t === "toggle") {
      return <ToggleField checked={checked} chrome={chrome} name={name} />;
    }
    return (
      <FieldFrame chrome={chrome}>
        <FieldControl
          ctx={ctx}
          id={chrome.id}
          name={name}
          placeholder={placeholder}
          rows={rows}
          t={t}
          value={value}
        >
          {children}
        </FieldControl>
      </FieldFrame>
    );
  }
);

/**
 * A block of questions asking the reader for input — e.g. open decisions in
 * a plan. Built on native form controls so it is interactive in static HTML.
 * Answers are rendered live as a Markdown sheet (`- **label**: answer` lines
 * under `# title`) in the output pane; "Copy answers" copies it to the
 * clipboard and "Save .md" downloads it (nothing is submitted anywhere).
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
      className="mdxr-ask not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      data-ask
      data-ask-title={nonEmpty(title) ? title : undefined}
    >
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <Icon className="h-3.5 w-3.5" name="lucide:list-checks" />
          {nonEmpty(title) ? title : "Questions"}
        </div>
        {nonEmpty(description) ? (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
        {children}
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 px-4 pt-2.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
          <Icon className="h-3 w-3" name="lucide:file-text" />
          Markdown
        </div>
        <pre
          className="m-0 max-h-64 overflow-auto px-4 pt-1 pb-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-neutral-600 dark:text-neutral-300"
          data-ask-output
        >
          (answers appear here as Markdown)
        </pre>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          Updates live as you answer — copy or save it.
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-all hover:bg-neutral-100 active:translate-y-px dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            data-ask-copy
            type="button"
          >
            <span className="mdxr-copy-idle inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" name="lucide:clipboard-list" />
              Copy answers
            </span>
            <span className="mdxr-copy-done hidden items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Icon className="h-3.5 w-3.5" name="lucide:check" />
              Copied
            </span>
          </button>
          <button
            className="inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-all hover:bg-neutral-100 active:translate-y-px dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            data-ask-save
            type="button"
          >
            <span className="mdxr-copy-idle inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" name="lucide:download" />
              Save .md
            </span>
            <span className="mdxr-copy-done hidden items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Icon className="h-3.5 w-3.5" name="lucide:check" />
              Saved
            </span>
          </button>
        </div>
      </div>
    </section>
  )
);
