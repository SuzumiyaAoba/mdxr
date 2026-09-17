import type { Meta, StoryObj } from "@storybook/react-vite";

import { Trace, TraceFrame } from "../src/ui/trace.js";

const meta = {
  component: Trace,
  title: "Components/Trace",
} satisfies Meta<typeof Trace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StackTrace: Story = {
  render: () => (
    <Trace
      error="TypeError: Cannot read properties of undefined (reading 'kind')"
      title="Crash report"
    >
      <TraceFrame
        name="toMdxComponent"
        path="src/remark/directives.ts"
        lines="64"
      >
        <p>node.attributes is undefined for leaf directives</p>
      </TraceFrame>
      <TraceFrame
        name="visit"
        path="node_modules/unist-util-visit/index.js"
        kind="lib"
      />
      <TraceFrame
        name="remarkRvDirectives"
        path="src/remark/directives.ts"
        lines="91"
      />
      <TraceFrame
        name="process"
        path="node_modules/unified/lib/index.js"
        kind="lib"
      />
    </Trace>
  ),
};

export const Bare: Story = {
  render: () => (
    <Trace>
      <TraceFrame name="renderFile" path="src/render.ts" lines="12-30" />
      <TraceFrame name="mdxToHtml" path="src/mdx.ts" />
    </Trace>
  ),
};
