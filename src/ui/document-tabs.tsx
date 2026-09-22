import { isValidElement, useId, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { display, keyed, recordKey } from "../extended/data.js";
import { fenceFilename } from "../lines.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { CopyButton } from "./bits.js";
import { rowsFrom } from "./data-children.js";
import { useHydrated } from "./data-context.js";
import { DATA_BUTTON, DATA_PROPS } from "./data-props.js";
import { DataPanel } from "./data-view.js";

const selections = new Map<string, string>();
const eventName = "mdxr-tab-selection";
const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener(eventName, listener);
  };
};
const serverSelection = (): string => "";
interface TabEntry {
  label: string;
  body: ReactNode;
}

const tabsOf = (children: ReactNode): TabEntry[] =>
  flattenChildren(children).flatMap((node, index) => {
    if (
      !isValidElement<{
        label?: string;
        title?: string;
        children?: ReactNode;
        meta?: string;
      }>(node)
    ) {
      return [];
    }
    const code = flattenChildren(node.props.children).find(
      (child) => isValidElement(child) && child.type === "code"
    );
    const codeProps = isValidElement<{ className?: string; meta?: string }>(
      code
    )
      ? code.props
      : {};
    const lang = /language-(?<language>[^\s]+)/u.exec(
      codeProps.className ?? ""
    )?.[1];
    const label =
      node.props.label ??
      node.props.title ??
      fenceFilename(node.props.meta ?? codeProps.meta ?? "") ??
      lang ??
      `Tab ${index + 1}`;
    return [{ body: node, label }];
  });

const TabView = ({
  entries,
  title,
  syncKey,
}: {
  entries: TabEntry[];
  title?: string;
  syncKey?: string;
}) => {
  const id = useId();
  const hydrated = useHydrated();
  const key = syncKey ?? id;
  const selected = useSyncExternalStore(
    subscribe,
    () => selections.get(key) ?? "",
    serverSelection
  );
  const active = Math.max(
    0,
    entries.findIndex((entry) => entry.label === selected)
  );
  const activate = (index: number): void => {
    const entry = entries[index];
    if (!(entry !== undefined)) {
      return;
    }
    selections.set(key, entry.label);
    window.dispatchEvent(new Event(eventName));
  };
  return (
    <DataPanel title={title}>
      <div
        className="flex gap-1 overflow-x-auto border-b border-neutral-200 p-2 dark:border-neutral-700"
        role="tablist"
        aria-label={title ?? "Content variants"}
      >
        {keyed(entries, (entry) => entry.label).map(
          ({ key: entryKey, value: entry }, index) => (
            <button
              className={`${DATA_BUTTON} ${active === index ? "bg-sky-100 dark:bg-sky-950" : ""}`}
              id={`${id}-tab-${index}`}
              type="button"
              role="tab"
              key={entryKey}
              aria-selected={active === index}
              aria-controls={`${id}-panel-${index}`}
              tabIndex={active === index ? 0 : -1}
              onClick={() => {
                activate(index);
              }}
              onKeyDown={(event) => {
                const moves: Record<string, number> = {
                  ArrowLeft: (index + entries.length - 1) % entries.length,
                  ArrowRight: (index + 1) % entries.length,
                  End: entries.length - 1,
                  Home: 0,
                };
                const next = moves[event.key];
                if (next === undefined) {
                  return;
                }
                event.preventDefault();
                activate(next);
                document
                  .querySelector<HTMLElement>(
                    `#${CSS.escape(`${id}-tab-${next}`)}`
                  )
                  ?.focus();
              }}
            >
              {entry.label}
            </button>
          )
        )}
      </div>
      {keyed(entries, (entry) => entry.label).map(
        ({ key: entryKey, value: entry }, index) => (
          <div
            key={entryKey}
            className={`mdxr-tab-panel px-3 ${hydrated && active !== index ? "hidden print:block" : ""}`}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            tabIndex={0}
          >
            {entry.body}
          </div>
        )
      )}
    </DataPanel>
  );
};

const tabsSchema = v.looseObject({
  syncKey: v.optional(v.string()),
  title: v.optional(v.string()),
});
export const CodeGroup = defineComponent(
  {
    description:
      "Code fences become accessible tabs labelled from title metadata or language; syncKey synchronizes groups.",
    schema: tabsSchema,
  },
  ({ title, syncKey, children }) => (
    <TabView title={title} syncKey={syncKey} entries={tabsOf(children)} />
  )
);
export const SyncedTabs = defineComponent(
  {
    description:
      "Synchronized document tabs made of TabItem children; selection is shared by syncKey.",
    schema: tabsSchema,
  },
  ({ title, syncKey, children }) => (
    <TabView title={title} syncKey={syncKey} entries={tabsOf(children)} />
  )
);
export const TabItem = defineComponent(
  {
    description: "Named tab body inside SyncedTabs or CodeGroup.",
    schema: v.looseObject({ label: v.string() }),
  },
  ({ children }) => <div className="contents">{children}</div>
);
export const PackageInstall = defineComponent(
  {
    description:
      "npm/pnpm/yarn/bun installation commands with synchronized package-manager selection.",
    schema: v.looseObject({
      dev: BOOLISH_PROP,
      packages: v.string(),
      syncKey: v.optional(v.string(), "package-manager"),
      title: v.optional(v.string(), "Install"),
    }),
  },
  ({ packages, dev, title, syncKey }) => {
    if (!/^[@\w./+~^*\s:-]+$/u.test(packages)) {
      throw new Error(
        "PackageInstall: packages must be package names/version specifications"
      );
    }
    const entries = ["npm", "pnpm", "yarn", "bun"].map((manager) => {
      const command = `${manager} ${manager === "npm" ? "install" : "add"}${attrTrue(dev) ? " -D" : ""} ${packages}`;
      return {
        body: (
          <div className="flex items-center justify-between gap-3 p-3">
            <code>{command}</code>
            <CopyButton copy={command} title="Copy install command" />
          </div>
        ),
        label: manager,
      };
    });
    return <TabView title={title} syncKey={syncKey} entries={entries} />;
  }
);

export const CodeWalkthrough = defineComponent(
  {
    description:
      "Step through code explanations; data rows carry title, code, lines and explanation. lines is a comma-separated list of line numbers.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => {
    const rows = rowsFrom(props);
    const [active, setActive] = useState(0);
    const index = Math.min(active, Math.max(0, rows.length - 1));
    const row = rows[index];
    const selected = new Set(display(row?.lines).split(",").map(Number));
    return (
      <DataPanel
        title={props.title ?? "Code walkthrough"}
        summary={`${rows.length ? index + 1 : 0} / ${rows.length}`}
      >
        <div className="flex flex-wrap gap-2 p-3">
          {keyed(rows, recordKey).map(({ key: entryKey, value: step }, i) => (
            <button
              key={entryKey}
              className={DATA_BUTTON}
              aria-pressed={index === i}
              type="button"
              onClick={() => {
                setActive(i);
              }}
            >
              {display(step.title) || `Step ${i + 1}`}
            </button>
          ))}
        </div>
        <div className="px-4 pb-4">
          <output className="mb-3">{display(row?.explanation)}</output>
          <pre className="overflow-auto rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-950">
            <code>
              {keyed(display(row?.code).split("\n")).map(
                ({ key: entryKey, value }, i) => (
                  <span
                    key={entryKey}
                    className={`block ${selected.has(i + 1) ? "bg-amber-100 dark:bg-amber-950" : ""}`}
                  >
                    <span className="mr-4 inline-block w-6 text-right text-neutral-500">
                      {i + 1}
                    </span>
                    {value}
                    {"\n"}
                  </span>
                )
              )}
            </code>
          </pre>
        </div>
        <div className="flex gap-2 p-3">
          <button
            type="button"
            className={DATA_BUTTON}
            disabled={index === 0}
            onClick={() => {
              setActive(index - 1);
            }}
          >
            Previous step
          </button>
          <button
            type="button"
            className={DATA_BUTTON}
            disabled={index + 1 >= rows.length}
            onClick={() => {
              setActive(index + 1);
            }}
          >
            Next step
          </button>
        </div>
        {props.data !== undefined && props.data !== "" ? props.children : null}
      </DataPanel>
    );
  }
);

const httpSchema = v.looseObject({
  body: v.optional(v.string()),
  headers: v.optional(v.string()),
  method: v.optional(v.string()),
  path: v.optional(v.string()),
  status: v.optional(v.string()),
  title: v.optional(v.string()),
});
const httpPart = (name: string) =>
  defineComponent(
    {
      description: `${name} with HTTP metadata, headers, body and Markdown description.`,
      schema: httpSchema,
    },
    ({ title, method, path, status, headers, body, children }) => (
      <DataPanel
        title={title ?? [name, method, path, status].filter(Boolean).join(" ")}
      >
        <div className="p-4">
          {headers !== undefined && headers !== "" ? (
            <pre className="overflow-auto text-sm">{headers}</pre>
          ) : null}
          {body !== undefined && body !== "" ? (
            <pre className="my-3 overflow-auto rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-950">
              {body}
            </pre>
          ) : null}
          {children}
        </div>
      </DataPanel>
    )
  );
export const Request = httpPart("Request");
export const Response = httpPart("Response");
export const ApiExample = defineComponent(
  {
    description:
      "Side-by-side HTTP Request and Response, with headers, payloads and Markdown notes.",
    schema: v.looseObject({ title: v.optional(v.string()) }),
  },
  ({ title, children }) => (
    <DataPanel title={title ?? "API exchange"}>
      <div className="grid gap-4 px-4 md:grid-cols-2">{children}</div>
    </DataPanel>
  )
);

export const Conversation = defineComponent(
  {
    description:
      "Role-labelled conversation transcript with timestamps and attachments; records use role, content, time and attachment.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => (
    <DataPanel title={props.title ?? "Conversation"} id={props.id}>
      <ol className="space-y-3 p-4">
        {keyed(rowsFrom(props), recordKey).map(
          ({ key: entryKey, value: row }) => (
            <li
              key={entryKey}
              className={`max-w-full rounded-xl border border-neutral-200 p-3 md:max-w-[90%] dark:border-neutral-700 ${row.role === "user" ? "ml-auto bg-sky-50 dark:bg-sky-950" : "bg-neutral-50 dark:bg-neutral-800"}`}
            >
              <div className="mb-2 flex justify-between gap-4 text-xs">
                <strong>{display(row.role)}</strong>
                <span>{display(row.time)}</span>
              </div>
              <div className="whitespace-pre-wrap">{display(row.content)}</div>
              {row.attachment !== undefined && row.attachment !== null ? (
                <p className="mt-2 text-xs">
                  Attachment: {display(row.attachment)}
                </p>
              ) : null}
            </li>
          )
        )}
      </ol>
    </DataPanel>
  )
);
