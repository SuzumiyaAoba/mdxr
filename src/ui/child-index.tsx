import { createContext, isValidElement, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { flattenChildren } from "../define.js";

export interface ChildIndex {
  /** 1-based position among siblings; 0 when rendered outside an indexed container. */
  n: number;
  /** Whether this is the last sibling — used to hide trailing connectors. */
  last: boolean;
}

const ChildIndexCtx = createContext<ChildIndex>({ last: true, n: 0 });

export const useChildIndex = (): ChildIndex => useContext(ChildIndexCtx);

const IndexedChild = ({
  n,
  last,
  children,
}: ChildIndex & { children?: ReactNode }): ReactElement => {
  const value = useMemo(() => ({ last, n }), [last, n]);
  return (
    <ChildIndexCtx.Provider value={value}>{children}</ChildIndexCtx.Provider>
  );
};

/**
 * Wrap each flattened child in a provider carrying its position, so child
 * components (FlowStep, Finding, …) can render numbers and connectors without
 * prop injection.
 */
export const indexChildren = (children: ReactNode): ReactNode[] => {
  const flat = flattenChildren(children);
  return flat.map((child, i) => (
    <IndexedChild
      key={isValidElement(child) ? (child.key ?? i) : i}
      last={i === flat.length - 1}
      n={i + 1}
    >
      {child}
    </IndexedChild>
  ));
};
