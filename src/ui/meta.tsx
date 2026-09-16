import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { hasIcon, Icon, normalizeIconName } from "./icon.js";

export const MetaItem = defineComponent(
  {
    description:
      '<Meta> 内の1項目。label と内容を並べる。icon にアイコン名 (例: "lucide:tag") を付けられる',
    schema: v.looseObject({
      icon: v.optional(
        v.pipe(
          v.string(),
          v.check(
            (n) => hasIcon(n),
            (i) => `unknown icon: ${i.input}`
          )
        )
      ),
      label: v.optional(v.string()),
    }),
  },
  ({ label, icon, children }) => (
    <span className="inline-flex items-baseline gap-1">
      {icon === undefined ? null : (
        <Icon
          className="h-3.5 w-3.5 self-center text-neutral-400 dark:text-neutral-500"
          name={normalizeIconName(icon)}
        />
      )}
      {nonEmpty(label) ? (
        <span className="text-neutral-400 dark:text-neutral-500">{label}:</span>
      ) : null}
      <span className="font-medium text-neutral-600 dark:text-neutral-300">
        {children}
      </span>
    </span>
  )
);

const SHORTHAND: [string, "date" | "owner" | "version" | "updated", string][] =
  [
    ["Date", "date", "lucide:calendar"],
    ["Owner", "owner", "lucide:user"],
    ["Version", "version", "lucide:tag"],
    ["Updated", "updated", "lucide:history"],
  ];

export const Meta = defineComponent(
  {
    description:
      "文書メタ情報の行。date/owner/version/updated 属性か <MetaItem> を子に取る",
    schema: v.looseObject({
      date: v.optional(v.string()),
      owner: v.optional(v.string()),
      updated: v.optional(v.string()),
      version: v.optional(v.string()),
    }),
  },
  ({ date, owner, version, updated, children }) => {
    const values = { date, owner, updated, version };
    return (
      <div className="not-prose my-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {SHORTHAND.map(([label, key, icon]) =>
          nonEmpty(values[key]) ? (
            <MetaItem icon={icon} key={key} label={label}>
              {values[key]}
            </MetaItem>
          ) : null
        )}
        {children}
      </div>
    );
  }
);
