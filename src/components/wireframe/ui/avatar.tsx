// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
"use client";

import { UserIcon } from "@heroicons/react/24/outline";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "cn";
import * as React from "react";

/**
 * Props for the Avatar component.
 * An image element with a fallback for representing the user.
 */
export interface AvatarProps extends React.ComponentProps<
  typeof AvatarPrimitive.Root
> {
  label?: string;
  size?: "sm" | "md" | "lg";
}

function Avatar({
  className,
  label,
  size = "md",
  children,
  ...props
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      aria-label={label}
      role={label === undefined ? undefined : "img"}
      data-slot="wireframe-avatar"
      className={cn(
        "bg-muted-foreground/15 relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        { sm: "size-8", md: "size-12", lg: "size-16" }[size],
        className
      )}
      {...props}
    >
      {children ?? <AvatarFallback />}
    </AvatarPrimitive.Root>
  );
}

/**
 * Props for the AvatarImage component.
 * The image displayed within the avatar.
 */
export interface AvatarImageProps extends React.ComponentProps<
  typeof AvatarPrimitive.Image
> {
  /**
   * Source URL of the avatar image
   */
  src?: string;
  /**
   * Alternative text for the image
   */
  alt?: string;
}

function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      data-slot="wireframe-avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}

/**
 * Props for the AvatarFallback component.
 * Fallback content displayed when the avatar image fails to load.
 */
export interface AvatarFallbackProps extends React.ComponentProps<
  typeof AvatarPrimitive.Fallback
> {}

function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="wireframe-avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-transparent",
        className
      )}
      {...props}
    >
      {props.children || (
        <div className="bg-muted-foreground/30 relative flex size-6 items-center justify-center overflow-hidden rounded-full">
          <UserIcon className="text-muted-foreground/60" />
        </div>
      )}
    </AvatarPrimitive.Fallback>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
