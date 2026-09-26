// Adapted from wireframe-ui (MIT). See src/wireframe-ui.LICENSE.md.
import type { ResponsiveProps } from "./wireframe-types.js";

const SIZES: Record<string, string> = {
  xs: "h-2",
  sm: "h-3",
  base: "h-3.5",
  lg: "h-4",
  xl: "h-5",
};
const WIDTHS: Record<string, string> = {
  xs: "w-16",
  sm: "w-24",
  md: "w-32",
  lg: "w-48",
  xl: "w-64",
  full: "w-full",
};

export function getResponsiveClasses<T extends Record<string, string | number>>(
  responsive: ResponsiveProps<T> | undefined,
  propName?: string
): string {
  if (responsive === undefined) return "";
  const classes: string[] = [];
  for (const breakpoint of ["base", "sm", "md", "lg", "xl"] as const) {
    const values = responsive[breakpoint];
    if (values === undefined) continue;
    for (const [key, value] of Object.entries(values)) {
      const token = String(value);
      const utility = propName
        ? `${propName}-${token}`
        : key === "size"
          ? SIZES[token]
          : key === "width"
            ? WIDTHS[token]
            : `${key}-${token}`;
      if (utility)
        classes.push(
          breakpoint === "base" ? utility : `${breakpoint}:${utility}`
        );
    }
  }
  return classes.join(" ");
}

export function getHideOnClasses(
  hideOn: ReadonlyArray<"sm" | "md" | "lg" | "xl"> | undefined
): string {
  return hideOn?.map((breakpoint) => `${breakpoint}:hidden`).join(" ") ?? "";
}
