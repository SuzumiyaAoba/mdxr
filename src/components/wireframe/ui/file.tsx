// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { useMemo } from "react";

import { Label } from "./label.js";
import { Separator } from "./separator.js";
import { Text } from "./text.js";

export interface FieldSetProps extends React.ComponentProps<"fieldset"> {}

function FieldSet({ className, ...props }: FieldSetProps) {
  return (
    <fieldset
      data-slot="wireframe-field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=wireframe-checkbox-group]]:gap-3 has-[>[data-slot=wireframe-radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  );
}

export interface FieldLegendProps extends React.ComponentProps<"legend"> {
  variant?: "legend" | "label";
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: FieldLegendProps) {
  return (
    <legend
      data-slot="wireframe-field-legend"
      data-variant={variant}
      className={cn(
        "mb-3 font-medium",
        "data-[variant=legend]:text-base",
        "data-[variant=label]:text-sm",
        className
      )}
      {...props}
    />
  );
}

export interface FieldGroupProps extends React.ComponentProps<"div"> {}

function FieldGroup({ className, ...props }: FieldGroupProps) {
  return (
    <div
      data-slot="wireframe-field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=wireframe-checkbox-group]:gap-3 *:data-[slot=wireframe-field-group]:gap-4",
        className
      )}
      {...props}
    />
  );
}

const fieldVariants = cva(
  "group/field data-[invalid=true]:text-destructive flex w-full gap-3",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=wireframe-field-label]]:flex-auto",
          "has-[>[data-slot=wireframe-field-content]]:items-start has-[>[data-slot=wireframe-field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto",
          "@md/field-group:[&>[data-slot=wireframe-field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=wireframe-field-content]]:items-start @md/field-group:has-[>[data-slot=wireframe-field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
);

export interface FieldProps
  extends React.ComponentProps<"div">, VariantProps<typeof fieldVariants> {}

function Field({ className, orientation = "vertical", ...props }: FieldProps) {
  return (
    <div
      role="group"
      data-slot="wireframe-field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

export interface FieldContentProps extends React.ComponentProps<"div"> {}

function FieldContent({ className, ...props }: FieldContentProps) {
  return (
    <div
      data-slot="wireframe-field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-1.5 leading-snug",
        className
      )}
      {...props}
    />
  );
}

export interface FieldLabelProps extends React.ComponentProps<typeof Label> {}

function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <Label
      data-slot="wireframe-field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
        "has-[>[data-slot=wireframe-field]]:w-full has-[>[data-slot=wireframe-field]]:flex-col has-[>[data-slot=wireframe-field]]:rounded-md has-[>[data-slot=wireframe-field]]:border *:data-[slot=wireframe-field]:p-4",
        "has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10",
        className
      )}
      {...props}
    />
  );
}

export interface FieldTitleProps extends React.ComponentProps<"div"> {}

function FieldTitle({ className, ...props }: FieldTitleProps) {
  return (
    <div
      data-slot="wireframe-field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export interface FieldDescriptionProps extends React.ComponentProps<"p"> {}

function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <p
      data-slot="wireframe-field-description"
      className={cn(
        "text-muted-foreground text-sm leading-normal font-normal group-has-data-[orientation=horizontal]/field:text-balance",
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

export interface FieldSeparatorProps extends React.ComponentProps<"div"> {
  children?: React.ReactNode;
}

function FieldSeparator({
  children,
  className,
  ...props
}: FieldSeparatorProps) {
  return (
    <div
      data-slot="wireframe-field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
          data-slot="wireframe-field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

export interface FieldErrorProps extends React.ComponentProps<"div"> {
  errors?: Array<{ message?: string } | undefined>;
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: FieldErrorProps) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error) =>
            error?.message && <li key={error.message}>{error.message}</li>
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="wireframe-field-error"
      className={cn("text-destructive text-sm font-normal", className)}
      {...props}
    >
      {content}
    </div>
  );
}

// Wireframe helper components
function FieldLabelWireframe({
  width = "sm",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Label>, "children"> & {
  width?: "xs" | "sm" | "md" | "lg";
}) {
  return (
    <FieldLabel className={className} {...props}>
      <Text width={width} size="sm" />
    </FieldLabel>
  );
}

function FieldDescriptionWireframe({
  width = "lg",
  className,
  ...props
}: Omit<React.ComponentProps<"p">, "children"> & {
  width?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <FieldDescription className={className} {...props}>
      <Text width={width} size="sm" color="muted" />
    </FieldDescription>
  );
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
  FieldLabelWireframe,
  FieldDescriptionWireframe,
};
