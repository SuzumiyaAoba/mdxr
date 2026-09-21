import { createContext, useContext, useId, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import type { DocProps } from "../define.js";
import { defineComponent, flattenChildren } from "../define.js";
import { asString, nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import { CHIP_BORDER_CLS, TEXT, TONE_TEXT } from "./tones.js";

/**
 * `<Ask>` question internals: the `Choice`/`Question` components plus the
 * field chrome (ChoiceField/ToggleField/FieldFrame/SelectControl/
 * FieldControl) each question type renders through. All native controls —
 * every type stays interactive in static HTML.
 */

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
const truthy = attrTrue;

/** How a <Choice> renders, provided by the enclosing <Question>. */
const ChoiceMode = createContext<{ mode: ChoiceKind; name: string }>({
  mode: "radio",
  name: "",
});

const CONTROL_CLS = `w-full min-w-0 rounded-lg border ${CHIP_BORDER_CLS} bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus-visible:border-neutral-400 focus-visible:ring-3 focus-visible:ring-neutral-200/70 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-800`;

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
      checked: BOOLISH_PROP,
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
      <label
        className={`mdxr-choice flex cursor-pointer items-start gap-2.5 rounded-lg border ${CHIP_BORDER_CLS} px-3 py-2 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60`}
      >
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
            <span
              className={`mdxr-choice-desc mt-0.5 block text-xs ${TEXT.muted}`}
            >
              {description}
            </span>
          ) : null}
        </span>
      </label>
    );
  }
);

const isCheckedChoice = (node: ReactNode): node is ReactElement<DocProps> =>
  isEl<DocProps>(node, Choice) && truthy(propOf(node, "checked"));

/** Label/description/data-attrs chrome shared by every question frame. */
interface QuestionChrome {
  descEl: ReactNode;
  id: string;
  labelEl: ReactNode;
  qAttrs: {
    readonly "data-mdxr-q": "";
    readonly "data-q-label": string;
    readonly "data-q-name": string;
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
  const selValue =
    asString(sel?.props.value) ?? (nonEmpty(placeholder) ? "" : undefined);
  return (
    // Explicitly select the disabled placeholder; without defaultValue the
    // browser selects the first enabled choice and invents an answer.
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
        rows={Math.max(1, Number(rows) || 3)}
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
      checked: BOOLISH_PROP,
      description: v.optional(v.string()),
      label: v.optional(v.string()),
      name: v.string(),
      placeholder: v.optional(v.string()),
      required: BOOLISH_PROP,
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
    // "Has <Choice> children" — not just any child: a stray text/element
    // child under a text question must not flip it into choice mode.
    const t: QuestionType =
      type ??
      (flattenChildren(children).some((c) => isEl(c, Choice))
        ? "choice"
        : "text");
    // Radio inputs sharing `name` form one group — two questions reusing a
    // name would clobber each other's selection. Suffix a useId so the group
    // is per-question (stable across SSR/hydration) rather than per-key.
    const uid = useId();
    const ctx = useMemo(
      () => ({ mode: CHOICE_MODE[t], name: `${name}${uid}` }),
      [t, name, uid]
    );
    // Resolved label + type ride on the wrapper so the client handler can
    // pair every control with the text the reader saw (Markdown sheet).
    const labelText = nonEmpty(label) ? label : name;
    const chrome: QuestionChrome = {
      descEl: nonEmpty(description) ? (
        <p className={`mt-0.5 text-xs font-normal ${TEXT.muted}`}>
          {description}
        </p>
      ) : null,
      id: `mdxr-q${uid}`,
      labelEl: (
        <>
          {labelText}
          {truthy(required) ? (
            <span className={`ml-0.5 ${TONE_TEXT.red}`}>*</span>
          ) : null}
        </>
      ),
      qAttrs: {
        "data-mdxr-q": "",
        "data-q-label": labelText,
        "data-q-name": name,
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
