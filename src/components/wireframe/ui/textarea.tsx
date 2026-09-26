// Adapted from wireframe-ui (MIT). See src/wireframe-ui.LICENSE.md.
import { cn } from "cn";
import { useId } from "react";
import type { ComponentProps } from "react";
export interface TextareaProps extends ComponentProps<"textarea"> {
  variant?: "default" | "wireframe";
  skeletonMaxLength?: number;
  skeletonLines?: number;
  label?: string;
}
function Textarea({
  className,
  id,
  label,
  variant = "default",
  skeletonMaxLength = 100,
  skeletonLines = 3,
  rows = skeletonLines,
  placeholder,
  maxLength,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const skeleton = variant === "wireframe";
  const slots = Array.from(
    { length: Math.max(1, Math.min(50, skeletonLines, rows)) },
    (_, index) => index + 1
  );
  return (
    <div className="not-prose w-full min-w-0" data-slot="wireframe-textarea">
      {label !== undefined && (
        <label className="mb-2 block text-sm font-medium" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          aria-label={
            label === undefined && id === undefined
              ? "Textarea placeholder"
              : undefined
          }
          className={cn(
            "peer border-input placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-ring block w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          data-slot="wireframe-textarea-control"
          id={inputId}
          maxLength={maxLength ?? (skeleton ? skeletonMaxLength : undefined)}
          placeholder={placeholder ?? (skeleton ? " " : undefined)}
          rows={rows}
          {...props}
        />
        {skeleton && !placeholder && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-3 hidden flex-col gap-2 peer-placeholder-shown:flex peer-focus:hidden"
          >
            {slots.map((line) => (
              <span
                className={cn(
                  "wireframe-line block h-3 max-w-full",
                  line === slots.length ? "w-3/4" : "w-full"
                )}
                key={line}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
export { Textarea };
