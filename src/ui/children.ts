import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import type { GenericSchema, InferOutput } from "valibot";

import { flattenChildren, parseProps } from "../define.js";
import { isRecord } from "../guards.js";

/**
 * `n` is an element rendered by `type` — a string tag (`"ul"`, `"li"`) or a
 * component reference (`Finding`, `Search`). Pairs with `flattenChildren`
 * from define.ts to pick items out of a `children` tree.
 */
export const isEl = <P extends { children?: ReactNode }>(
  n: unknown,
  type: unknown
): n is ReactElement<P> => isValidElement<P>(n) && n.type === type;

/** Read a single prop off an element, or `undefined` for non-elements. */
export const propOf = (n: unknown, key: string): unknown =>
  isValidElement(n) && isRecord(n.props) ? n.props[key] : undefined;

/** Validate structured children while preserving surrounding prose and its order. */
export const collectChildProps = <S extends GenericSchema>(
  children: ReactNode,
  type: unknown,
  schema: S,
  tag: string
): { items: InferOutput<S>[]; rest: ReactNode[] } => {
  const items: InferOutput<S>[] = [];
  const rest: ReactNode[] = [];
  for (const child of flattenChildren(children)) {
    if (isEl(child, type)) {
      items.push(parseProps(schema, child.props, tag));
    } else {
      rest.push(child);
    }
  }
  return { items, rest };
};

/**
 * Tally `prop` across `children` elements rendered by `of` — the count
 * summary behind `<Findings>`/`<Hypotheses>` headers. Values failing `is`
 * bucket under `fallback`.
 */
export const countByProp = <T extends string>(
  children: ReactNode,
  of: unknown,
  prop: string,
  is: (x: unknown) => x is T,
  fallback: T
): Map<T, number> => {
  const counts = new Map<T, number>();
  for (const node of flattenChildren(children)) {
    if (!isEl(node, of)) {
      continue;
    }
    const val = propOf(node, prop);
    const key = is(val) ? val : fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};
