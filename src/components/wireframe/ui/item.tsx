import { MusicalNoteIcon } from "@heroicons/react/24/outline";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import * as React from "react";

import { Separator } from "./separator.js";
import { Text } from "./text.js";

/**
 * Props for the ItemGroup component.
 * Container for grouping multiple Item components.
 */
export interface ItemGroupProps extends React.ComponentProps<"div"> {}

function ItemGroup({ className, ...props }: ItemGroupProps) {
  return (
    <div
      role="list"
      data-slot="wireframe-item-group"
      className={cn("group/item-group flex flex-col", className)}
      {...props}
    />
  );
}

/**
 * Props for the ItemSeparator component.
 * Horizontal separator between items in a group.
 */
export interface ItemSeparatorProps extends React.ComponentProps<
  typeof Separator
> {}

function ItemSeparator({ className, ...props }: ItemSeparatorProps) {
  return (
    <Separator
      data-slot="wireframe-item-separator"
      orientation="horizontal"
      className={cn("my-0", className)}
      {...props}
    />
  );
}

const itemVariants = cva(
  "group/item [a]:hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:ring-[3px] [a]:transition-colors",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-border",
        muted: "bg-muted/50",
      },
      size: {
        default: "gap-4 p-4",
        sm: "gap-3 px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Props for the Item component.
 * A flexible item component for lists with wireframe helpers for titles, descriptions, and media.
 */
export interface ItemProps
  extends React.ComponentProps<"div">, VariantProps<typeof itemVariants> {
  /**
   * Visual style variant
   * @default 'default'
   */
  variant?: "default" | "outline" | "muted";
  /**
   * Size variant
   * @default 'default'
   */
  size?: "default" | "sm";
  /**
   * Render as a child component (using Radix Slot)
   * @default false
   */
  asChild?: boolean;
}

function Item({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ItemProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="wireframe-item"
      data-variant={variant}
      data-size={size}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=wireframe-item-description]]/item:translate-y-0.5 group-has-[[data-slot=wireframe-item-description]]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted size-8 rounded-sm border [&_svg:not([class*='size-'])]:size-4",
        image:
          "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Props for the ItemMedia component.
 * Container for item media (icon or image).
 */
export interface ItemMediaProps
  extends React.ComponentProps<"div">, VariantProps<typeof itemMediaVariants> {
  /**
   * Media variant style
   * @default 'default'
   */
  variant?: "default" | "icon" | "image";
}

function ItemMedia({
  className,
  variant = "default",
  ...props
}: ItemMediaProps) {
  return (
    <div
      data-slot="wireframe-item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

/**
 * Props for the ItemContent component.
 * Container for item title and description.
 */
export interface ItemContentProps extends React.ComponentProps<"div"> {}

function ItemContent({ className, ...props }: ItemContentProps) {
  return (
    <div
      data-slot="wireframe-item-content"
      className={cn(
        "flex flex-1 flex-col gap-1 [&+[data-slot=wireframe-item-content]]:flex-none",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the ItemTitle component.
 * Title text for the item.
 */
export interface ItemTitleProps extends React.ComponentProps<"div"> {}

function ItemTitle({ className, ...props }: ItemTitleProps) {
  return (
    <div
      data-slot="wireframe-item-title"
      className={cn(
        "flex w-fit items-center gap-2 text-sm leading-snug font-medium",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the ItemDescription component.
 * Description text for the item.
 */
export interface ItemDescriptionProps extends React.ComponentProps<"p"> {}

function ItemDescription({ className, ...props }: ItemDescriptionProps) {
  return (
    <p
      data-slot="wireframe-item-description"
      className={cn(
        "text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the ItemActions component.
 * Container for action buttons or icons.
 */
export interface ItemActionsProps extends React.ComponentProps<"div"> {}

function ItemActions({ className, ...props }: ItemActionsProps) {
  return (
    <div
      data-slot="wireframe-item-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

/**
 * Props for the ItemHeader component.
 * Header section spanning full width of the item.
 */
export interface ItemHeaderProps extends React.ComponentProps<"div"> {}

function ItemHeader({ className, ...props }: ItemHeaderProps) {
  return (
    <div
      data-slot="wireframe-item-header"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the ItemFooter component.
 * Footer section spanning full width of the item.
 */
export interface ItemFooterProps extends React.ComponentProps<"div"> {}

function ItemFooter({ className, ...props }: ItemFooterProps) {
  return (
    <div
      data-slot="wireframe-item-footer"
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  );
}

// Wireframe helper components
function ItemTitleWireframe({
  width = "md",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  width?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <ItemTitle className={className} {...props}>
      <Text width={width} emphasis="primary" />
    </ItemTitle>
  );
}

function ItemDescriptionWireframe({
  width = "lg",
  className,
  ...props
}: Omit<React.ComponentProps<"p">, "children"> & {
  width?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <ItemDescription className={className} {...props}>
      <Text width={width} color="muted" />
    </ItemDescription>
  );
}

function ItemMediaWireframe({
  variant = "image",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "icon" | "image" }) {
  return (
    <ItemMedia variant={variant} className={className} {...props}>
      {children || (
        <>
          {variant === "icon" && <div className="wireframe-block size-4" />}
          {variant === "image" && (
            <MusicalNoteIcon className="text-muted-foreground size-6" />
          )}
        </>
      )}
    </ItemMedia>
  );
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
  ItemTitleWireframe,
  ItemDescriptionWireframe,
  ItemMediaWireframe,
};
