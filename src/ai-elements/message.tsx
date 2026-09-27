/*
 * Adapted from Vercel AI Elements:
 * https://github.com/vercel/ai-elements/blob/main/packages/elements/src/message.tsx
 * Copyright 2023 Vercel, Inc. Licensed under Apache-2.0; see ./LICENSE.
 * Changes: narrowed the component set to message layout and actions; no AI SDK or Streamdown dependency.
 */

import { cn } from "cn";
import type { ComponentProps, HTMLAttributes } from "react";

import { Button } from "../components/ui/button.js";

export type MessageRole =
  | "assistant"
  | "developer"
  | "system"
  | "tool"
  | "user";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole;
};

export const Message = ({ from, className, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    data-role={from}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:px-4 group-[.is-user]:py-3",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  />
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  children,
  label,
  tooltip,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: MessageActionProps) => {
  const accessibleLabel = label ?? tooltip;

  return (
    <Button
      aria-label={accessibleLabel}
      size={size}
      title={tooltip}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      {accessibleLabel !== undefined && accessibleLabel.length > 0 ? (
        <span className="sr-only">{accessibleLabel}</span>
      ) : null}
    </Button>
  );
};
