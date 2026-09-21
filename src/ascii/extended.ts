import type { RootContent } from "mdast";
import type { Node } from "unist";

import { calculate } from "../extended/calculator.js";
import { EXTENDED_FEATURES } from "../extended/catalog.js";
import type { DataRecord } from "../extended/data.js";
import {
  columnsOf,
  numberValue,
  display,
  parseJson,
  readRecords,
  records,
  tableRecords,
  isDataRecord as isRecord,
} from "../extended/data.js";
import { diagramModel, flameModel } from "../extended/diagrams.js";
import { comparisonModel, schemaRows } from "../extended/differences.js";
import { PLOT_NAMES, plotModel } from "../extended/plots.js";
import type { PlotName } from "../extended/plots.js";
import {
  bundleModel,
  queryPlanModel,
  dependencyMatrixModel,
} from "../extended/profiles.js";
import { REPORT_SPECS, reportModel } from "../extended/reports.js";
import { safeHref } from "../guards.js";
import { isParent } from "../remark/ast.js";
import type { AsciiCtx, AsciiEntry, AsciiRegistry, MdxTarget } from "./ast.js";
import {
  attr,
  els,
  item,
  link,
  list,
  para,
  pre,
  table,
  textOf,
  txt,
} from "./ast.js";
import { caption } from "./parts.js";

const findNode = (
  node: Node,
  predicate: (value: Node) => boolean
): Node | undefined => {
  if (predicate(node)) {
    return node;
  }
  if (isParent(node)) {
    for (const child of node.children) {
      const result = findNode(child, predicate);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
};
const codeData = (
  node: MdxTarget
): { source: string; format: string } | undefined => {
  const code = findNode(
    node,
    (child) =>
      child.type === "code" &&
      "lang" in child &&
      (child.lang === "json" || child.lang === "csv")
  );
  return code && "value" in code && typeof code.value === "string"
    ? {
        format: "lang" in code && code.lang === "csv" ? "csv" : "json",
        source: code.value,
      }
    : undefined;
};

export const nodeAttributes = (node: MdxTarget): DataRecord =>
  Object.fromEntries(
    (Array.isArray(node.attributes) ? node.attributes : []).flatMap((value) =>
      isRecord(value) && typeof value.name === "string"
        ? [[value.name, value.value ?? true]]
        : []
    )
  );
const optionData = (node: MdxTarget): DataRecord => {
  const value: unknown = parseJson(attr(node, "options") ?? "{}");
  if (!isRecord(value)) {
    throw new Error("options must be a JSON object");
  }
  return value;
};

const nodeRows = (node: MdxTarget): DataRecord[] => {
  const source = attr(node, "data");
  if (source !== undefined) {
    return readRecords(source, attr(node, "format"));
  }
  const code = codeData(node);
  if (code) {
    return readRecords(code.source, code.format);
  }
  const grid = findNode(node, (child) => child.type === "table");
  if (grid && isParent(grid)) {
    return tableRecords(
      grid.children.map((row) =>
        isParent(row) ? row.children.map(textOf) : []
      )
    );
  }
  return els(node, "RecordItem").map(nodeAttributes);
};

const recordsTable = (rows: DataRecord[], cols?: string[]): RootContent[] =>
  rows.length
    ? [
        table(
          cols ?? columnsOf(rows),
          rows.map((row) =>
            (cols ?? columnsOf(rows)).map((key) => display(row[key]) || "—")
          )
        ),
      ]
    : [para([txt("No data")])];
const narrative = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  if (attr(node, "data") !== undefined) {
    return ctx.children(node);
  }
  const children = node.children?.filter((child) => {
    if (child.type === "table") {
      return false;
    }
    if (
      child.type === "code" &&
      "lang" in child &&
      (child.lang === "json" || child.lang === "csv")
    ) {
      return false;
    }
    return !("name" in child && child.name === "RecordItem");
  });
  return ctx.children({ ...node, children });
};
const base = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => [
  ...caption(attr(node, "title") ?? node.name),
  ...ctx.children(node),
];

const dataBlock = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => [
  ...caption(attr(node, "title") ?? node.name),
  ...recordsTable(
    nodeRows(node),
    attr(node, "columns")
      ?.split(",")
      .map((key) => key.trim())
  ),
  ...narrative(node, ctx),
];

const report = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const model = reportModel(node.name ?? "", nodeRows(node), optionData(node));
  return [
    ...caption(attr(node, "title") ?? node.name, ` — ${model.summary}`),
    ...recordsTable(model.rows, model.columns),
    ...narrative(node, ctx),
  ];
};
const plot = (name: PlotName): AsciiEntry => ({
  flow: (node) => {
    const model = plotModel(name, nodeRows(node), optionData(node));
    return [
      ...caption(
        attr(node, "title") ?? name,
        model.summary ? ` — ${model.summary}` : ""
      ),
      ...recordsTable(model.rows),
      ...(model.metrics ? recordsTable(model.metrics) : []),
    ];
  },
});

const difference = (node: MdxTarget): RootContent[] => {
  const name = node.name ?? "JsonDiff";
  const before: unknown = parseJson(attr(node, "before") ?? "null");
  const after: unknown = parseJson(attr(node, "after") ?? "null");
  const rows = comparisonModel(
    name,
    before,
    after,
    attr(node, "rowKey") ?? "id"
  );
  return [
    ...caption(attr(node, "title") ?? name, ` — ${rows.length} changes`),
    ...(rows.length ? recordsTable(rows) : [para([txt("No changes")])]),
  ];
};

const diagram = (node: MdxTarget): RootContent[] => {
  const nodes = records(parseJson(attr(node, "nodes") ?? "[]"));
  const edges = records(parseJson(attr(node, "edges") ?? "[]"));
  const model = diagramModel(
    node.name ?? "Architecture",
    nodes,
    edges,
    optionData(node)
  );
  return [
    ...caption(attr(node, "title") ?? node.name, ` — ${model.summary}`),
    ...recordsTable(model.rows),
    ...recordsTable(edges),
  ];
};

const sourceLink = (
  node: MdxTarget,
  key: string,
  label: string
): RootContent[] => {
  const url = safeHref(attr(node, key));
  return [
    para(
      url !== undefined && url !== "" ? [link(url, [txt(label)])] : [txt(label)]
    ),
  ];
};

export const extendedRenderers: AsciiRegistry = {};
for (const feature of EXTENDED_FEATURES) {
  for (const name of feature.components) {
    extendedRenderers[name] = { flow: base };
  }
}
for (const name of Object.keys(REPORT_SPECS)) {
  extendedRenderers[name] = { flow: report };
}
for (const name of PLOT_NAMES) {
  extendedRenderers[name] = plot(name);
}
for (const name of [
  "JsonDiff",
  "ConfigDiff",
  "ApiDiff",
  "SchemaDiff",
  "DatasetDiff",
]) {
  extendedRenderers[name] = { flow: difference };
}
for (const name of [
  "ImpactMap",
  "DataLineage",
  "SequenceDiagram",
  "StateDiagram",
  "Swimlane",
  "Architecture",
  "DecisionTree",
  "MindMap",
  "ServiceTopology",
]) {
  extendedRenderers[name] = { flow: diagram };
}
for (const name of [
  "DataTable",
  "DownloadData",
  "AnnotatedImage",
  "AudioTranscript",
  "Conversation",
  "CodeWalkthrough",
  "Calculator",
  "Wizard",
]) {
  extendedRenderers[name] = { flow: dataBlock };
}

Object.assign(extendedRenderers, {
  AnnotatedImage: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...sourceLink(node, "src", attr(node, "alt") ?? "Annotated image"),
      ...dataBlock(node, ctx),
    ],
  },
  AudioTranscript: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...sourceLink(node, "src", "Audio recording"),
      ...dataBlock(node, ctx),
    ],
  },
  BundleReport: {
    flow: (node: MdxTarget) => {
      const model = bundleModel(nodeRows(node));
      return [
        ...caption(
          attr(node, "title") ?? "Bundle report",
          ` — ${model.summary}`
        ),
        ...recordsTable(model.rows),
      ];
    },
  },
  Calculator: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => {
      const rows = nodeRows(node);
      const result = calculate(
        attr(node, "operation") ?? "sum",
        rows.map((row) => numberValue(row.value, "value", 0)),
        rows.map((row) => numberValue(row.weight, "weight", 1))
      );
      return [
        ...dataBlock(node, ctx),
        para([
          txt(`Result: ${result ?? "undefined"} ${attr(node, "unit") ?? ""}`),
        ]),
      ];
    },
  },
  Checklist: {
    flow: (node: MdxTarget) => [
      ...caption(attr(node, "title") ?? "Checklist"),
      list(
        nodeRows(node).map((row) =>
          item(
            [para([txt(display(row.label ?? row.name))])],
            row.checked === true || row.checked === "true"
          )
        )
      ),
    ],
  },
  Cite: {
    text: (node: MdxTarget) => [
      link(attr(node, "href") ?? `#${attr(node, "source")}`, [
        txt(attr(node, "label") ?? attr(node, "source") ?? ""),
      ]),
    ],
  },
  CrossRef: {
    text: (node: MdxTarget, ctx: AsciiCtx) => [
      link(
        attr(node, "href") ?? `#${attr(node, "target")}`,
        (node.children?.length ?? 0) > 0
          ? ctx.inline(node)
          : [txt(attr(node, "label") ?? attr(node, "target") ?? "")]
      ),
    ],
  },
  DependencyMatrix: {
    flow: (node: MdxTarget) =>
      recordsTable(dependencyMatrixModel(nodeRows(node)).rows),
  },
  DocumentSearch: {
    flow: () => [
      para([txt("Search this document using your viewer’s Find command.")]),
    ],
  },
  EntityRelations: { flow: dataBlock },
  Flamegraph: {
    flow: (node: MdxTarget) => {
      const model = flameModel(nodeRows(node));
      return [
        ...caption(attr(node, "title") ?? "Flamegraph", ` — ${model.summary}`),
        ...recordsTable(model.rows),
      ];
    },
  },
  ImageCompare: {
    flow: (node: MdxTarget) => [
      ...sourceLink(node, "before", attr(node, "beforeAlt") ?? "Before image"),
      ...sourceLink(node, "after", attr(node, "afterAlt") ?? "After image"),
    ],
  },
  ImageGallery: {
    flow: (node: MdxTarget) => [
      ...caption(attr(node, "title") ?? "Gallery"),
      ...nodeRows(node).map((row): RootContent => ({
        alt: display(row.alt ?? row.caption),
        title: display(row.caption),
        type: "image",
        url: safeHref(display(row.src)) ?? "",
      })),
    ],
  },
  Include: { flow: (node: MdxTarget, ctx: AsciiCtx) => ctx.children(node) },
  NumberedEquation: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...caption(`Equation ${attr(node, "number") ?? ""}`),
      ...ctx.children(node),
    ],
  },
  ObjectSchema: {
    flow: (node: MdxTarget) => [
      ...caption(attr(node, "title") ?? "Object schema"),
      ...recordsTable(
        schemaRows(
          parseJson(attr(node, "schema") ?? codeData(node)?.source ?? "{}")
        )
      ),
    ],
  },
  PackageInstall: {
    flow: (node: MdxTarget) => [
      ...caption(attr(node, "title") ?? "Install"),
      pre(
        ["npm", "pnpm", "yarn", "bun"]
          .map(
            (manager) =>
              `${manager} ${manager === "npm" ? "install" : "add"}${attr(node, "dev") === "true" ? " -D" : ""} ${attr(node, "packages") ?? ""}`
          )
          .join("\n"),
        "sh"
      ),
    ],
  },
  PageBreak: { flow: () => [{ type: "thematicBreak" }] },
  PdfPreview: {
    flow: (node: MdxTarget) =>
      sourceLink(
        node,
        "src",
        `${attr(node, "title") ?? "PDF document"} (page ${attr(node, "page") ?? "1"})`
      ),
  },
  PrintLayout: { flow: (node: MdxTarget, ctx: AsciiCtx) => ctx.children(node) },
  PromptTemplate: {
    flow: (node: MdxTarget) => {
      const rows = nodeRows(node);
      const defaults = Object.fromEntries(
        rows.map((row) => [display(row.name), display(row.value)])
      );
      const prompt = (attr(node, "template") ?? "").replaceAll(
        /\{\{\s*(?<variable>[\w.-]+)\s*\}\}/gu,
        (match: string, name: string) => defaults[name] ?? match
      );
      return [
        ...caption(attr(node, "title") ?? "Prompt template"),
        ...recordsTable(rows),
        pre(prompt, "text"),
      ];
    },
  },
  QueryPlan: {
    flow: (node: MdxTarget) => [
      ...caption(attr(node, "title") ?? "Query plan"),
      ...recordsTable(queryPlanModel(nodeRows(node)).rows),
    ],
  },
  Ranking: {
    flow: (node: MdxTarget) => [
      ...caption(attr(node, "title") ?? "Ranking"),
      list(
        nodeRows(node).map((row) =>
          item([para([txt(display(row.label ?? row.name))])])
        ),
        true
      ),
    ],
  },
  RecordItem: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...recordsTable([nodeAttributes(node)]),
      ...ctx.children(node),
    ],
  },
  Request: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...caption(
        ["Request", attr(node, "method"), attr(node, "path")]
          .filter(Boolean)
          .join(" ")
      ),
      pre(
        [attr(node, "headers"), attr(node, "body")]
          .filter(Boolean)
          .join("\n\n"),
        "http"
      ),
      ...ctx.children(node),
    ],
  },
  Response: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...caption(`Response ${attr(node, "status") ?? ""}`),
      pre(
        [attr(node, "headers"), attr(node, "body")]
          .filter(Boolean)
          .join("\n\n"),
        "http"
      ),
      ...ctx.children(node),
    ],
  },
  Source: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      para([
        txt(`[${attr(node, "number") ?? attr(node, "id")}] `),
        link(safeHref(attr(node, "href")) ?? "#", [
          txt(attr(node, "title") ?? "Source"),
        ]),
        txt(
          ` ${[attr(node, "author"), attr(node, "published"), attr(node, "accessed")].filter(Boolean).join(" · ")}`
        ),
      ]),
      ...ctx.children(node),
    ],
  },
  TabItem: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...caption(attr(node, "label")),
      ...ctx.children(node),
    ],
  },
  TermRef: {
    text: (node: MdxTarget) => [
      link(attr(node, "href") ?? "#", [
        txt(attr(node, "label") ?? attr(node, "term") ?? ""),
      ]),
      ...(attr(node, "description") !== undefined &&
      attr(node, "description") !== ""
        ? [txt(` (${attr(node, "description")})`)]
        : []),
    ],
  },
  Theorem: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...caption(
        `Theorem ${attr(node, "number") ?? ""}: ${attr(node, "title") ?? ""}`
      ),
      ...ctx.children(node),
    ],
  },
  Video: {
    flow: (node: MdxTarget, ctx: AsciiCtx) => [
      ...sourceLink(node, "src", attr(node, "title") ?? "Video"),
      ...sourceLink(node, "captions", "Captions"),
      ...ctx.children(node),
    ],
  },
  VisualDiff: {
    flow: (node: MdxTarget) => [
      ...caption(
        attr(node, "title") ?? "Visual regression",
        attr(node, "mismatch") !== undefined && attr(node, "mismatch") !== ""
          ? ` — ${attr(node, "mismatch")}% mismatch`
          : ""
      ),
      ...sourceLink(node, "expected", "Expected"),
      ...sourceLink(node, "actual", "Actual"),
      ...sourceLink(node, "diff", "Difference"),
    ],
  },
} satisfies AsciiRegistry);
