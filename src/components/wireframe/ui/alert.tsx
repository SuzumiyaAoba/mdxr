import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import * as React from "react";

import { Text } from "./text.js";

const alertVariants = cva(
  "[&>svg]:text-muted-foreground [&>div:first-child]:text-muted-foreground relative grid w-full grid-cols-[0_1fr] items-center gap-y-1 rounded-lg px-4 py-4 text-sm has-[>div:first-child]:grid-cols-[calc(var(--spacing)*5)_1fr] has-[>div:first-child]:gap-x-4 has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] has-[>svg]:gap-x-4 [&>div:first-child]:size-5 [&>svg]:size-5",
  {
    variants: {
      variant: {
        default: "bg-card text-foreground border",
        destructive:
          "bg-destructive/10 text-destructive [&>svg]:text-destructive [&>div:first-child]:text-destructive border-destructive/20 border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Props for the Alert component.
 * Displays a callout for user attention with optional icon and variant styles.
 */
export interface AlertProps
  extends React.ComponentProps<"div">, VariantProps<typeof alertVariants> {
  /**
   * Visual style variant
   * @default 'default'
   */
  variant?: "default" | "destructive";
}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="wireframe-alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * Props for the AlertTitle component.
 * Displays the alert's main heading.
 */
export interface AlertTitleProps extends React.ComponentProps<"div"> {}

function AlertTitle({ className, ...props }: AlertTitleProps) {
  return (
    <div
      data-slot="wireframe-alert-title"
      className={cn("col-start-2 font-medium", className)}
      {...props}
    />
  );
}

/**
 * Props for the AlertDescription component.
 * Displays supporting text below the alert title.
 */
export interface AlertDescriptionProps extends React.ComponentProps<"div"> {}

function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return (
    <div
      data-slot="wireframe-alert-description"
      className={cn("text-muted-foreground col-start-2 text-sm", className)}
      {...props}
    />
  );
}

/**
 * Props for the AlertWireframe component.
 * Wireframe helper that renders a complete alert with placeholder text.
 */
export interface AlertWireframeProps extends Omit<
  AlertProps,
  "children" | "variant"
> {
  /**
   * Visual style variant
   * @default 'default'
   */
  variant?: "default" | "destructive";
  /**
   * Icon to display in the alert
   * @default <ExclamationTriangleIcon />
   */
  icon?: React.ReactNode;
  /**
   * Width of the title placeholder text
   * @default 'lg'
   */
  titleWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Width of the description placeholder text
   * @default 'full'
   */
  descriptionWidth?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}

function AlertWireframe({
  variant = "default",
  icon,
  titleWidth = "lg",
  descriptionWidth = "full",
  className,
  ...props
}: AlertWireframeProps) {
  return (
    <Alert variant={variant} className={className} {...props}>
      {icon || <ExclamationTriangleIcon className="text-muted-foreground" />}
      <AlertTitle>
        <Text width={titleWidth} truncate />
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-1.5">
          <Text width={descriptionWidth} color="muted" truncate />
          <Text width="xl" color="muted" truncate />
        </div>
      </AlertDescription>
    </Alert>
  );
}

export { Alert, AlertTitle, AlertDescription, AlertWireframe };
