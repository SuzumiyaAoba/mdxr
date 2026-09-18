import * as v from "valibot";

import * as accordion from "../components/ui/accordion.js";
import * as alertDialog from "../components/ui/alert-dialog.js";
import * as alert from "../components/ui/alert.js";
import * as aspectRatio from "../components/ui/aspect-ratio.js";
import * as attachment from "../components/ui/attachment.js";
import * as avatar from "../components/ui/avatar.js";
import * as badge from "../components/ui/badge.js";
import * as breadcrumb from "../components/ui/breadcrumb.js";
import * as bubble from "../components/ui/bubble.js";
import * as buttonGroup from "../components/ui/button-group.js";
import * as button from "../components/ui/button.js";
import * as calendar from "../components/ui/calendar.js";
import * as card from "../components/ui/card.js";
import * as carousel from "../components/ui/carousel.js";
import * as chart from "../components/ui/chart.js";
import * as checkbox from "../components/ui/checkbox.js";
import * as collapsible from "../components/ui/collapsible.js";
import * as combobox from "../components/ui/combobox.js";
import * as command from "../components/ui/command.js";
import * as contextMenu from "../components/ui/context-menu.js";
import * as dialog from "../components/ui/dialog.js";
import * as direction from "../components/ui/direction.js";
import * as drawer from "../components/ui/drawer.js";
import * as dropdownMenu from "../components/ui/dropdown-menu.js";
import * as empty from "../components/ui/empty.js";
import * as field from "../components/ui/field.js";
import * as fieldset from "../components/ui/fieldset.js";
import * as frame from "../components/ui/frame.js";
import * as hoverCard from "../components/ui/hover-card.js";
import * as inputGroup from "../components/ui/input-group.js";
import * as inputOtp from "../components/ui/input-otp.js";
import * as input from "../components/ui/input.js";
import * as item from "../components/ui/item.js";
import * as kbd from "../components/ui/kbd.js";
import * as label from "../components/ui/label.js";
import * as marker from "../components/ui/marker.js";
import * as menubar from "../components/ui/menubar.js";
import * as messageScroller from "../components/ui/message-scroller.js";
import * as message from "../components/ui/message.js";
import * as meter from "../components/ui/meter.js";
import * as nativeSelect from "../components/ui/native-select.js";
import * as navigationMenu from "../components/ui/navigation-menu.js";
import * as pagination from "../components/ui/pagination.js";
import * as popover from "../components/ui/popover.js";
import * as progress from "../components/ui/progress.js";
import * as questionnaire from "../components/ui/questionnaire.js";
import * as radioGroup from "../components/ui/radio-group.js";
import * as resizable from "../components/ui/resizable.js";
import * as scrollArea from "../components/ui/scroll-area.js";
import * as select from "../components/ui/select.js";
import * as separator from "../components/ui/separator.js";
import * as sheet from "../components/ui/sheet.js";
import * as sidebar from "../components/ui/sidebar.js";
import * as skeleton from "../components/ui/skeleton.js";
import * as slider from "../components/ui/slider.js";
import * as spinner from "../components/ui/spinner.js";
import * as switch_ from "../components/ui/switch.js";
import * as table from "../components/ui/table.js";
import * as tabs from "../components/ui/tabs.js";
import * as textarea from "../components/ui/textarea.js";
import * as toast from "../components/ui/toast.js";
import * as toggleGroup from "../components/ui/toggle-group.js";
import * as toggle from "../components/ui/toggle.js";
import * as tooltip from "../components/ui/tooltip.js";
import type { AnyComponent, ComponentMap, DocProps } from "../define.js";
import { defineComponent } from "../define.js";
import { isComponent, safeHref } from "../guards.js";

/**
 * URL-bearing props get a scriptable-scheme check before reaching the DOM —
 * `looseObject` props mean `<BreadcrumbLink href="javascript:…">` would
 * otherwise land on `<a href>` unchecked.
 */
const URL_PROPS = new Set([
  "action",
  "background",
  "data",
  "formaction",
  "href",
  "poster",
  "src",
  "xlinkhref",
]);

const sanitizeProps = (props: Record<string, unknown>): DocProps => {
  const out: Record<string, unknown> = { ...props };
  for (const k of Object.keys(out)) {
    if (URL_PROPS.has(k.toLowerCase()) && typeof out[k] === "string") {
      out[k] = safeHref(out[k]);
    }
  }
  return out;
};

const MODULES: Record<string, Record<string, unknown>> = {
  accordion,
  alert,
  "alert-dialog": alertDialog,
  "aspect-ratio": aspectRatio,
  attachment,
  avatar,
  badge,
  breadcrumb,
  bubble,
  button,
  "button-group": buttonGroup,
  calendar,
  card,
  carousel,
  chart,
  checkbox,
  collapsible,
  combobox,
  command,
  "context-menu": contextMenu,
  dialog,
  direction,
  drawer,
  "dropdown-menu": dropdownMenu,
  empty,
  field,
  fieldset,
  frame,
  "hover-card": hoverCard,
  input,
  "input-group": inputGroup,
  "input-otp": inputOtp,
  item,
  kbd,
  label,
  marker,
  menubar,
  message,
  "message-scroller": messageScroller,
  meter,
  "native-select": nativeSelect,
  "navigation-menu": navigationMenu,
  pagination,
  popover,
  progress,
  questionnaire,
  "radio-group": radioGroup,
  resizable,
  "scroll-area": scrollArea,
  select,
  separator,
  sheet,
  sidebar,
  skeleton,
  slider,
  spinner,
  switch: switch_,
  table,
  tabs,
  textarea,
  toast,
  toggle,
  "toggle-group": toggleGroup,
  tooltip,
};

/**
 * Wrap a shadcn/ui (Base UI) component for the document catalog. Props stay
 * loose — MDX attributes arrive as strings — and each entry gets a catalog
 * description noting that interactive parts come alive via hydration.
 */
const wrap = (
  moduleName: string,
  exportName: string,
  Comp: AnyComponent
): AnyComponent =>
  defineComponent(
    {
      description: `shadcn/ui ${exportName} (${moduleName}) — Base UI; interactive after hydration.`,
      schema: v.looseObject({}),
    },
    (props) => <Comp {...sanitizeProps(props)} />
  );

/**
 * Every PascalCase function export of `src/components/ui/*`, keyed by export
 * name. Lowercase helpers (cva variants, hooks) and non-component constants
 * are skipped by the `isComponent` + name filter.
 */
export const shadcnComponents: ComponentMap = Object.fromEntries(
  Object.entries(MODULES).flatMap(([moduleName, mod]) =>
    Object.entries(mod).flatMap(([name, comp]) =>
      /^[A-Z]/u.test(name) && isComponent(comp)
        ? [[name, wrap(moduleName, name, comp)]]
        : []
    )
  )
);

/**
 * shadcn export name → module specifier relative to this directory
 * (`../components/ui/<name>.js`). The hydration bundle resolves each used
 * component straight to its leaf module — the barrel would defeat
 * tree-shaking.
 */
export const shadcnModules: Record<string, string> = Object.fromEntries(
  Object.entries(MODULES).flatMap(([moduleName, mod]) =>
    Object.keys(mod)
      .filter((name) => /^[A-Z]/u.test(name) && isComponent(mod[name]))
      .map((name) => [name, `../components/ui/${moduleName}.js`])
  )
);
