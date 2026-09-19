import { Fragment, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import type { GenericSchema, InferOutput } from "valibot";
import { safeParse } from "valibot";

import { isRecord } from "./guards.js";

/** Metadata attached to a component for `mdxr catalog` and prop validation. */
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
 * A component usable in an mdxr document. Props are intentionally loose —
 * documents are data, and prop validation happens via `defineComponent`
 * schemas at render time. Only ever invoked by MDX/React.
 */
export type AnyComponent = ((props: DocProps) => ReactNode) & {
  __mdxr?: ComponentMeta;
};

/** Name → component map passed to MDX's `components` prop. */
export type ComponentMap = Record<string, AnyComponent>;

export type MdxrComponent = AnyComponent;

type PropsOf<S> = S extends GenericSchema
  ? InferOutput<S>
  : Record<string, unknown>;

/**
 * Validate `props` against `schema`, throwing the catalog's `Invalid props`
 * error on failure. `tag` names the element in the message
 * (`Invalid props on <Node>`); without it the bare `Invalid props` form is
 * reported — the shape `defineComponent` produces.
 */
export const parseProps = <S extends GenericSchema>(
  schema: S,
  props: unknown,
  tag?: string
): InferOutput<S> => {
  const r = safeParse(schema, props);
  if (!r.success) {
    const detail = r.issues
      .map(
        (i) =>
          `${i.path?.map((p) => String(p.key)).join(".") ?? "props"}: ${i.message}`
      )
      .join("; ");
    throw new Error(
      tag === undefined
        ? `Invalid props: ${detail}`
        : `Invalid props on <${tag}>: ${detail}`
    );
  }
  return r.output;
};

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
): MdxrComponent => {
  const Comp = (props: DocProps): ReactElement | null => {
    const parsed: unknown =
      meta.schema === undefined ? props : parseProps(meta.schema, props);
    // Validated above by the schema (or intentionally loose without one).
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return render(parsed as PropsOf<S> & { children?: ReactNode });
  };
  Comp.__mdxr = meta;
  return Comp;
};

/**
 * Normalize a `children` prop into a flat array: nested arrays and fragments
 * are unwrapped, and null/undefined/boolean nodes are dropped. Used instead of
 * `React.Children` utilities, which lint rules discourage.
 */
export const flattenChildren = (node: ReactNode): ReactNode[] => {
  if (Array.isArray(node)) {
    return node.flatMap(flattenChildren);
  }
  if (node === null || node === undefined || typeof node === "boolean") {
    return [];
  }
  if (
    isValidElement<{ children?: ReactNode }>(node) &&
    node.type === Fragment
  ) {
    return flattenChildren(node.props.children);
  }
  return [node];
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
