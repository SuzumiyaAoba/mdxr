// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import { cn } from "cn";

/**
 * Props for the Kbd component.
 * Displays keyboard shortcuts or keys with proper styling.
 */
export interface KbdProps extends React.ComponentProps<"kbd"> {}

function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="wireframe-kbd"
      className={cn(
        "bg-card text-muted-foreground border-input pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded border px-1 font-sans text-xs font-medium shadow-xs select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=wireframe-tooltip-content]_&]:bg-background/20 [[data-slot=wireframe-tooltip-content]_&]:text-background dark:[[data-slot=wireframe-tooltip-content]_&]:bg-background/10",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the KbdGroup component.
 * Container for grouping multiple Kbd components (e.g., "Cmd + K").
 */
export interface KbdGroupProps extends React.ComponentProps<"div"> {}

function KbdGroup({ className, ...props }: KbdGroupProps) {
  return (
    <kbd
      data-slot="wireframe-kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
