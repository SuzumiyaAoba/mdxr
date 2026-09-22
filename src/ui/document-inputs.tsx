import { useId, useRef, useState } from "react";
import * as v from "valibot";

import { formatAnswerSheet } from "../ask-sheet.js";
import { defineComponent } from "../define.js";
import { calculate } from "../extended/calculator.js";
import type { DataRecord } from "../extended/data.js";
import {
  display,
  keyed,
  recordKey,
  numberValue,
  parseJson,
  uniqueIds,
  words,
  isDataRecord as isRecord,
} from "../extended/data.js";
import { own } from "../guards.js";
import { attrTrue } from "./attrs.js";
import { CopyButton } from "./bits.js";
import { rowsFrom } from "./data-children.js";
import { downloadText } from "./data-download.js";
import { DATA_BUTTON, DATA_INPUT, DATA_PROPS } from "./data-props.js";
import { DataPanel } from "./data-view.js";

const OutputSheet = ({
  text,
  filename = "answers.md",
}: {
  text: string;
  filename?: string;
}) => (
  <div className="border-t border-neutral-200 p-4 dark:border-neutral-700">
    <pre
      className="max-h-72 overflow-auto text-xs whitespace-pre-wrap"
      aria-live="polite"
    >
      {text}
    </pre>
    <div className="mt-3 flex gap-3">
      <CopyButton copy={text} title="Copy result" />
      <button
        type="button"
        className={DATA_BUTTON}
        onClick={() => {
          downloadText(text, filename);
        }}
      >
        Save result
      </button>
    </div>
  </div>
);

export const Checklist = defineComponent(
  {
    description:
      "Interactive checklist with live progress and Markdown export. Data rows: id, label, checked, owner, due.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => {
    const rows = rowsFrom(props);
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const isChecked = (row: DataRecord, i: number): boolean =>
      own(checked, display(row.id) || String(i)) ??
      (row.checked === true || row.checked === "true");
    const done = rows.filter(isChecked).length;
    const output = rows
      .map(
        (row, i) =>
          `- [${isChecked(row, i) ? "x" : " "}] ${display(row.label ?? row.name)}${row.owner !== undefined && row.owner !== null ? ` (@${display(row.owner)})` : ""}`
      )
      .join("\n");
    return (
      <DataPanel
        title={props.title ?? "Checklist"}
        id={props.id}
        summary={`${done} / ${rows.length} completed`}
      >
        <div className="px-4 pt-3">
          <progress
            className="w-full"
            value={done}
            max={Math.max(1, rows.length)}
            aria-label="Checklist progress"
          />
        </div>
        <ul className="space-y-2 p-4">
          {keyed(rows, recordKey).map(({ key, value: row }, i) => (
            <li key={key}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isChecked(row, i)}
                  onChange={(event) => {
                    setChecked({
                      ...checked,
                      [display(row.id) || String(i)]: event.target.checked,
                    });
                  }}
                />
                <span>
                  {display(row.label ?? row.name)}
                  <span className="ml-3 text-xs text-neutral-500">
                    {[row.owner, row.due]
                      .map(display)
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <OutputSheet text={output} filename="checklist.md" />
      </DataPanel>
    );
  }
);

export const Ranking = defineComponent(
  {
    description:
      "Rank choices by drag-and-drop or keyboard-accessible move buttons; exports Markdown.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => {
    const original = rowsFrom(props);
    const [order, setOrder] = useState<number[]>(() =>
      original.map((_, i) => i)
    );
    const move = (from: number, to: number): void => {
      if (
        from < 0 ||
        to < 0 ||
        from >= order.length ||
        to >= order.length ||
        from === to
      ) {
        return;
      }
      const next = [...order];
      const [item] = next.splice(from, 1);
      if (item !== undefined) {
        next.splice(to, 0, item);
      }
      setOrder(next);
    };
    const output = order
      .map(
        (index, rank) =>
          `${rank + 1}. ${display(original[index]?.label ?? original[index]?.name)}`
      )
      .join("\n");
    return (
      <DataPanel title={props.title ?? "Ranking"} id={props.id}>
        <ol className="space-y-2 p-4">
          {order.map((index, rank) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-6 text-right tabular-nums">{rank + 1}.</span>
              <button
                type="button"
                draggable
                className={`${DATA_BUTTON} flex-1 text-left`}
                aria-label={`Drag ${display(original[index]?.label ?? original[index]?.name)}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/mdxr-rank", String(rank));
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = event.dataTransfer.getData("text/mdxr-rank");
                  if (/^\d+$/u.test(from)) {
                    move(Number(from), rank);
                  }
                }}
              >
                {display(original[index]?.label ?? original[index]?.name)}
              </button>
              <button
                className={DATA_BUTTON}
                type="button"
                disabled={rank === 0}
                aria-label={`Move ${display(original[index]?.label ?? original[index]?.name)} up`}
                onClick={() => {
                  move(rank, rank - 1);
                }}
              >
                ↑
              </button>
              <button
                className={DATA_BUTTON}
                type="button"
                disabled={rank === order.length - 1}
                aria-label={`Move ${display(original[index]?.label ?? original[index]?.name)} down`}
                onClick={() => {
                  move(rank, rank + 1);
                }}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
        <OutputSheet text={output} filename="ranking.md" />
      </DataPanel>
    );
  }
);

export const Calculator = defineComponent(
  {
    description:
      "Numeric calculator with fixed operations sum/product/min/max/weighted/ratio; row fields: name,label,value,weight,min,max.",
    schema: v.looseObject({
      ...DATA_PROPS,
      operation: v.optional(
        v.picklist(["sum", "product", "min", "max", "weighted", "ratio"]),
        "sum"
      ),
      unit: v.optional(v.string()),
    }),
  },
  (props) => {
    const rows = rowsFrom(props);
    uniqueIds(rows, "name");
    const [values, setValues] = useState<Record<string, string>>({});
    const inputs = rows.map(
      (row) => own(values, display(row.name)) ?? display(row.value ?? 0)
    );
    const valid = inputs.every(
      (input, i) =>
        input.trim() !== "" &&
        Number.isFinite(Number(input)) &&
        (rows[i]?.min === undefined ||
          Number(input) >= numberValue(rows[i]?.min)) &&
        (rows[i]?.max === undefined ||
          Number(input) <= numberValue(rows[i]?.max))
    );
    const result = valid
      ? calculate(
          props.operation,
          inputs.map(Number),
          rows.map((row) => numberValue(row.weight, "weight", 1))
        )
      : undefined;
    return (
      <DataPanel title={props.title ?? "Calculator"} id={props.id}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {keyed(rows, recordKey).map(({ key, value: row }, i) => (
            <label key={key} className="grid gap-1 text-sm">
              {display(row.label ?? row.name)}
              <input
                className={DATA_INPUT}
                type="number"
                step="any"
                min={row.min === undefined ? undefined : numberValue(row.min)}
                max={row.max === undefined ? undefined : numberValue(row.max)}
                value={inputs[i]}
                onChange={(event) => {
                  setValues({
                    ...values,
                    [display(row.name)]: event.target.value,
                  });
                }}
              />
            </label>
          ))}
        </div>
        <output
          className="block px-4 pb-4 text-2xl font-semibold"
          aria-live="polite"
        >
          {result === undefined || !Number.isFinite(result)
            ? "Enter valid values (ratio requires a nonzero divisor)."
            : `${Number(result.toPrecision(10))}${props.unit !== undefined && props.unit !== "" ? ` ${props.unit}` : ""}`}
        </output>
      </DataPanel>
    );
  }
);

const renderWizardControl = (
  row: DataRecord,
  value: string,
  onChange: (value: string) => void,
  choices: string[]
) => {
  if (choices.length) {
    return (
      <select
        required={attrTrue(row.required)}
        aria-label={display(row.label ?? row.name)}
        className={DATA_INPUT}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">Choose…</option>
        {choices.map((choice) => (
          <option key={choice}>{choice}</option>
        ))}
      </select>
    );
  }
  if (row.type === "textarea") {
    return (
      <textarea
        required={attrTrue(row.required)}
        aria-label={display(row.label ?? row.name)}
        className={DATA_INPUT}
        value={value}
        rows={4}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    );
  }
  return (
    <input
      required={attrTrue(row.required)}
      aria-label={display(row.label ?? row.name)}
      className={DATA_INPUT}
      type={row.type === "number" ? "number" : "text"}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
};

const WizardField = ({
  row,
  value,
  onChange,
}: {
  row: DataRecord;
  value: string;
  onChange: (value: string) => void;
}) => {
  const label = display(row.label ?? row.name);
  const choices = words(row.options);
  const control = renderWizardControl(row, value, onChange, choices);
  return (
    <label className="grid gap-2 text-sm">
      {label}
      {control}
      {row.description !== undefined && row.description !== null ? (
        <span className="text-neutral-500">{display(row.description)}</span>
      ) : null}
    </label>
  );
};

export const Wizard = defineComponent(
  {
    description:
      "Step-by-step questionnaire. Rows: name,label,type,options,required,when. when is an object of earlier answers required to show a step.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => {
    const rows = rowsFrom(props);
    uniqueIds(rows, "name");
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [step, setStep] = useState(0);
    const active = rows.filter(
      (row) =>
        !isRecord(row.when) ||
        Object.entries(row.when).every(
          ([key, value]) => own(answers, key) === display(value)
        )
    );
    const index = Math.min(step, Math.max(0, active.length - 1));
    const current = active[index];
    const output = formatAnswerSheet(
      props.title,
      active.map((row) => ({
        answer: own(answers, display(row.name)) ?? "",
        label: display(row.label ?? row.name),
      }))
    );
    return (
      <DataPanel
        title={props.title ?? "Questionnaire"}
        id={props.id}
        summary={`${active.length ? index + 1 : 0} / ${active.length}`}
      >
        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setStep(Math.min(index + 1, active.length - 1));
          }}
        >
          {current === undefined ? (
            <p>No applicable questions</p>
          ) : (
            <WizardField
              row={current}
              value={own(answers, display(current.name)) ?? ""}
              onChange={(value) => {
                setAnswers({ ...answers, [display(current.name)]: value });
              }}
            />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className={DATA_BUTTON}
              disabled={index === 0}
              onClick={() => {
                setStep(index - 1);
              }}
            >
              Back
            </button>
            <button
              type="submit"
              className={DATA_BUTTON}
              disabled={index + 1 >= active.length}
            >
              Next
            </button>
          </div>
        </form>
        <OutputSheet text={output} />
      </DataPanel>
    );
  }
);

const questionControls = (
  element: Element
): (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[] =>
  [...element.querySelectorAll("input,select,textarea")].filter(
    (
      control
    ): control is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
  );
const readAnswer = (element: HTMLElement): unknown => {
  const controls = questionControls(element);
  const type = element.dataset.qType;
  if (type === "toggle") {
    return controls.some(
      (control) => control instanceof HTMLInputElement && control.checked
    );
  }
  if (type === "multi") {
    return controls
      .filter(
        (control) => control instanceof HTMLInputElement && control.checked
      )
      .map((control) => control.value);
  }
  if (type === "choice") {
    return (
      controls.find(
        (control) => control instanceof HTMLInputElement && control.checked
      )?.value ?? ""
    );
  }
  return controls[0]?.value ?? "";
};
const applyAnswer = (element: HTMLElement, value: unknown): void => {
  const type = element.dataset.qType;
  const selected = new Set(Array.isArray(value) ? value : []);
  for (const control of questionControls(element)) {
    if (
      control instanceof HTMLInputElement &&
      (control.type === "checkbox" || control.type === "radio")
    ) {
      let checked = control.value === value;
      if (Array.isArray(value)) {
        checked = selected.has(control.value);
      }
      if (type === "toggle") {
        checked = value === true;
      }
      control.checked = checked;
    } else {
      control.value = display(value);
    }
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
};

const keyOf = (element: HTMLElement): string =>
  element.dataset.qName ?? element.dataset.qLabel ?? "";

export const AnswerSheet = defineComponent(
  {
    description:
      "Wrap Ask forms to export/import typed answers as JSON using stable question names; also retains Ask Markdown export.",
    schema: v.looseObject({
      filename: v.optional(v.string(), "answers.json"),
      title: v.optional(v.string()),
    }),
  },
  ({ title, filename, children }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [importError, setImportError] = useState("");
    const questions = (): HTMLElement[] => [
      ...(ref.current?.querySelectorAll<HTMLElement>("[data-mdxr-q]") ?? []),
    ];
    const importAnswers = async (file: File): Promise<void> => {
      try {
        const values: unknown = parseJson(await file.text(), "answers");
        if (!isRecord(values)) {
          throw new Error("Answers must be a JSON object");
        }
        for (const question of questions()) {
          const key = keyOf(question);
          if (Object.hasOwn(values, key)) {
            applyAnswer(question, values[key]);
          }
        }
        setImportError("");
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Unable to import answers"
        );
      }
    };
    return (
      <DataPanel title={title ?? "Answer sheet"}>
        <div className="flex flex-wrap items-center gap-3 p-3">
          <button
            className={DATA_BUTTON}
            type="button"
            onClick={() => {
              downloadText(
                JSON.stringify(
                  Object.fromEntries(
                    questions().map((question) => [
                      keyOf(question),
                      readAnswer(question),
                    ])
                  ),
                  null,
                  2
                ),
                filename,
                "application/json"
              );
            }}
          >
            Export answers JSON
          </button>
          <label className="grid gap-1 text-sm">
            Import answers
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importAnswers(file);
                }
              }}
            />
          </label>
        </div>
        {importError ? (
          <p role="alert" className="px-4 text-red-700">
            {importError}
          </p>
        ) : null}
        <div ref={ref}>{children}</div>
      </DataPanel>
    );
  }
);

export const PromptTemplate = defineComponent(
  {
    description:
      "Prompt with {{name}} variables and typed field descriptions/defaults. data rows: name,label,value,description.",
    schema: v.looseObject({ ...DATA_PROPS, template: v.string() }),
  },
  (props) => {
    const fields = rowsFrom(props);
    uniqueIds(fields, "name");
    const [values, setValues] = useState<Record<string, string>>({});
    const defaults = Object.fromEntries(
      fields.map((field) => [display(field.name), display(field.value)])
    );
    const output = props.template.replaceAll(
      /\{\{\s*(?<variable>[\w.-]+)\s*\}\}/gu,
      (match: string, name: string) =>
        own(values, name) ?? own(defaults, name) ?? match
    );
    return (
      <DataPanel title={props.title ?? "Prompt template"} id={props.id}>
        <div className="grid gap-3 p-4">
          {fields.map((field) => (
            <label key={display(field.name)} className="grid gap-1 text-sm">
              {display(field.label ?? field.name)}
              <textarea
                className={DATA_INPUT}
                rows={2}
                aria-label={display(field.label ?? field.name)}
                value={own(values, display(field.name)) ?? display(field.value)}
                onChange={(event) => {
                  setValues({
                    ...values,
                    [display(field.name)]: event.target.value,
                  });
                }}
              />
              <span className="text-neutral-500">
                {display(field.description)}
              </span>
            </label>
          ))}
        </div>
        <OutputSheet text={output} filename="prompt.txt" />
      </DataPanel>
    );
  }
);

interface SearchResult {
  id: string;
  label: string;
  excerpt: string;
}
export const DocumentSearch = defineComponent(
  {
    description:
      "Search document headings, prose and code; highlights and focuses matches without sending data anywhere.",
    schema: v.looseObject({ title: v.optional(v.string(), "Search document") }),
  },
  ({ title }) => {
    const id = useId();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const update = (value: string): void => {
      setQuery(value);
      if (!value.trim()) {
        setResults([]);
        return;
      }
      const matches: SearchResult[] = [];
      const root = document.querySelector("#mdxr-root") ?? document.body;
      for (const [index, element] of [
        ...root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,pre,td"),
      ].entries()) {
        if (element.closest("[data-document-search]")) {
          continue;
        }
        const content = element.textContent ?? "";
        const found = content.toLowerCase().indexOf(value.toLowerCase());
        if (found === -1) {
          continue;
        }
        element.id ||= `mdxr-search-${index}`;
        matches.push({
          excerpt: content.slice(
            Math.max(0, found - 40),
            found + value.length + 80
          ),
          id: element.id,
          label: content.slice(0, 80),
        });
        if (matches.length >= 100) {
          break;
        }
      }
      setResults(matches);
    };
    return (
      <div data-document-search="">
        <DataPanel title={title}>
          <div className="p-4">
            <label htmlFor={id} className="mb-2 block text-sm">
              Search text
            </label>
            <input
              className={`${DATA_INPUT} w-full`}
              id={id}
              type="search"
              value={query}
              onChange={(event) => {
                update(event.target.value);
              }}
            />
            <output className="my-2 text-sm">{results.length} matches</output>
            <ul className="space-y-2">
              {results.map((result) => (
                <li key={result.id}>
                  <a
                    href={`#${result.id}`}
                    className="block rounded-md border border-neutral-200 p-2 text-sm dark:border-neutral-700"
                    onClick={() => {
                      const target = document.querySelector<HTMLElement>(
                        `#${CSS.escape(result.id)}`
                      );
                      if (target) {
                        target.tabIndex = -1;
                        target.focus({ preventScroll: true });
                        if (
                          !window.matchMedia("(prefers-reduced-motion: reduce)")
                            .matches
                        ) {
                          target.animate(
                            [
                              { backgroundColor: "#fde68a" },
                              { backgroundColor: "transparent" },
                            ],
                            { duration: 1400 }
                          );
                        }
                      }
                    }}
                  >
                    <strong>{result.label}</strong>
                    <p>{result.excerpt}</p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </DataPanel>
      </div>
    );
  }
);
