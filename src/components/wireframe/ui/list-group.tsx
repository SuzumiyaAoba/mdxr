import { cn } from "cn";
// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import * as React from "react";

import type { WireframeSpacing } from "../lib/wireframe-types.js";
import { Text, type TextProps } from "./text.js";
/**
 * Props for the ListGroup component.
 * Renders list items with Text placeholders for wireframe prototyping.
 */
export interface ListGroupProps extends React.HTMLAttributes<HTMLUListElement> {
  /**
   * Number of list items to render
   * @default 3
   */
  label?: string;
  items?: number;
  /**
   * List marker style
   * @default 'bullet'
   */
  variant?: "bullet" | "number" | "none";
  /**
   * Height of each text line
   * @default 'base'
   */
  size?: TextProps["size"];
  /**
   * Width of each text line
   * @default 'lg'
   */
  itemWidth?: TextProps["width"];
  /**
   * Vertical spacing between items
   * @default 'normal'
   */
  spacing?: WireframeSpacing;
}
const ListGroup = ({
  ref,
  label = "List placeholder",
  items = 3,
  variant = "bullet",
  size = "base",
  itemWidth = "lg",
  spacing = "normal",
  className,
  ...props
}: ListGroupProps & {
  ref?: React.Ref<HTMLUListElement & HTMLOListElement>;
}) => {
  const spacingMap: Record<WireframeSpacing, string> = {
    tight: "gap-1",
    normal: "gap-2",
    relaxed: "gap-3",
  };
  const List = variant === "number" ? "ol" : "ul";
  return (
    <List
      aria-label={label}
      ref={ref}
      data-slot="wireframe-list"
      className={cn("flex list-none flex-col", spacingMap[spacing], className)}
      {...props}
    >
      {Array.from({ length: items }).map((_, i) => (
        <li key={i} className="flex items-center gap-2">
          {variant === "bullet" && (
            <span className="wireframe-line size-1.5 shrink-0 rounded-full" />
          )}
          {variant === "number" && (
            <span className="wireframe-line h-3 w-3 shrink-0 rounded-sm" />
          )}
          <Text size={size} width={itemWidth} />
        </li>
      ))}
    </List>
  );
};
ListGroup.displayName = "ListGroup";
export { ListGroup };
