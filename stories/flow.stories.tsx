import type { Meta, StoryObj } from "@storybook/react-vite";

import { Flow, FlowStep } from "../src/ui/flow.js";

const meta = {
  component: Flow,
  title: "Components/Flow",
} satisfies Meta<typeof Flow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CallChain: Story = {
  render: () => (
    <Flow title="Request path">
      <FlowStep name="cli()" path="src/cli.ts" lines="12-30">
        Parses argv and loads mdxr.config.ts.
      </FlowStep>
      <FlowStep name="renderFile()" path="src/render.ts">
        Reads the document and compiles Tailwind for the used classes.
      </FlowStep>
      <FlowStep name="mdxToHtml()" path="src/mdx.ts" lines="70-106">
        Runs remark plugins, evaluates MDX, returns body + frontmatter.
      </FlowStep>
      <FlowStep name="renderToStaticMarkup()">
        Produces the final HTML — no hydration, no client runtime.
      </FlowStep>
    </Flow>
  ),
};

export const NoTitle: Story = {
  render: () => (
    <Flow>
      <FlowStep name="read()">Load the source file.</FlowStep>
      <FlowStep name="parse()">Build the AST.</FlowStep>
    </Flow>
  ),
};

export const StandaloneStep: Story = {
  render: () => (
    <div>
      <p>A step used outside a Flow — no number is shown.</p>
      <ul className="not-prose m-0 list-none p-0">
        <FlowStep name="helper()" path="src/util.ts" />
      </ul>
    </div>
  ),
};
