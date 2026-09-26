// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { Separator } from "./separator.js";
import { Text } from "./text.js";

const buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=wireframe-button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=wireframe-select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=wireframe-select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
);

/**
 * Props for the ButtonGroup component.
 * A button group component with wireframe helper for text labels.
 */
export interface ButtonGroupProps
  extends
    React.ComponentProps<"div">,
    VariantProps<typeof buttonGroupVariants> {
  /**
   * Orientation of the button group
   * @default 'horizontal'
   */
  orientation?: "horizontal" | "vertical";
}

function ButtonGroup({ className, orientation, ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      data-slot="wireframe-button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

/**
 * Props for the ButtonGroupText component.
 * Text label within a button group.
 */
export interface ButtonGroupTextProps extends React.ComponentProps<"div"> {
  /**
   * Render as a child component (using Radix Slot)
   * @default false
   */
  asChild?: boolean;
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: ButtonGroupTextProps) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the ButtonGroupSeparator component.
 * Visual separator between buttons in a group.
 */
export interface ButtonGroupSeparatorProps extends React.ComponentProps<
  typeof Separator
> {
  /**
   * Orientation of the separator
   * @default 'vertical'
   */
  orientation?: "horizontal" | "vertical";
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: ButtonGroupSeparatorProps) {
  return (
    <Separator
      data-slot="wireframe-button-group-separator"
      orientation={orientation}
      className={cn(
        "bg-input relative m-0! self-stretch data-[orientation=vertical]:h-auto",
        className
      )}
      {...props}
    />
  );
}

// Wireframe helper component
function ButtonGroupTextWireframe({
  width = "sm",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  width?: "xs" | "sm" | "md" | "lg";
}) {
  return (
    <ButtonGroupText className={className} {...props}>
      <Text width={width} size="sm" />
    </ButtonGroupText>
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  ButtonGroupTextWireframe,
  buttonGroupVariants,
};
