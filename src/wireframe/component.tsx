import { cn } from "cn";

import { defineComponent } from "../define.js";
import { isComponent } from "../guards.js";
import { normalizeWireframeProps, wireframeSchema } from "./props.js";

/** Leaf adapters are shared by SSR and hydration, including MDX prop coercion. */
export const wrapWireframe = (
  name: string,
  component: unknown,
  family: string,
  block = false
) => {
  if (!isComponent(component)) {
    throw new Error(`Invalid wireframe-ui export: ${name}`);
  }
  const Component = component;
  return defineComponent(
    {
      description: `wireframe-ui ${name} (${family})${block ? " — complete screen block" : ""}; upstream props plus MDX string attributes.`,
      schema: wireframeSchema(name),
    },
    (props) => {
      const normalized = normalizeWireframeProps(name, props);
      if (block) {
        return (
          <div
            className={cn(
              "not-prose min-w-0",
              typeof props.className === "string" && props.className
            )}
            data-wireframe-block={family}
            id={typeof props.id === "string" ? props.id : undefined}
          >
            <Component {...normalized} />
          </div>
        );
      }
      return <Component {...normalized} />;
    }
  );
};
