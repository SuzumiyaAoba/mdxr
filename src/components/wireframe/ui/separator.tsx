// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
"use client";

import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "cn";
import * as React from "react";

/**
 * Props for the Separator component.
 * Visually or semantically separates content with horizontal or vertical orientation.
 */
export interface SeparatorProps extends React.ComponentProps<
  typeof SeparatorPrimitive.Root
> {
  /**
   * Orientation of the separator
   * @default 'horizontal'
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Whether the separator is purely decorative (affects accessibility)
   * @default true
   */
  decorative?: boolean;
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="wireframe-separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
