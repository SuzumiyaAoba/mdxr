import { cn } from "cn";
// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import * as React from "react";

import { Text, type TextProps } from "./text.js";
/**
 * Props for the Heading component.
 * Renders a Text component sized appropriately for heading levels.
 */
export interface HeadingProps extends Omit<TextProps, "size" | "width"> {
  /**
   * Semantic heading level (affects size and width)
   * @default 1
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * HTML element to render (overrides semantic level)
   * @default `h${level}`
   */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";
}
const Heading = ({
  ref,
  id,
  level = 1,
  as,
  className,
  label = "Heading placeholder",
  children,
  ...props
}: HeadingProps & {
  ref?: React.Ref<HTMLElement>;
}) => {
  // Map heading levels to appropriate text sizes
  const sizeMap = {
    1: "xl" as const,
    2: "lg" as const,
    3: "lg" as const,
    4: "base" as const,
    5: "sm" as const,
    6: "sm" as const,
  };
  // Map heading levels to appropriate widths
  const widthMap = {
    1: "lg" as const,
    2: "lg" as const,
    3: "md" as const,
    4: "md" as const,
    5: "sm" as const,
    6: "sm" as const,
  };
  // Use the 'as' prop if provided, otherwise default to the semantic heading tag
  const Component = (as || `h${level}`) as React.ElementType;
  return (
    <Component
      ref={ref}
      id={id}
      className={cn("m-0 min-w-0 text-lg font-semibold", className)}
    >
      {children ?? (
        <>
          <span className="sr-only">{label}</span>
          <Text size={sizeMap[level]} width={widthMap[level]} {...props} />
        </>
      )}
    </Component>
  );
};
Heading.displayName = "Heading";
export { Heading };
