/*
 * Adapted from Vercel AI Elements:
 * https://github.com/vercel/ai-elements/blob/main/packages/elements/src/conversation.tsx
 * Copyright 2023 Vercel, Inc. Licensed under Apache-2.0; see ./LICENSE.
 * Changes: replaced use-stick-to-bottom with a small local scroll-follow implementation.
 */

import { cn } from "cn";
import { ArrowDownIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentProps, ReactNode, UIEvent } from "react";

import { Button } from "../components/ui/button.js";

interface ConversationContextValue {
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(
  null
);

const useConversationContext = (): ConversationContextValue => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      "ConversationScrollButton must be used inside a Conversation."
    );
  }
  return context;
};

export type ConversationProps = ComponentProps<"div">;

export const Conversation = ({
  children,
  className,
  onScroll,
  role = "log",
  tabIndex = 0,
  ...props
}: ConversationProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const updateScrollPosition = useCallback((viewport: HTMLDivElement) => {
    const nextIsAtBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 24;
    wasAtBottomRef.current = nextIsAtBottom;
    setIsAtBottom(nextIsAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
    wasAtBottomRef.current = true;
    setIsAtBottom(true);
  }, []);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      updateScrollPosition(event.currentTarget);
      onScroll?.(event);
    },
    [onScroll, updateScrollPosition]
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (wasAtBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    updateScrollPosition(viewport);
  });

  const contextValue = useMemo(
    () => ({ isAtBottom, scrollToBottom }),
    [isAtBottom, scrollToBottom]
  );

  return (
    <ConversationContext.Provider value={contextValue}>
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto overscroll-contain",
          className
        )}
        onScroll={handleScroll}
        ref={viewportRef}
        role={role}
        tabIndex={tabIndex}
        {...props}
      >
        {children}
      </div>
    </ConversationContext.Provider>
  );
};

export type ConversationContentProps = ComponentProps<"div">;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <div
    className={cn("flex min-h-full flex-col gap-8 p-4", className)}
    {...props}
  />
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon !== null && icon !== undefined && typeof icon !== "boolean" ? (
          <div className="text-muted-foreground">{icon}</div>
        ) : null}
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useConversationContext();

  if (isAtBottom) {
    return null;
  }

  return (
    <Button
      aria-label="Scroll to latest message"
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full",
        className
      )}
      onClick={scrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};
