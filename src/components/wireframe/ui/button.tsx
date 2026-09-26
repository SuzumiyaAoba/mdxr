import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import * as React from "react";

import { textOf } from "../../../define.js";
import { Text } from "./text.js";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-foreground hover:bg-accent border",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-input bg-background hover:bg-accent border",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-lg px-4",
        lg: "h-12 rounded-lg px-8",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Props for the Button component.
 * A versatile button with multiple variants and sizes.
 */
export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /**
   * Visual style variant
   * @default 'default'
   */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  /**
   * Button size
   * @default 'default'
   */
  size?: "default" | "sm" | "lg" | "icon";
  /**
   * Render as a child component (using Radix Slot)
   * Useful for rendering as Link or other components
   * @default false
   */
  href?: string;
  label?: string;
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  href,
  label,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }));
  const name =
    label ??
    (textOf(children).trim() === "" ? "Button placeholder" : undefined);
  const content = children ?? (
    <Text size="sm" width={size === "icon" ? "full" : "xs"} />
  );
  if (asChild)
    return (
      <Slot
        aria-label={name}
        data-slot="wireframe-button"
        className={classes}
        {...props}
      >
        {children}
      </Slot>
    );
  if (href && !props.disabled)
    return (
      <Slot
        aria-label={name}
        data-slot="wireframe-button"
        className={classes}
        {...props}
      >
        <a href={href}>{content}</a>
      </Slot>
    );
  return (
    <button
      aria-label={name}
      data-slot="wireframe-button"
      className={classes}
      type={type}
      {...props}
    >
      {content}
    </button>
  );
}

export { Button, buttonVariants };
