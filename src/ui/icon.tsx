import { icons as lucide } from "@iconify-json/lucide";
import { addCollection, Icon as IconifyIcon, iconLoaded } from "@iconify/react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";

// Bundled icon sets, registered once so names resolve synchronously during
// static rendering (no runtime fetch — the Iconify API is never used).
addCollection(lucide);

const DEFAULT_PREFIX = "lucide";

/** Normalize `name` to `prefix:name`; bare names use the lucide set. */
export const normalizeIconName = (name: string): string =>
  name.includes(":") ? name : `${DEFAULT_PREFIX}:${name}`;

/** True when `name` resolves to a registered icon. */
export const hasIcon = (name: unknown): name is string =>
  typeof name === "string" && iconLoaded(normalizeIconName(name));

export const Icon = defineComponent(
  {
    description:
      'Iconify アイコン (lucide セット同梱)。name="lucide:rocket"（"rocket" でも可）。label で意味を持つ画像、省略時は装飾 (aria-hidden)。className でサイズ/色を指定',
    schema: v.looseObject({
      className: v.optional(v.string()),
      label: v.optional(v.string()),
      name: v.pipe(
        v.string(),
        v.check(
          (n) => iconLoaded(normalizeIconName(n)),
          (i) => `unknown icon: ${i.input}`
        )
      ),
    }),
  },
  ({ name, label, className }) => (
    <IconifyIcon
      ssr
      aria-hidden={!nonEmpty(label)}
      aria-label={nonEmpty(label) ? label : undefined}
      className={className}
      icon={normalizeIconName(name)}
      inline
    />
  )
);
