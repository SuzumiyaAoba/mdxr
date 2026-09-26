// Stack/Section adapted from wireframe-ui (MIT). See src/wireframe-ui.LICENSE.md.
import { cn } from "cn";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { WIREFRAME_COMMON } from "./wireframe-props.js";

const DEVICES = {
  desktop: "max-w-full",
  mobile: "max-w-[390px]",
  tablet: "max-w-[768px]",
};

export const Wireframe = defineComponent(
  {
    description:
      "Screen mockup built with wireframe-ui components. Responsive desktop/tablet/mobile frame; combine with existing mdxr layouts and shadcn controls.",
    schema: v.looseObject({
      ...WIREFRAME_COMMON,
      device: v.optional(
        v.picklist(["desktop", "tablet", "mobile"]),
        "desktop"
      ),
      title: v.optional(v.string(), "Wireframe"),
    }),
  },
  ({ children, className, device, id, title }) => (
    <figure
      className={cn(
        "not-prose bg-background text-foreground mx-auto my-6 w-full min-w-0 overflow-hidden rounded-xl border shadow-sm",
        DEVICES[device],
        className
      )}
      data-device={device}
      data-slot="wireframe"
      id={id}
    >
      <figcaption className="bg-muted/40 text-muted-foreground flex items-center gap-3 border-b px-4 py-3 text-xs">
        <span aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="size-2 rounded-full border" />
          <span className="size-2 rounded-full border" />
          <span className="size-2 rounded-full border" />
        </span>
        <span className="min-w-0 break-words">{title}</span>
      </figcaption>
      <div className="@container/wireframe min-w-0 p-4">{children}</div>
    </figure>
  )
);

export { WireframeStack } from "./wireframe-library-stack.js";
export { WireframeSection } from "./wireframe-library-section.js";
