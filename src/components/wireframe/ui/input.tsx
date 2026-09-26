// Adapted from wireframe-ui (MIT). See src/wireframe-ui.LICENSE.md.
import { cn } from "cn";
import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

export interface InputProps extends ComponentProps<"input"> {
  variant?: "default" | "wireframe";
  skeletonMaxLength?: number;
  skeletonIcon?: ReactNode;
  label?: string;
}

function Input({
  className,
  id,
  label,
  variant = "default",
  skeletonMaxLength = 20,
  skeletonIcon,
  placeholder,
  maxLength,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const skeleton = variant === "wireframe";
  return (
    <div className="not-prose w-full min-w-0" data-slot="wireframe-input">
      {label !== undefined && (
        <label className="mb-2 block text-sm font-medium" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          aria-label={
            label === undefined && id === undefined
              ? "Input placeholder"
              : undefined
          }
          className={cn(
            "peer border-input placeholder:text-muted-foreground focus-visible:ring-ring block h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
            skeletonIcon && "pl-10",
            className
          )}
          data-slot="wireframe-input-control"
          id={inputId}
          maxLength={maxLength ?? (skeleton ? skeletonMaxLength : undefined)}
          placeholder={placeholder ?? (skeleton ? " " : undefined)}
          {...props}
        />
        {skeleton && !placeholder && (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-3 top-3 hidden peer-placeholder-shown:block peer-focus:hidden",
              skeletonIcon && "left-10"
            )}
          >
            <span className="wireframe-line block h-3 w-48 max-w-full" />
          </span>
        )}
        {skeletonIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex w-4 items-center"
          >
            {skeletonIcon}
          </span>
        )}
      </div>
    </div>
  );
}
export { Input };
