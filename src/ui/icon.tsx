import { icons as lucide } from "@iconify-json/lucide";
import { icons as vscodeIcons } from "@iconify-json/vscode-icons";
import { addCollection, Icon as IconifyIcon, iconLoaded } from "@iconify/react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";

// Bundled icon sets, registered once so names resolve synchronously during
// static rendering (no runtime fetch — the Iconify API is never used).
addCollection(lucide);
addCollection(vscodeIcons);

/**
 * Every icon name resolved while a document renders. The renderer drains this
 * around each render so the hydration bundle can register exactly the used
 * subset — the full sets are several MB. On the client the set fills but is
 * never read.
 */
const usedIcons = new Set<string>();

/** Drain the recorded icon names (returns them and resets for the next render). */
export const takeUsedIcons = (): string[] => {
  const names = [...usedIcons];
  usedIcons.clear();
  return names;
};

const DEFAULT_PREFIX = "lucide";

/** Normalize `name` to `prefix:name`; bare names use the lucide set. */
export const normalizeIconName = (name: string): string =>
  name.includes(":") ? name : `${DEFAULT_PREFIX}:${name}`;

/** True when `name` resolves to a registered icon. */
export const hasIcon = (name: unknown): name is string => {
  if (typeof name !== "string") {
    return false;
  }
  const normalized = normalizeIconName(name);
  const loaded = iconLoaded(normalized);
  // Record successful probes too: a false on the client must match a false
  // here, and a true result typically ends up rendered via <Icon>.
  if (loaded) {
    usedIcons.add(normalized);
  }
  return loaded;
};

export const Icon = defineComponent(
  {
    description:
      'Iconify アイコン (lucide と vscode-icons 同梱)。name="lucide:rocket"（"rocket" でも可）や "vscode-icons:file-type-typescript"。label で意味を持つ画像、省略時は装飾 (aria-hidden)。className でサイズ/色を指定',
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
  ({ name, label, className }) => {
    const normalized = normalizeIconName(name);
    usedIcons.add(normalized);
    return (
      <IconifyIcon
        ssr
        aria-hidden={!nonEmpty(label)}
        aria-label={nonEmpty(label) ? label : undefined}
        className={className}
        icon={normalized}
        inline
      />
    );
  }
);
