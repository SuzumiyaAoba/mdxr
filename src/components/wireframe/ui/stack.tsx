import { cn } from "cn";
// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import * as React from "react";
/**
 * Props for the Stack component.
 * A layout primitive for arranging wireframe elements with configurable spacing and alignment.
 */
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Flex direction of the stack
   * @default 'vertical'
   */
  direction?: "vertical" | "horizontal";
  /**
   * Gap between stack items
   * @default 'md'
   */
  spacing?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Cross-axis alignment (align-items)
   * @default 'stretch'
   */
  align?: "start" | "center" | "end" | "stretch";
  /**
   * Main-axis alignment (justify-content)
   * @default 'start'
   */
  justify?: "start" | "center" | "end" | "between" | "around";
}
const Stack = ({
  ref,
  direction = "vertical",
  spacing = "md",
  align = "stretch",
  justify = "start",
  className,
  children,
  ...props
}: StackProps & {
  ref?: React.Ref<HTMLDivElement>;
}) => {
  const spacingMap = {
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
  };
  const alignMap = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  };
  const justifyMap = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
  };
  return (
    <div
      ref={ref}
      data-slot="wireframe-stack"
      className={cn(
        "flex min-w-0",
        direction === "vertical" ? "flex-col" : "flex-row flex-wrap",
        spacingMap[spacing],
        alignMap[align],
        justifyMap[justify],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
Stack.displayName = "Stack";
export { Stack };
