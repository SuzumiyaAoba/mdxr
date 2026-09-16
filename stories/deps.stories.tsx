import type { Meta, StoryObj } from "@storybook/react-vite";

import { Dep, Deps } from "../src/ui/deps.js";

const meta = {
  component: Deps,
  title: "Components/Deps",
} satisfies Meta<typeof Deps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ModuleGraph: Story = {
  render: () => (
    <Deps title="Module dependencies">
      <Dep from="src/cli.ts" to="src/render.ts" kind="calls">
        renderFile()
      </Dep>
      <Dep from="src/render.ts" to="src/mdx.ts" kind="calls" />
      <Dep from="src/mdx.ts" to="remark-gfm" kind="imports" />
      <Dep from="src/mdx.ts" to="src/assets.ts" kind="reads">
        BASE_CSS
      </Dep>
      <Dep from="src/render.ts" to="dist/out.html" kind="writes" />
    </Deps>
  ),
};

export const TypeRelations: Story = {
  render: () => (
    <Deps>
      <Dep from="MdxError" to="Error" kind="extends" />
      <Dep from="Step" to="DocComponent" kind="implements" />
    </Deps>
  ),
};
