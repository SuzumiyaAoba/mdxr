/*
 * Adapted from Vercel AI Elements:
 * https://github.com/vercel/ai-elements/blob/main/packages/elements/src/prompt-input.tsx
 * Copyright 2023 Vercel, Inc. Licensed under Apache-2.0; see ./LICENSE.
 * Changes: retained the composable prompt form while removing AI SDK, upload, picker, and Next.js dependencies.
 */

import { cn } from "cn";
import { CornerDownLeftIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEvent,
  SubmitEvent,
} from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "../components/ui/input-group.js";

interface PromptInputContextValue {
  disabled: boolean;
  setValue: (value: string) => void;
  value: string;
}

const PromptInputContext = createContext<PromptInputContextValue | null>(null);

const usePromptInputContext = (): PromptInputContextValue => {
  const context = useContext(PromptInputContext);
  if (!context) {
    throw new Error(
      "PromptInputTextarea and PromptInputSubmit must be used inside PromptInput."
    );
  }
  return context;
};

export type PromptInputProps = Omit<
  ComponentProps<"form">,
  "defaultValue" | "onChange" | "onSubmit"
> & {
  defaultValue?: string;
  disabled?: boolean;
  onSubmit: (
    message: string,
    event: SubmitEvent<HTMLFormElement>
  ) => void | Promise<void>;
  onError?: (error: unknown) => void;
  onValueChange?: (value: string) => void;
  value?: string;
};

export const PromptInput = ({
  children,
  className,
  defaultValue = "",
  disabled = false,
  onError,
  onSubmit,
  onValueChange,
  value: controlledValue,
  ...props
}: PromptInputProps) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;

  const setValue = useCallback(
    (nextValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [controlledValue, onValueChange]
  );

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const message = value.trim();
      if (disabled || message.length === 0) {
        return;
      }

      try {
        const result = onSubmit(message, event);
        if (result instanceof Promise) {
          const completeSubmission = async (): Promise<void> => {
            try {
              await result;
              setValue("");
            } catch (error) {
              onError?.(error);
            }
          };
          void completeSubmission();
          return;
        }
        setValue("");
      } catch (error) {
        onError?.(error);
      }
    },
    [disabled, onError, onSubmit, setValue, value]
  );

  const contextValue = useMemo(
    () => ({ disabled, setValue, value }),
    [disabled, setValue, value]
  );

  return (
    <PromptInputContext.Provider value={contextValue}>
      <form
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        {...props}
      >
        <InputGroup
          className="overflow-hidden"
          data-disabled={disabled ? "true" : undefined}
        >
          {children}
        </InputGroup>
      </form>
    </PromptInputContext.Provider>
  );
};

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

export const PromptInputTextarea = ({
  className,
  disabled,
  onChange,
  onCompositionEnd,
  onCompositionStart,
  onKeyDown,
  placeholder = "What would you like to know?",
  value: controlledTextareaValue,
  ...props
}: PromptInputTextareaProps) => {
  const { disabled: inputDisabled, setValue, value } = usePromptInputContext();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) {
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !isComposing &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }
    },
    [isComposing, onKeyDown]
  );

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      disabled={inputDisabled || disabled === true}
      onChange={(event) => {
        setValue(event.currentTarget.value);
        onChange?.(event);
      }}
      onCompositionEnd={(event) => {
        setIsComposing(false);
        onCompositionEnd?.(event);
      }}
      onCompositionStart={(event) => {
        setIsComposing(true);
        onCompositionStart?.(event);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      value={controlledTextareaValue ?? value}
      {...props}
    />
  );
};

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputFooter = ({
  className,
  ...props
}: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-1", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div
    className={cn("flex min-w-0 items-center gap-1", className)}
    {...props}
  />
);

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton>;

export const PromptInputSubmit = ({
  "aria-label": ariaLabel = "Send message",
  children,
  className,
  disabled,
  size = "icon-sm",
  type = "submit",
  variant = "default",
  ...props
}: PromptInputSubmitProps) => {
  const { disabled: inputDisabled, value } = usePromptInputContext();

  return (
    <InputGroupButton
      aria-label={ariaLabel}
      className={cn(className)}
      disabled={
        inputDisabled || (disabled ?? false) || value.trim().length === 0
      }
      size={size}
      type={type}
      variant={variant}
      {...props}
    >
      {children ?? <CornerDownLeftIcon className="size-4" />}
    </InputGroupButton>
  );
};
