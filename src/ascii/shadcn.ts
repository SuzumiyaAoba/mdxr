/**
 * ASCII renderers for the shadcn/ui (Base UI) primitives. They're
 * interactive widgets — markdown can't host them, so each gets the most
 * readable textual stand-in: chips, `[x]` checkboxes, `[____]` inputs,
 * `<details>` disclosures, real GFM tables, or a plain text unwrap.
 */

import type { ListItem, PhrasingContent, RootContent } from "mdast";
import type { Node } from "unist";

import { nonEmpty } from "../guards.js";
import { isParent } from "../remark/ast.js";
import {
  attr,
  els,
  em,
  flag,
  flagOff,
  heading,
  icode,
  item,
  link,
  list,
  named,
  num,
  para,
  pre,
  quote,
  strong,
  table,
  thematic,
  txt,
  withoutEls,
} from "./ast.js";
import type { AsciiCtx, AsciiEntry, AsciiRegistry, MdxTarget } from "./ast.js";
import { bar } from "./glyphs.js";
import { detailsBlock } from "./parts.js";

/** `ctx.inline` result wrapped so empty children fall back to `alt`. */
const inlineOr = (
  node: MdxTarget,
  ctx: AsciiCtx,
  alt: string
): PhrasingContent[] => {
  const inner = ctx.inline(node);
  return inner.length === 0 ? [txt(alt)] : inner;
};

/* ------------------------- generic behaviors ------------------------ */

const unwrapFlow: AsciiEntry = { flow: (n, ctx) => ctx.children(n) };

const strongPara: AsciiEntry = {
  flow: (n, ctx) => [para([strong(inlineOr(n, ctx, ""))])],
  text: (n, ctx) => [strong(inlineOr(n, ctx, ""))],
};

const emPara: AsciiEntry = {
  flow: (n, ctx) => [para([em(inlineOr(n, ctx, ""))])],
  text: (n, ctx) => [em(inlineOr(n, ctx, ""))],
};

/** `` `[label]` `` button-ish chip (inline code so brackets never escape). */
const bracket: AsciiEntry = {
  flow: (n, ctx) => [para([icode(`[${ctx.text(n)}]`)])],
  text: (n, ctx) => [icode(`[${ctx.text(n)}]`)],
};

const chip: AsciiEntry = {
  flow: (n, ctx) => [para([icode(ctx.text(n))])],
  text: (n, ctx) => [icode(ctx.text(n))],
};

const quoteWrap: AsciiEntry = {
  flow: (n, ctx) => [quote(ctx.children(n))],
};

const sep: AsciiEntry = { flow: () => [thematic()], text: () => [txt(" · ")] };

/** Menu/command item: `- label — shortcut`. */
const menuItem: AsciiEntry = {
  flow: (n, ctx) => [
    para([
      txt("- "),
      ...ctx.inline(n),
      ...(nonEmpty(attr(n, "shortcut"))
        ? [txt(" — "), icode(attr(n, "shortcut") ?? "")]
        : []),
    ]),
  ],
  text: (n, ctx) => ctx.inline(n),
};

/** `[x]`/`[ ]`/`( )` control from a checked-ish attribute. */
const controlOn = (n: MdxTarget): boolean => {
  if (flag(n, "checked") || flagOff(n, "checked")) {
    return flag(n, "checked");
  }
  return flag(n, "defaultChecked") || flag(n, "pressed");
};

const control = (mark: (on: boolean) => string): AsciiEntry => ({
  flow: (n, ctx) => {
    const inner = ctx.inline(n);
    const label = attr(n, "label");
    return [
      para([
        icode(mark(controlOn(n))),
        ...(inner.length === 0 ? [] : [txt(" "), ...inner]),
        ...(nonEmpty(label) ? [txt(` ${label}`)] : []),
      ]),
    ];
  },
  text: (n, ctx) => [
    icode(mark(controlOn(n))),
    ...(ctx.inline(n).length === 0 ? [] : [txt(" "), ...ctx.inline(n)]),
  ],
});

/** `` `[____]` ``-style empty input stand-in. */
const inputText = (n: MdxTarget): string => {
  const value = attr(n, "value") ?? attr(n, "defaultValue");
  if (value !== undefined) {
    return attr(n, "type") === "password" ? "••••" : value;
  }
  return attr(n, "placeholder") ?? attr(n, "label") ?? "____";
};

const input: AsciiEntry = {
  flow: (n) => [pre(`[ ${inputText(n)} ]`)],
  text: (n) => [icode(`[${inputText(n)}]`)],
};

/* ----------------------------- accordion ---------------------------- */

/** `<details>` disclosure — summary from AccordionTrigger/collapsible label. */
const disclosure = (trigger: string, fallback: string): AsciiEntry => ({
  flow: (n, ctx) => {
    const [head] = els(n, trigger);
    const summary =
      head === undefined ? (attr(n, "label") ?? fallback) : ctx.text(head);
    const rest = ctx.children(withoutEls(n, [trigger]));
    const body = ctx.serialize(rest).trim();
    return [detailsBlock(summary, body)];
  },
});

/* -------------------------------- tabs ------------------------------ */

/** `<Tabs>` → `**tab**` headings + content sections. */
const tabs: AsciiEntry = {
  flow: (n, ctx) => {
    const out: RootContent[] = [];
    for (const c of n.children ?? []) {
      if (named(c, "TabsList")) {
        const labels = els(c, "TabsTrigger").map((t) => {
          const label = ctx.text(t);
          return nonEmpty(label) ? label : (attr(t, "value") ?? "");
        });
        if (labels.length > 0) {
          out.push(para([strong([txt(labels.join("  |  "))])]));
        }
        continue;
      }
      if (named(c, "TabsContent")) {
        const value = attr(c, "value");
        if (nonEmpty(value)) {
          out.push(heading(4, [txt(value)]));
        }
        out.push(...ctx.children(c));
        continue;
      }
      out.push(...ctx.children({ ...n, children: [c] }));
    }
    return out;
  },
};

/* -------------------------------- table ------------------------------ */

interface TRow {
  cells: PhrasingContent[][];
  head: boolean;
}

const tableRows = (nodes: Node[], ctx: AsciiCtx): TRow[] => {
  const rows: TRow[] = [];
  const walk = (n: Node): void => {
    if (named(n, "TableRow")) {
      const cells = (n.children ?? [])
        .filter(
          (c): c is MdxTarget => named(c, "TableCell") || named(c, "TableHead")
        )
        .map((c) => ctx.inline(c));
      rows.push({
        cells,
        head: (n.children ?? []).some((c) => named(c, "TableHead")),
      });
      return;
    }
    if (named(n, "TableCaption")) {
      return;
    }
    if (isParent(n)) {
      for (const c of n.children) {
        walk(c);
      }
    }
  };
  for (const c of nodes) {
    walk(c);
  }
  return rows;
};

const gfmTable: AsciiEntry = {
  flow: (n, ctx) => {
    const rows = tableRows(n.children ?? [], ctx);
    const head = rows.find((r) => r.head) ?? rows[0];
    if (head === undefined) {
      return ctx.children(n);
    }
    const body = rows.filter((r) => r !== head);
    const cap = els(n, "TableCaption");
    return [
      table(
        head.cells,
        body.map((r) => r.cells)
      ),
      ...(cap.length === 0
        ? []
        : [para([em([txt(cap.map((c) => ctx.text(c)).join(" "))])])]),
    ];
  },
};

/* ------------------------------ breadcrumb --------------------------- */

const breadcrumbInline = (n: MdxTarget, ctx: AsciiCtx): PhrasingContent[] => {
  const segments: PhrasingContent[][] = [];
  const walk = (node: Node): void => {
    if (named(node, "BreadcrumbLink") || named(node, "BreadcrumbPage")) {
      const inner = ctx.inline(node);
      segments.push(
        nonEmpty(attr(node, "href"))
          ? [link(attr(node, "href") ?? "", inner)]
          : inner
      );
      return;
    }
    if (
      named(node, "BreadcrumbSeparator") ||
      named(node, "BreadcrumbEllipsis")
    ) {
      return;
    }
    if (isParent(node)) {
      for (const c of node.children) {
        walk(c);
      }
    }
  };
  walk(n);
  return segments.flatMap((s, i) => (i === 0 ? s : [txt(" / "), ...s]));
};

const breadcrumb: AsciiEntry = {
  flow: (n, ctx) => [para(breadcrumbInline(n, ctx))],
  text: (n, ctx) => breadcrumbInline(n, ctx),
};

/* ------------------------------ progress ----------------------------- */

const frac = (n: MdxTarget): { text: string; v: number } => {
  const value = num(n, "value") ?? 0;
  const max = num(n, "max") ?? 100;
  return {
    text: `${attr(n, "value") ?? Math.round(value)}${nonEmpty(attr(n, "max")) ? `/${attr(n, "max")}` : "%"}`,
    v: max <= 0 ? 0 : Math.max(0, Math.min(1, value / max)),
  };
};

const progress: AsciiEntry = {
  flow: (n) => {
    const { text, v } = frac(n);
    return [pre(`[${bar(v, 16)}] ${text}`)];
  },
  text: (n) => {
    const { text, v } = frac(n);
    return [icode(`[${bar(v, 8)}] ${text}`)];
  },
};

const sliderBar = (n: MdxTarget): string => {
  const { text, v } = frac(n);
  const W = 12;
  const pos = Math.round(v * W);
  return `[${"─".repeat(pos)}●${"─".repeat(W - pos)}] ${attr(n, "value") ?? text}`;
};

const slider: AsciiEntry = {
  flow: (n) => [pre(sliderBar(n))],
  text: (n) => [icode(sliderBar(n))],
};

/* --------------------------- name → behavior ------------------------- */

const SKELETON: AsciiEntry = {
  flow: () => [pre("[▒▒▒▒▒▒]")],
  text: () => [icode("[▒▒▒]")],
};

const IMAGE: AsciiEntry = {
  flow: (n) => [
    para([
      {
        alt: attr(n, "alt") ?? attr(n, "label") ?? "image",
        type: "image",
        url: attr(n, "src") ?? "",
      },
    ]),
  ],
  text: (n) => [
    {
      alt: attr(n, "alt") ?? attr(n, "label") ?? "image",
      type: "image",
      url: attr(n, "src") ?? "",
    },
  ],
};

const calendar: AsciiEntry = {
  flow: (n) => [
    pre(
      `[calendar${nonEmpty(attr(n, "value")) ? `: ${attr(n, "value")}` : ""}]`
    ),
  ],
  text: (n) => [
    icode(
      `[calendar${nonEmpty(attr(n, "value")) ? `: ${attr(n, "value")}` : ""}]`
    ),
  ],
};

const otp: AsciiEntry = {
  flow: (n) => {
    const slots = els(n, "InputOTPGroup").flatMap((g) =>
      els(g, "InputOTPSlot")
    );
    const own = els(n, "InputOTPSlot");
    const count = Math.max(slots.length, own.length, num(n, "maxLength") ?? 6);
    return [pre(`[ ${"_ ".repeat(count).trim()} ]`)];
  },
  text: (n) => {
    const count = Math.max(0, num(n, "maxLength") ?? 6);
    return [icode(`[${"_".repeat(count)}]`)];
  },
};

/** - `- item — shortcut` inside a menu/command list. */
const listWrap = (itemNames: string[]): AsciiEntry => ({
  flow: (n, ctx) => {
    const items: ListItem[] = [];
    const rest: Node[] = [];
    for (const c of n.children ?? []) {
      if (itemNames.some((name) => named(c, name))) {
        items.push(
          item([
            para([
              ...ctx.inline(c),
              ...(nonEmpty(attr(c, "shortcut"))
                ? [txt(" — "), icode(attr(c, "shortcut") ?? "")]
                : []),
            ]),
          ])
        );
      } else {
        rest.push(c);
      }
    }
    return [
      ...(items.length === 0 ? [] : [list(items)]),
      ...ctx.children({ ...n, children: rest }),
    ];
  },
});

// oxlint-disable sort-keys -- keys grouped by component family, not alphabet
export const shadcnRenderers: AsciiRegistry = {
  // Disclosures
  Accordion: unwrapFlow,
  AccordionItem: disclosure("AccordionTrigger", "Section"),
  AccordionContent: unwrapFlow,
  AccordionTrigger: strongPara,
  Collapsible: disclosure("CollapsibleTrigger", "Details"),
  CollapsibleContent: unwrapFlow,
  CollapsibleTrigger: strongPara,

  // Callouts & text emphasis
  Alert: quoteWrap,
  AlertTitle: strongPara,
  AlertDescription: emPara,
  AlertDialog: unwrapFlow,
  AlertDialogTitle: strongPara,
  AlertDialogDescription: emPara,
  Toast: quoteWrap,
  ToastTitle: strongPara,
  ToastDescription: emPara,

  // Cards & framed sections
  Card: quoteWrap,
  CardHeader: unwrapFlow,
  CardTitle: strongPara,
  CardDescription: emPara,
  CardContent: unwrapFlow,
  CardFooter: unwrapFlow,
  Frame: quoteWrap,
  FrameTitle: strongPara,
  FrameDescription: emPara,
  ItemTitle: strongPara,
  ItemDescription: emPara,
  EmptyTitle: strongPara,
  EmptyDescription: emPara,
  Message: quoteWrap,
  Bubble: quoteWrap,
  FieldsetLegend: strongPara,
  FieldLegend: strongPara,
  FieldTitle: strongPara,
  FieldLabel: strongPara,
  Label: strongPara,

  // Inline chips & controls
  Badge: chip,
  Kbd: chip,
  KbdGroup: chip,
  Button: bracket,
  Toggle: bracket,
  ToggleGroupItem: bracket,
  ButtonGroupText: chip,
  Avatar: { text: (n) => [txt(`[${attr(n, "alt") ?? "avatar"}]`)] },
  AvatarFallback: { text: (n, ctx) => [txt(`[${ctx.text(n) || "…"}]`)] },
  AvatarImage: IMAGE,
  Checkbox: control((on) => (on ? "[x]" : "[ ]")),
  Switch: control((on) => (on ? "[x]" : "[ ]")),
  RadioGroupItem: control((on) => (on ? "(x)" : "( )")),
  ToggleGroup: unwrapFlow,

  // Inputs
  Input: input,
  InputGroupInput: input,
  InputGroupTextarea: input,
  InputOTP: otp,
  InputOTPSlot: { text: () => [txt("_")] },
  Textarea: input,
  SidebarInput: input,
  CommandInput: input,
  ComboboxInput: input,
  NativeSelect: { text: (n) => [txt(`[${attr(n, "value") ?? "select ▾"}]`)] },
  Select: {
    flow: (n, ctx) => [
      para([txt(`[${attr(n, "placeholder") ?? "select ▾"}]`)]),
      ...ctx.children(n),
    ],
  },
  SelectItem: menuItem,
  NativeSelectOption: menuItem,
  SelectValue: { text: (n, ctx) => inlineOr(n, ctx, "…") },

  // Meters
  Progress: progress,
  ProgressIndicator: progress,
  ProgressValue: { text: (n) => [txt(`${attr(n, "value") ?? ""}%`)] },
  Meter: progress,
  MeterIndicator: progress,
  MeterValue: { text: (n) => [txt(attr(n, "value") ?? "")] },
  Slider: slider,
  QuestionnaireProgress: progress,

  // Tables & lists
  Table: gfmTable,
  Command: listWrap(["CommandItem"]),
  CommandItem: menuItem,
  CommandShortcut: { text: (n, ctx) => [icode(ctx.text(n))] },
  Menubar: listWrap(["MenubarItem"]),
  MenubarItem: menuItem,
  MenubarMenu: unwrapFlow,
  MenubarContent: listWrap([
    "MenubarItem",
    "MenubarCheckboxItem",
    "MenubarRadioItem",
  ]),
  DropdownMenu: unwrapFlow,
  DropdownMenuContent: listWrap([
    "DropdownMenuItem",
    "DropdownMenuCheckboxItem",
    "DropdownMenuRadioItem",
  ]),
  DropdownMenuItem: menuItem,
  DropdownMenuCheckboxItem: menuItem,
  DropdownMenuRadioItem: menuItem,
  DropdownMenuSub: unwrapFlow,
  DropdownMenuSubContent: listWrap(["DropdownMenuItem"]),
  ContextMenu: unwrapFlow,
  ContextMenuContent: listWrap([
    "ContextMenuItem",
    "ContextMenuCheckboxItem",
    "ContextMenuRadioItem",
  ]),
  ContextMenuItem: menuItem,
  NavigationMenu: unwrapFlow,
  NavigationMenuList: {
    flow: (n, ctx) => [
      para(
        els(n, "NavigationMenuItem").flatMap((it, i): PhrasingContent[] => [
          ...(i === 0 ? [] : [txt("  |  ")]),
          ...ctx.inline(it),
        ])
      ),
    ],
  },
  NavigationMenuLink: {
    text: (n, ctx) =>
      nonEmpty(attr(n, "href"))
        ? [link(attr(n, "href") ?? "", inlineOr(n, ctx, "link"))]
        : inlineOr(n, ctx, ""),
  },

  // Structure
  Separator: sep,
  ItemSeparator: sep,
  FieldSeparator: sep,
  SidebarSeparator: sep,
  CommandSeparator: sep,
  MenubarSeparator: sep,
  SelectSeparator: sep,
  DropdownMenuSeparator: sep,
  ContextMenuSeparator: sep,
  ButtonGroupSeparator: { text: () => [txt(" | ")] },
  InputOTPSeparator: { text: () => [txt("-")] },
  Tabs: tabs,
  TabsList: unwrapFlow,
  TabsTrigger: { text: (n, ctx) => inlineOr(n, ctx, attr(n, "value") ?? "") },
  Breadcrumb: breadcrumb,
  BreadcrumbList: breadcrumb,
  BreadcrumbLink: {
    text: (n, ctx) =>
      nonEmpty(attr(n, "href"))
        ? [link(attr(n, "href") ?? "", inlineOr(n, ctx, ""))]
        : inlineOr(n, ctx, ""),
  },
  BreadcrumbPage: { text: (n, ctx) => inlineOr(n, ctx, "") },
  BreadcrumbSeparator: { text: () => [txt(" / ")] },
  BreadcrumbEllipsis: { text: () => [txt("…")] },
  Pagination: {
    flow: (n, ctx) => [para([txt("‹ "), ...ctx.inline(n), txt(" ›")])],
  },
  PaginationLink: { text: (n, ctx) => inlineOr(n, ctx, "") },
  PaginationNext: { text: () => [txt("next ›")] },
  PaginationPrevious: { text: () => [txt("‹ prev")] },
  PaginationEllipsis: { text: () => [txt("…")] },

  // Media & misc
  Skeleton: SKELETON,
  SidebarMenuSkeleton: SKELETON,
  Spinner: { text: () => [icode("[…]")] },
  AspectRatio: unwrapFlow,
  Calendar: calendar,
  CarouselItem: unwrapFlow,
  CarouselNext: { text: () => [icode("[›]")] },
  CarouselPrevious: { text: () => [icode("[‹]")] },
  ScrollArea: unwrapFlow,
  ResizablePanel: quoteWrap,
  ResizableHandle: sep,
  Sidebar: unwrapFlow,
  SidebarInset: unwrapFlow,
  Fieldset: quoteWrap,
  FieldSet: quoteWrap,
  FieldGroup: quoteWrap,
  Questionnaire: unwrapFlow,
  QuestionnaireItem: unwrapFlow,
  QuestionnaireTitle: strongPara,
  QuestionnaireDescription: emPara,
  QuestionnaireChoice: control((on) => (on ? "(x)" : "( )")),
  QuestionnaireChoices: unwrapFlow,
  Marker: { text: (n, ctx) => [txt(`◈ ${ctx.text(n)}`)] },
  Tooltip: unwrapFlow,
  TooltipContent: emPara,
  Popover: unwrapFlow,
  PopoverContent: quoteWrap,
  HoverCard: unwrapFlow,
  HoverCardContent: quoteWrap,
  Dialog: unwrapFlow,
  DialogContent: quoteWrap,
  DialogTitle: strongPara,
  DialogDescription: emPara,
  Sheet: unwrapFlow,
  SheetContent: quoteWrap,
  SheetTitle: strongPara,
  SheetDescription: emPara,
  Drawer: unwrapFlow,
  DrawerContent: quoteWrap,
  DrawerTitle: strongPara,
  DrawerDescription: emPara,
  AlertDialogContent: quoteWrap,
};
