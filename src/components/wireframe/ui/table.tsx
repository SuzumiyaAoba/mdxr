// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
"use client";

import { cn } from "cn";
import * as React from "react";

import { Text } from "./text.js";

/**
 * Props for the Table component.
 * A data table component with wireframe helpers for headers and cells.
 */
export interface TableProps extends React.ComponentProps<"table"> {}

function Table({ className, ...props }: TableProps) {
  return (
    <div
      data-slot="wireframe-table-container"
      className="scrollbar-hide relative w-full overflow-x-auto"
    >
      <table
        data-slot="wireframe-table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

/**
 * Props for the TableHeader component.
 * Container for table header rows.
 */
export interface TableHeaderProps extends React.ComponentProps<"thead"> {}

function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="wireframe-table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

/**
 * Props for the TableBody component.
 * Container for table body rows.
 */
export interface TableBodyProps extends React.ComponentProps<"tbody"> {}

function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      data-slot="wireframe-table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

/**
 * Props for the TableFooter component.
 * Container for table footer rows.
 */
export interface TableFooterProps extends React.ComponentProps<"tfoot"> {}

function TableFooter({ className, ...props }: TableFooterProps) {
  return (
    <tfoot
      data-slot="wireframe-table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the TableRow component.
 * A table row with hover and selection states.
 */
export interface TableRowProps extends React.ComponentProps<"tr"> {}

function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="wireframe-table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the TableHead component.
 * A table header cell.
 */
export interface TableHeadProps extends React.ComponentProps<"th"> {}

function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      data-slot="wireframe-table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the TableCell component.
 * A table data cell.
 */
export interface TableCellProps extends React.ComponentProps<"td"> {}

function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      data-slot="wireframe-table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

/**
 * Props for the TableCaption component.
 * A caption for the table.
 */
export interface TableCaptionProps extends React.ComponentProps<"caption"> {}

function TableCaption({ className, ...props }: TableCaptionProps) {
  return (
    <caption
      data-slot="wireframe-table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

// Wireframe helper component for table cells
function TableCellWireframe({
  width = "md",
  className,
  ...props
}: React.ComponentProps<"td"> & {
  width?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <TableCell className={className} {...props}>
      <Text width={width} />
    </TableCell>
  );
}

// Wireframe helper component for table headers
function TableHeadWireframe({
  width = "sm",
  className,
  ...props
}: React.ComponentProps<"th"> & {
  width?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}) {
  return (
    <TableHead className={className} {...props}>
      <Text width={width} emphasis="secondary" />
    </TableHead>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableCellWireframe,
  TableHeadWireframe,
};
