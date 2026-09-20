/** ASCII renderers for report & ops components (reviews, audits, releases). */

import type { RootContent } from "mdast";

import { nonEmpty } from "../guards.js";
import {
  attr,
  els,
  em,
  flag,
  heading,
  icode,
  item,
  link,
  list,
  num,
  para,
  pre,
  quote,
  strong,
  table,
  txt,
  withoutEls,
} from "./ast.js";
import type { AsciiCtx, AsciiRegistry, MdxTarget } from "./ast.js";
import { bar, statusIcon } from "./glyphs.js";
import { caption, statusItem, suffix, tally } from "./parts.js";

const VERDICT_LABEL: Record<string, string> = {
  approve: "Approved",
  changes: "Changes requested",
  comment: "Commented",
  fail: "Failed",
  info: "Note",
  pass: "Passed",
  warn: "Warning",
};

const verdictLabel = (s: string | undefined): string | undefined =>
  s === undefined ? undefined : (VERDICT_LABEL[s.toLowerCase()] ?? s);

/* ------------------------------ checks ------------------------------ */

const DURATION_MS: Record<string, number> = {
  h: 3_600_000,
  m: 60_000,
  ms: 1,
  s: 1000,
};
const DURATION_RE = /^(?<v>\d+(?:\.\d+)?)(?<unit>ms|s|m|h)$/u;

const durationSum = (entries: MdxTarget[]): string | undefined => {
  let ms = 0;
  let seen = false;
  for (const e of entries) {
    const m = DURATION_RE.exec((attr(e, "duration") ?? "").trim());
    if (m?.groups === undefined) {
      continue;
    }
    seen = true;
    ms += Number(m.groups.v) * (DURATION_MS[m.groups.unit] ?? 1);
  }
  if (!seen) {
    return undefined;
  }
  return ms >= 1000 ? `${Math.round(ms / 100) / 10}s` : `${Math.round(ms)}ms`;
};

const checkRow = (node: MdxTarget, ctx: AsciiCtx): ReturnType<typeof item> =>
  statusItem(
    attr(node, "status"),
    [
      ...(nonEmpty(attr(node, "href"))
        ? [link(attr(node, "href") ?? "", [txt(attr(node, "name") ?? "")])]
        : [txt(attr(node, "name") ?? "")]),
      ...(flag(node, "required") ? [txt(" "), icode("required")] : []),
      ...suffix([attr(node, "duration")]),
    ],
    ctx.children(node)
  );

/* ------------------------------- audit ------------------------------ */

const vulnRow = (node: MdxTarget, ctx: AsciiCtx): ReturnType<typeof item> => {
  const sev = attr(node, "severity");
  return item([
    para([
      ...(nonEmpty(sev) ? [icode(sev.toUpperCase()), txt(" ")] : []),
      ...(nonEmpty(attr(node, "id"))
        ? [strong([txt(attr(node, "id") ?? "")])]
        : []),
      ...(nonEmpty(attr(node, "package"))
        ? [txt(" "), icode(attr(node, "package") ?? "")]
        : []),
      ...(nonEmpty(attr(node, "title"))
        ? [txt(` — ${attr(node, "title")}`)]
        : []),
      ...suffix([
        nonEmpty(attr(node, "affected"))
          ? `affected: ${attr(node, "affected")}`
          : undefined,
        nonEmpty(attr(node, "fix")) ? `fix: ${attr(node, "fix")}` : undefined,
        flag(node, "wontfix") ? "wontfix" : undefined,
      ]),
    ]),
    ...ctx.children(node),
  ]);
};

/* ------------------------------- status ------------------------------ */

const DAY_CELL: Record<string, string> = {
  degraded: "▓",
  down: "░",
  maint: "◆",
  none: " ",
  up: "█",
};

const uptimeStrip = (node: MdxTarget): string => {
  const days = els(node, "Day");
  if (days.length === 0) {
    return "";
  }
  return days
    .map((d) => DAY_CELL[(attr(d, "status") ?? "up").toLowerCase()] ?? "█")
    .join("");
};

const serviceRow = (node: MdxTarget): ReturnType<typeof item> =>
  statusItem(
    attr(node, "status"),
    [
      txt(attr(node, "name") ?? ""),
      ...suffix([
        attr(node, "status"),
        nonEmpty(attr(node, "uptime")) ? `${attr(node, "uptime")}%` : undefined,
      ]),
    ],
    []
  );

/* ------------------------------ release ------------------------------ */

const entryRow = (node: MdxTarget, ctx: AsciiCtx): ReturnType<typeof item> => {
  const scope = attr(node, "scope");
  return item([
    para([
      strong([txt(attr(node, "kind") ?? "changed")]),
      ...(nonEmpty(scope) ? [txt(" "), icode(scope)] : []),
      ...(ctx.inline(node).length === 0
        ? []
        : [txt(" — "), ...ctx.inline(node)]),
    ]),
  ]);
};

/* ----------------------------- registry ----------------------------- */

export const reportRenderers: AsciiRegistry = {
  Audit: {
    flow: (n, ctx) => {
      const vulns = els(n, "Vuln");
      return [
        ...caption(
          attr(n, "title"),
          `${nonEmpty(attr(n, "tool")) ? ` — ${attr(n, "tool")}` : ""}${tally(vulns, "severity")}`
        ),
        list(vulns.map((v) => vulnRow(v, ctx))),
        ...ctx.children(withoutEls(n, ["Vuln"])),
      ];
    },
  },
  Bench: {
    flow: (n) => [
      para([
        strong([txt(attr(n, "name") ?? "")]),
        txt(` ${attr(n, "before") ?? ""} → ${attr(n, "after") ?? ""}`),
        ...suffix([attr(n, "unit"), attr(n, "note")]),
      ]),
    ],
  },
  Benchmarks: {
    flow: (n, ctx) => {
      const unit = attr(n, "unit") ?? "";
      const lower = attr(n, "better") === "lower";
      return [
        ...caption(
          attr(n, "title"),
          nonEmpty(unit)
            ? ` (${unit}, ${lower ? "lower" : "higher"} is better)`
            : ` (${lower ? "lower" : "higher"} is better)`
        ),
        table(
          ["name", "before", "after", "Δ", "note"],
          els(n, "Bench").map((b) => {
            const before = num(b, "before");
            const after = num(b, "after");
            let d = "";
            if (before !== undefined && after !== undefined && before !== 0) {
              const rel = ((after - before) / Math.abs(before)) * 100;
              const good = lower ? rel < 0 : rel > 0;
              d = `${rel > 0 ? "+" : ""}${Math.round(rel * 10) / 10}%${good ? "" : " ⚠"}`;
            }
            return [
              attr(b, "name") ?? "",
              attr(b, "before") ?? "",
              attr(b, "after") ?? "",
              d,
              attr(b, "note") ?? ctx.text(b),
            ];
          })
        ),
        ...ctx.children(withoutEls(n, ["Bench"])),
      ];
    },
  },
  Bump: {
    flow: (n, ctx) => [
      para([
        strong([txt(attr(n, "name") ?? "")]),
        txt(` ${attr(n, "from") ?? ""} → ${attr(n, "to") ?? ""}`),
        ...suffix([
          attr(n, "kind"),
          flag(n, "breaking") ? "breaking" : undefined,
          nonEmpty(attr(n, "cves")) ? `${attr(n, "cves")} CVEs` : undefined,
          attr(n, "note"),
        ]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Bumps: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title"), tally(els(n, "Bump"), "kind")),
      list(
        els(n, "Bump").map((b) =>
          item([
            para([
              strong([txt(attr(b, "name") ?? "")]),
              txt(` ${attr(b, "from") ?? ""} → ${attr(b, "to") ?? ""}`),
              ...suffix([
                attr(b, "kind"),
                flag(b, "breaking") ? "breaking" : undefined,
                nonEmpty(attr(b, "cves"))
                  ? `${attr(b, "cves")} CVEs`
                  : undefined,
                attr(b, "note"),
              ]),
              ...(ctx.inline(b).length === 0
                ? []
                : [txt(" — "), ...ctx.inline(b)]),
            ]),
          ])
        )
      ),
      ...ctx.children(withoutEls(n, ["Bump"])),
    ],
  },
  Check: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        txt(attr(n, "name") ?? ""),
        ...(flag(n, "required") ? [txt(" "), icode("required")] : []),
        ...suffix([attr(n, "status"), attr(n, "duration")]),
      ]),
      ...ctx.children(n),
    ],
  },
  Checks: {
    flow: (n, ctx) => {
      const checks = els(n, "Check");
      const sum = durationSum(checks);
      return [
        ...caption(
          attr(n, "title"),
          `${tally(checks, "status")}${nonEmpty(sum) ? ` · ${sum}` : ""}`
        ),
        list(checks.map((c) => checkRow(c, ctx))),
        ...ctx.children(withoutEls(n, ["Check"])),
      ];
    },
  },
  Day: {
    flow: (n) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        icode(attr(n, "date") ?? ""),
        ...suffix([attr(n, "status"), attr(n, "note")]),
      ]),
    ],
  },
  DbField: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "name") ?? ""),
        txt(" "),
        icode(attr(n, "type") ?? ""),
        ...suffix([
          flag(n, "pk") ? "pk" : undefined,
          nonEmpty(attr(n, "fk")) ? `fk → ${attr(n, "fk")}` : undefined,
          flag(n, "unique") ? "unique" : undefined,
          flag(n, "null") ? "null" : undefined,
          nonEmpty(attr(n, "default"))
            ? `default ${attr(n, "default")}`
            : undefined,
        ]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  DbTable: {
    flow: (n, ctx) => [
      ...caption(
        attr(n, "name"),
        nonEmpty(attr(n, "note")) ? ` — ${attr(n, "note")}` : ""
      ),
      table(
        ["field", "type", "flags", "default"],
        els(n, "DbField").map((f) => {
          const flags = [
            flag(f, "pk") ? "pk" : undefined,
            nonEmpty(attr(f, "fk")) ? `fk → ${attr(f, "fk")}` : undefined,
            flag(f, "unique") ? "unique" : undefined,
            flag(f, "null") ? "null" : undefined,
          ]
            .filter(nonEmpty)
            .join(", ");
          return [
            [icode(attr(f, "name") ?? "")],
            [icode(attr(f, "type") ?? "")],
            flags,
            attr(f, "default") ?? "",
          ];
        })
      ),
      ...ctx.children(withoutEls(n, ["DbField"])),
    ],
  },
  Entry: {
    flow: (n, ctx) => [
      para([
        strong([txt(attr(n, "kind") ?? "changed")]),
        ...(nonEmpty(attr(n, "scope"))
          ? [txt(" "), icode(attr(n, "scope") ?? "")]
          : []),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  EnvVar: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...(flag(n, "required") ? [txt(" "), icode("required")] : []),
        ...suffix([
          flag(n, "secret") ? "secret" : attr(n, "value"),
          nonEmpty(attr(n, "default"))
            ? `default ${attr(n, "default")}`
            : undefined,
        ]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  EnvVars: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      table(
        ["name", "required", "value", "default", "description"],
        els(n, "EnvVar").map((e) => [
          [icode(attr(e, "name") ?? "")],
          flag(e, "required") ? "yes" : "",
          flag(e, "secret") ? "•••" : (attr(e, "value") ?? ""),
          attr(e, "default") ?? "",
          ctx.text(e),
        ])
      ),
      ...ctx.children(withoutEls(n, ["EnvVar"])),
    ],
  },
  Gauge: {
    flow: (n) => {
      const value = num(n, "value") ?? 0;
      const max = num(n, "max") ?? 100;
      return [
        para([
          strong([txt(attr(n, "label") ?? attr(n, "path") ?? "")]),
          txt(" "),
          icode(
            `[${bar(max === 0 ? 0 : value / max, 10)}] ${attr(n, "value") ?? ""}/${attr(n, "max") ?? "100"}`
          ),
          ...suffix([
            nonEmpty(attr(n, "target"))
              ? `target ${attr(n, "target")}`
              : undefined,
            attr(n, "detail"),
          ]),
        ]),
      ];
    },
  },
  Gauges: {
    flow: (n, ctx) => {
      const unit = attr(n, "unit") ?? "";
      const gauges = els(n, "Gauge");
      return [
        ...caption(attr(n, "title")),
        list(
          gauges.map((g) => {
            const value = num(g, "value") ?? 0;
            const max = num(g, "max") ?? 100;
            return item([
              para([
                strong([txt(attr(g, "label") ?? attr(g, "path") ?? "")]),
                txt(" "),
                icode(
                  `[${bar(max === 0 ? 0 : value / max, 10)}] ${attr(g, "value") ?? ""}/${attr(g, "max") ?? "100"}${unit}`
                ),
                ...suffix([
                  nonEmpty(attr(g, "target"))
                    ? `target ${attr(g, "target")}`
                    : undefined,
                  attr(g, "detail"),
                ]),
              ]),
            ]);
          })
        ),
        ...ctx.children(withoutEls(n, ["Gauge"])),
      ];
    },
  },
  Incident: {
    flow: (n, ctx) => {
      const meta = [
        nonEmpty(attr(n, "severity"))
          ? (attr(n, "severity") ?? "").toUpperCase()
          : undefined,
        attr(n, "status"),
        attr(n, "impact"),
      ]
        .filter(nonEmpty)
        .join(" · ");
      const times = [
        nonEmpty(attr(n, "detected"))
          ? `detected ${attr(n, "detected")}`
          : undefined,
        nonEmpty(attr(n, "started"))
          ? `started ${attr(n, "started")}`
          : undefined,
        nonEmpty(attr(n, "resolved"))
          ? `resolved ${attr(n, "resolved")}`
          : undefined,
        nonEmpty(attr(n, "duration"))
          ? `duration ${attr(n, "duration")}`
          : undefined,
      ]
        .filter(nonEmpty)
        .join(" · ");
      return [
        quote([
          para([
            strong([txt(attr(n, "title") ?? "")]),
            ...(meta === "" ? [] : [txt(` — ${meta}`)]),
          ]),
          ...(times === "" ? [] : [para([em([txt(times)])])]),
          ...ctx.children(n),
        ]),
      ];
    },
  },
  Package: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...(nonEmpty(attr(n, "version"))
          ? [txt(`@${attr(n, "version")}`)]
          : []),
        ...suffix([attr(n, "kind"), attr(n, "license"), attr(n, "note")]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Packages: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      table(
        ["package", "version", "kind", "license", "note"],
        els(n, "Package").map((p) => [
          [icode(attr(p, "name") ?? "")],
          attr(p, "version") ?? "",
          attr(p, "kind") ?? "",
          attr(p, "license") ?? "",
          ctx.text(p),
        ])
      ),
      ...ctx.children(withoutEls(n, ["Package"])),
    ],
  },
  Pathway: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      list(
        els(n, "Stop").map((s) =>
          statusItem(
            attr(s, "status"),
            [
              ...(flag(s, "current")
                ? [strong([txt(attr(s, "label") ?? "")])]
                : [txt(attr(s, "label") ?? "")]),
              ...suffix([attr(s, "status"), attr(s, "note")]),
            ],
            ctx.children(s)
          )
        )
      ),
      ...ctx.children(withoutEls(n, ["Stop"])),
    ],
  },
  Release: {
    flow: (n, ctx) => [
      heading(3, [
        ...(nonEmpty(attr(n, "href"))
          ? [link(attr(n, "href") ?? "", [txt(`v${attr(n, "version") ?? ""}`)])]
          : [icode(`v${attr(n, "version") ?? ""}`)]),
        ...(nonEmpty(attr(n, "title")) ? [txt(` — ${attr(n, "title")}`)] : []),
      ]),
      ...(nonEmpty(attr(n, "date"))
        ? [para([em([txt(attr(n, "date") ?? "")])])]
        : []),
      ...(els(n, "Entry").length === 0
        ? ctx.children(n)
        : [
            list(els(n, "Entry").map((e) => entryRow(e, ctx))),
            ...ctx.children(withoutEls(n, ["Entry"])),
          ]),
    ],
  },
  Review: {
    flow: (n, ctx) => [
      ...caption(
        attr(n, "title"),
        `${nonEmpty(attr(n, "verdict")) ? ` — ${verdictLabel(attr(n, "verdict"))}` : ""}${tally(els(n, "Comment"), "severity")}`
      ),
      ...ctx.children(n),
    ],
  },
  Schema: {
    flow: (n, ctx) => [
      ...caption(
        attr(n, "title"),
        nonEmpty(attr(n, "engine")) ? ` (${attr(n, "engine")})` : ""
      ),
      ...ctx.children(n),
    ],
  },
  Service: {
    flow: (n) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        txt(attr(n, "name") ?? ""),
        ...suffix([
          attr(n, "status"),
          nonEmpty(attr(n, "uptime")) ? `${attr(n, "uptime")}%` : undefined,
        ]),
      ]),
    ],
  },
  Severity: { text: (n) => [icode((attr(n, "level") ?? "").toUpperCase())] },
  StatusPage: {
    flow: (n, ctx) => {
      const services = els(n, "Service");
      const uptime = els(n, "Uptime");
      return [
        ...caption(
          attr(n, "title"),
          nonEmpty(attr(n, "updated")) ? ` — updated ${attr(n, "updated")}` : ""
        ),
        ...(uptime.length === 0
          ? []
          : uptime.flatMap((u): RootContent[] => {
              const strip = uptimeStrip(u);
              return [
                para([
                  ...(nonEmpty(attr(u, "title"))
                    ? [strong([txt(attr(u, "title") ?? "")]), txt(" ")]
                    : []),
                  ...(nonEmpty(attr(u, "pct"))
                    ? [icode(`${attr(u, "pct")}%`)]
                    : []),
                  ...suffix([
                    [attr(u, "from"), attr(u, "to")]
                      .filter(nonEmpty)
                      .join(" → "),
                  ]),
                ]),
                ...(strip === "" ? [] : [pre(strip)]),
              ];
            })),
        ...(services.length === 0 ? [] : [list(services.map(serviceRow))]),
        ...ctx.children(withoutEls(n, ["Service", "Uptime"])),
      ];
    },
  },
  Stop: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        ...(flag(n, "current")
          ? [strong([txt(attr(n, "label") ?? "")])]
          : [txt(attr(n, "label") ?? "")]),
        ...suffix([attr(n, "status"), attr(n, "note")]),
      ]),
      ...ctx.children(n),
    ],
  },
  Uptime: {
    flow: (n) => {
      const strip = uptimeStrip(n);
      return [
        para([
          ...(nonEmpty(attr(n, "title"))
            ? [strong([txt(attr(n, "title") ?? "")]), txt(" ")]
            : []),
          ...(nonEmpty(attr(n, "pct")) ? [icode(`${attr(n, "pct")}%`)] : []),
          ...suffix([
            [attr(n, "from"), attr(n, "to")].filter(nonEmpty).join(" → "),
          ]),
        ]),
        ...(strip === "" ? [] : [pre(strip)]),
      ];
    },
  },
  Verdict: {
    flow: (n, ctx) => {
      const label =
        attr(n, "label") ?? verdictLabel(attr(n, "status")) ?? "Note";
      return [
        quote([
          para([
            strong([txt(label)]),
            ...(nonEmpty(attr(n, "title"))
              ? [txt(` — ${attr(n, "title")}`)]
              : []),
          ]),
          ...ctx.children(n),
        ]),
      ];
    },
  },
  Vuln: {
    flow: (n, ctx) => [
      para([
        icode((attr(n, "severity") ?? "").toUpperCase()),
        ...(nonEmpty(attr(n, "id"))
          ? [txt(" "), strong([txt(attr(n, "id") ?? "")])]
          : []),
        ...(nonEmpty(attr(n, "package"))
          ? [txt(" "), icode(attr(n, "package") ?? "")]
          : []),
        ...suffix([
          attr(n, "title"),
          nonEmpty(attr(n, "affected"))
            ? `affected: ${attr(n, "affected")}`
            : undefined,
          nonEmpty(attr(n, "fix")) ? `fix: ${attr(n, "fix")}` : undefined,
          flag(n, "wontfix") ? "wontfix" : undefined,
        ]),
      ]),
      ...ctx.children(n),
    ],
  },
};
