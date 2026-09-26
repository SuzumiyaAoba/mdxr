import * as v from "valibot";

import { isRecord, safeHref } from "../guards.js";
import { attrTrue, NUMISH } from "../ui/attrs.js";
import {
  wireframeCount,
  WIREFRAME_TEXT_PROPS,
  WIREFRAME_WIDTH,
  WIREFRAME_SPACING,
} from "../ui/wireframe-props.js";

const boolean = v.pipe(
  v.union([v.boolean(), v.picklist(["", "true", "false"])]),
  v.transform((value) => attrTrue(value))
);
const number = v.pipe(NUMISH, v.transform(Number), v.finite());
const string = v.optional(v.string());

const parseJson = (source: string): unknown => {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error("Invalid wireframe JSON attribute: expected valid JSON.");
  }
};

const json = <S extends v.GenericSchema>(schema: S) =>
  v.union([schema, v.pipe(v.string(), v.transform(parseJson), schema)]);
const record = v.record(v.string(), v.unknown());
const chartConfig = v.record(
  v.string(),
  v.looseObject({
    color: v.optional(v.string()),
    icon: v.optional(v.unknown()),
    label: v.optional(v.unknown()),
    theme: v.optional(v.object({ dark: v.string(), light: v.string() })),
  })
);
const numericList = v.union([
  json(v.array(number)),
  v.pipe(
    number,
    v.transform((value) => [value])
  ),
]);
const stringList = json(v.array(v.string()));
const dimension = v.object({
  size: v.optional(v.picklist(["xs", "sm", "base", "lg", "xl"])),
  width: v.optional(WIREFRAME_WIDTH),
});

const BOOLEAN_PROPS = [
  "asChild",
  "autoFocus",
  "avoidCollisions",
  "decorative",
  "disableHoverableContent",
  "dismissible",
  "handleOnly",
  "hidden",
  "hideWhenDetached",
  "noBodyStyles",
  "shouldScaleBackground",
  "checked",
  "collapsible",
  "defaultChecked",
  "defaultOpen",
  "defaultPressed",
  "disabled",
  "forceMount",
  "hideIcon",
  "hideIndicator",
  "hideLabel",
  "inset",
  "inverted",
  "isActive",
  "loading",
  "loop",
  "modal",
  "multiple",
  "open",
  "pressed",
  "readOnly",
  "required",
  "showIcon",
  "truncate",
];
const NUMBER_PROPS = [
  "alignOffset",
  "closeDelay",
  "delayDuration",
  "duration",
  "maxLength",
  "minStepsBetweenThumbs",
  "openDelay",
  "sideOffset",
  "skeletonMaxLength",
  "skipDelayDuration",
  "tabIndex",
];

const COMMON = {
  ...Object.fromEntries(BOOLEAN_PROPS.map((key) => [key, v.optional(boolean)])),
  ...Object.fromEntries(NUMBER_PROPS.map((key) => [key, v.optional(number)])),
  className: string,
  id: string,
  style: v.optional(json(record)),
};

/** Component-specific props stay introspectable in `mdxr catalog --json`. */
const placeholderEntries = (name: string): v.ObjectEntries | undefined => {
  switch (name) {
    case "Text":
    case "TextHeading":
    case "TextParagraph":
    case "TextCaption":
    case "TextLabel": {
      return {
        ...(name === "Text" ? WIREFRAME_TEXT_PROPS : {}),
        animate: v.optional(v.picklist(["none", "pulse", "shimmer", "typing"])),
        hideOn: v.optional(json(v.array(v.picklist(["sm", "md", "lg", "xl"])))),
        label: string,
        responsive: v.optional(
          json(
            v.object({
              base: v.optional(dimension),
              lg: v.optional(dimension),
              md: v.optional(dimension),
              sm: v.optional(dimension),
              xl: v.optional(dimension),
            })
          )
        ),
        width: v.optional(WIREFRAME_WIDTH),
      };
    }
    case "Paragraph": {
      return {
        ...WIREFRAME_TEXT_PROPS,
        label: string,
        lastLineWidth: v.optional(WIREFRAME_WIDTH),
        lines: v.optional(wireframeCount(50), 3),
        spacing: WIREFRAME_SPACING,
      };
    }
    case "Heading": {
      return {
        as: v.optional(v.picklist(["h1", "h2", "h3", "h4", "h5", "h6", "div"])),
        label: string,
        level: v.optional(wireframeCount(6), 2),
      };
    }
    case "ListGroup": {
      return {
        itemWidth: v.optional(WIREFRAME_WIDTH),
        items: v.optional(wireframeCount(50), 3),
        label: string,
        size: WIREFRAME_TEXT_PROPS.size,
        spacing: WIREFRAME_SPACING,
        variant: v.optional(v.picklist(["bullet", "number", "none"])),
      };
    }
    case "Button": {
      return {
        href: string,
        label: string,
        size: v.optional(v.picklist(["default", "sm", "lg", "icon"])),
        variant: v.optional(
          v.picklist([
            "default",
            "outline",
            "secondary",
            "ghost",
            "destructive",
            "link",
          ])
        ),
      };
    }
    case "Card": {
      return {
        wireframe: v.optional(v.picklist(["none", "compact", "detailed"])),
      };
    }
    case "Avatar": {
      return {
        label: string,
        size: v.optional(v.picklist(["sm", "md", "lg"])),
      };
    }
    case "Input": {
      return {
        autoComplete: string,
        defaultValue: v.optional(NUMISH),
        label: string,
        name: string,
        placeholder: string,
        type: string,
        variant: v.optional(v.picklist(["default", "wireframe"]), "wireframe"),
      };
    }
    case "Textarea": {
      return {
        defaultValue: string,
        label: string,
        name: string,
        placeholder: string,
        rows: v.optional(wireframeCount(30), 3),
        skeletonLines: v.optional(wireframeCount(50)),
        variant: v.optional(v.picklist(["default", "wireframe"]), "wireframe"),
      };
    }
    case "Media": {
      return {
        alt: string,
        aspectRatio: v.optional(
          v.picklist(["square", "video", "portrait", "auto"])
        ),
        captions: string,
        label: string,
        src: string,
        type: v.optional(v.picklist(["image", "video", "audio"])),
      };
    }
    case "Stack": {
      return {
        align: v.optional(v.picklist(["start", "center", "end", "stretch"])),
        direction: v.optional(v.picklist(["vertical", "horizontal"])),
        justify: v.optional(
          v.picklist(["start", "center", "end", "between", "around"])
        ),
        spacing: v.optional(v.picklist(["xs", "sm", "md", "lg", "xl"])),
      };
    }
    case "Section": {
      return {
        spacing: WIREFRAME_SPACING,
        variant: v.optional(
          v.picklist(["custom", "hero", "content-two-column", "feature-grid"])
        ),
      };
    }
    default: {
      return undefined;
    }
  }
};

const interactiveEntries = (name: string): v.ObjectEntries => {
  switch (name) {
    case "Sidebar": {
      return {
        collapsible: v.optional(v.picklist(["offcanvas", "icon", "none"])),
      };
    }
    case "Slider": {
      return {
        defaultValue: v.optional(numericList),
        max: v.optional(number),
        min: v.optional(number),
        step: v.optional(number),
        value: v.optional(numericList),
      };
    }
    case "Accordion": {
      return {
        defaultValue: v.optional(v.union([v.string(), v.array(v.string())])),
        type: v.optional(v.picklist(["single", "multiple"]), "single"),
        value: v.optional(v.union([v.string(), v.array(v.string())])),
      };
    }
    case "Checkbox":
    case "ContextMenuCheckboxItem":
    case "MenubarCheckboxItem": {
      return {
        checked: v.optional(v.union([boolean, v.literal("indeterminate")])),
        defaultChecked: v.optional(
          v.union([boolean, v.literal("indeterminate")])
        ),
      };
    }
    case "Carousel": {
      return {
        opts: v.optional(json(record)),
        orientation: v.optional(v.picklist(["horizontal", "vertical"])),
      };
    }
    case "Form": {
      return {
        defaultValues: v.optional(json(record)),
        mode: v.optional(
          v.picklist(["onBlur", "onChange", "onSubmit", "onTouched", "all"])
        ),
      };
    }
    case "FormField": {
      return { name: v.string(), rules: v.optional(json(record)) };
    }
    case "FieldError": {
      return {
        errors: v.optional(
          json(v.array(v.optional(v.object({ message: string }))))
        ),
      };
    }
    case "ChartContainer":
    case "ChartStyle": {
      return {
        config: v.optional(json(chartConfig), {}),
        initialDimension: v.optional(
          json(v.object({ height: number, width: number }))
        ),
      };
    }
    case "ChartTooltipContent":
    case "ChartLegendContent": {
      return { payload: v.optional(json(v.array(record))) };
    }
    case "ChartWireframe": {
      return {
        variant: v.optional(v.picklist(["bar", "line", "pie", "area"])),
      };
    }
    case "Drawer": {
      return {
        snapPoints: v.optional(
          json(v.array(v.union([v.number(), v.string()])))
        ),
      };
    }
    default: {
      return {};
    }
  }
};

const URL_PROPS = new Set([
  "action",
  "background",
  "data",
  "formaction",
  "href",
  "poster",
  "src",
  "xlinkhref",
  "captions",
]);

const sanitizeDomProps = (
  props: Record<string, unknown>
): Record<string, unknown> => {
  const out = { ...props };
  for (const [key, value] of Object.entries(out)) {
    const name = key.toLowerCase();
    if (name === "dangerouslysetinnerhtml" || name === "srcdoc") {
      throw new Error("Raw HTML is not supported in wireframe attributes.");
    }
    if (URL_PROPS.has(name) && typeof value === "string") {
      out[key] = safeHref(value);
    }
  }
  if (out.target === "_blank") {
    out.rel = "noopener noreferrer";
  }
  return out;
};

export const wireframeSchema = (name: string) =>
  v.looseObject({
    ...COMMON,
    ...(placeholderEntries(name) ?? interactiveEntries(name)),
  });

export const normalizeWireframeProps = (
  name: string,
  props: Record<string, unknown>
): Record<string, unknown> => {
  const out = sanitizeDomProps(props);
  if (name === "Accordion" && out.type === "multiple") {
    for (const key of ["value", "defaultValue"]) {
      if (typeof out[key] === "string") {
        out[key] = v.parse(stringList, out[key]);
      }
    }
  }
  if (
    name === "SidebarMenuButton" &&
    typeof out.tooltip === "string" &&
    out.tooltip.startsWith("{")
  ) {
    const parsed = parseJson(out.tooltip);
    if (isRecord(parsed)) {
      out.tooltip = sanitizeDomProps(parsed);
    }
  }
  return out;
};
