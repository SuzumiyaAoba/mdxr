// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "cn";
import * as React from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type UseFormReturn,
  type DefaultValues,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type UseFormProps,
  type RegisterOptions,
} from "react-hook-form";

import { Label } from "./label.js";

function Form({
  children,
  defaultValues,
  mode,
  ...props
}: Partial<UseFormReturn<FieldValues>> & {
  children?: React.ReactNode;
  defaultValues?: DefaultValues<FieldValues>;
  mode?: UseFormProps<FieldValues>["mode"];
}) {
  const methods = useForm({ defaultValues, mode });
  return (
    <FormProvider {...methods} {...props}>
      {children}
    </FormProvider>
  );
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
  controlled?: boolean;
  rules?: RegisterOptions;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: Omit<ControllerProps<TFieldValues, TName>, "render"> & {
  render?: ControllerProps<TFieldValues, TName>["render"];
  children?: React.ReactNode;
}) => {
  const controlled = props.render !== undefined;
  const name = props.name;
  // Context erases the field generic; FormControl registers in the same parent form.
  const rules = props.rules as RegisterOptions | undefined;
  const contextValue = React.useMemo(
    () => ({ name, controlled, rules }),
    [name, controlled, rules]
  );
  return (
    <FormFieldContext.Provider value={contextValue}>
      {props.render ? (
        <Controller {...props} render={props.render} />
      ) : (
        props.children
      )}
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    controlled: fieldContext.controlled,
    rules: fieldContext.rules,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

export interface FormItemProps extends React.ComponentProps<"div"> {}

function FormItem({ className, ...props }: FormItemProps) {
  const id = React.useId();
  const contextValue = React.useMemo(() => ({ id }), [id]);

  return (
    <FormItemContext.Provider value={contextValue}>
      <div
        data-slot="wireframe-form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
}

export interface FormLabelProps extends React.ComponentProps<
  typeof LabelPrimitive.Root
> {}

function FormLabel({ className, ...props }: FormLabelProps) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      data-slot="wireframe-form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

export interface FormControlProps extends React.ComponentProps<typeof Slot> {}

function FormControl({ ...props }: FormControlProps) {
  const {
    error,
    formItemId,
    formDescriptionId,
    formMessageId,
    name,
    controlled,
    rules,
  } = useFormField();
  const { register, getValues } = useFormContext();

  return (
    <Slot
      {...(controlled
        ? {}
        : { ...register(name, rules), defaultValue: getValues(name) })}
      data-slot="wireframe-form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

export interface FormDescriptionProps extends React.ComponentProps<"p"> {}

function FormDescription({ className, ...props }: FormDescriptionProps) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot="wireframe-form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export interface FormMessageProps extends React.ComponentProps<"p"> {}

function FormMessage({ className, ...props }: FormMessageProps) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : props.children;

  if (!body) {
    return null;
  }

  return (
    <p
      data-slot="wireframe-form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
