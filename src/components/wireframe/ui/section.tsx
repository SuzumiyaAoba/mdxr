import { cn } from "cn";
// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import * as React from "react";

import { Heading } from "./heading.js";
import { Paragraph } from "./paragraph.js";
/**
 * Props for the Section component.
 * A composition component with preset variants for common layout patterns.
 */
export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Preset layout variant
   * - 'hero': Centered content with heading, paragraph, and CTA buttons
   * - 'content-two-column': Two-column layout with text and media
   * - 'feature-grid': Three-column grid of features
   * - 'custom': Flexible layout (renders children as-is)
   * @default 'custom'
   */
  variant?: "hero" | "content-two-column" | "feature-grid" | "custom";
  /**
   * Gap between section elements
   * @default 'normal'
   */
  spacing?: "tight" | "normal" | "relaxed";
}
const Section = ({
  ref,
  variant = "custom",
  spacing = "normal",
  className,
  children,
  ...props
}: SectionProps & {
  ref?: React.Ref<HTMLElement>;
}) => {
  const spacingMap = {
    tight: "gap-4",
    normal: "gap-8",
    relaxed: "gap-12",
  };
  if (children !== undefined) {
    const layout =
      variant === "content-two-column"
        ? "grid grid-cols-1 @md/wireframe:grid-cols-2"
        : variant === "feature-grid"
          ? "grid grid-cols-1 @md/wireframe:grid-cols-3"
          : "flex flex-col";
    return (
      <section
        ref={ref}
        data-slot="wireframe-section"
        data-variant={variant}
        className={cn("min-w-0", layout, spacingMap[spacing], className)}
        {...props}
      >
        {children}
      </section>
    );
  }
  if (variant === "hero") {
    return (
      <section
        ref={ref}
        data-slot="wireframe-section"
        data-variant="hero"
        className={cn(
          "flex flex-col items-center text-center",
          spacingMap[spacing],
          className
        )}
        {...props}
      >
        <Heading level={1} />
        <Paragraph lines={2} size="lg" />
        <div className="flex gap-4">
          <div className="wireframe-block h-10 w-32" />
          <div className="wireframe-block h-10 w-32" />
        </div>
      </section>
    );
  }
  if (variant === "content-two-column") {
    return (
      <section
        ref={ref}
        data-slot="wireframe-section"
        data-variant="content-two-column"
        className={cn(
          "grid grid-cols-1 @md/wireframe:grid-cols-2",
          spacingMap[spacing],
          className
        )}
        {...props}
      >
        <div className="flex flex-col gap-4">
          <Heading level={2} />
          <Paragraph lines={4} />
        </div>
        <div className="wireframe-block aspect-video" />
      </section>
    );
  }
  if (variant === "feature-grid") {
    return (
      <section
        ref={ref}
        data-slot="wireframe-section"
        data-variant="feature-grid"
        className={cn(
          "grid grid-cols-1 @md/wireframe:grid-cols-3",
          spacingMap[spacing],
          className
        )}
        {...props}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="wireframe-block h-12 w-12" />
            <Heading level={3} />
            <Paragraph lines={2} size="sm" />
          </div>
        ))}
      </section>
    );
  }
  // Custom variant - flexible layout
  return (
    <section
      ref={ref}
      data-slot="wireframe-section"
      data-variant="custom"
      className={cn(spacingMap[spacing], className)}
      {...props}
    >
      {children}
    </section>
  );
};
Section.displayName = "Section";
export { Section };
