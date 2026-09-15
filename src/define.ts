import type { ReactElement, ReactNode } from "react";
import type { GenericSchema, InferOutput } from "valibot";
import { safeParse } from "valibot";

import { isRecord } from "./guards.js";

/** Metadata attached to a component for `rv catalog` and prop validation. */
export interface ComponentMeta {
  description?: string;
  /** Valibot schema for props (MDX attributes arrive as strings; `children` is passed through). */
  schema?: GenericSchema;
}

/** Props as received from a document: arbitrary attributes plus children. */
export interface DocProps extends Record<string, unknown> {
  children?: ReactNode;
}

/**
 * A component usable in an rv document. Props are intentionally loose —
 * documents are data, and prop validation happens via `defineComponent`
 * schemas at render time. Only ever invoked by MDX/React.
 */
export type AnyComponent = ((props: DocProps) => ReactNode) & {
  __rv?: ComponentMeta;
};

/** Name → component map passed to MDX's `components` prop. */
export type ComponentMap = Record<string, AnyComponent>;

export type RvComponent = AnyComponent;

type PropsOf<S> = S extends GenericSchema
  ? InferOutput<S>
  : Record<string, unknown>;

/**
 * Wrap a render function with prop validation + catalog metadata.
 * Prop types are inferred from the valibot schema, so the render callback
 * is fully typed. Validation failures surface as document errors so the
 * agent can self-correct.
 */
export const defineComponent = <
  S extends GenericSchema | undefined = undefined,
>(
  meta: { description?: string; schema?: S },
  render: (props: PropsOf<S> & { children?: ReactNode }) => ReactElement | null
): RvComponent => {
  const Comp = (props: DocProps): ReactElement | null => {
    let parsed: unknown = props;
    if (meta.schema !== undefined) {
      const r = safeParse(meta.schema, props);
      if (!r.success) {
        const detail = r.issues
          .map(
            (i) =>
              `${i.path?.map((p) => String(p.key)).join(".") ?? "props"}: ${i.message}`
          )
          .join("; ");
        throw new Error(`Invalid props: ${detail}`);
      }
      parsed = r.output;
    }
    // Validated above by the schema (or intentionally loose without one).
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return render(parsed as PropsOf<S> & { children?: ReactNode });
  };
  Comp.__rv = meta;
  return Comp;
};

/** Extract all text from a React node tree (used for copy-to-clipboard payloads). */
export const textOf = (node: unknown): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (isRecord(node) && isRecord(node.props)) {
    return textOf(node.props.children);
  }
  return "";
};
