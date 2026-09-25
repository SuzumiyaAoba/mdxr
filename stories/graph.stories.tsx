import type { Meta, StoryObj } from "@storybook/react-vite";

import { Edge, Graph, Node } from "../src/ui/graph.js";

const meta = {
  component: Graph,
  title: "Components/Graph",
} satisfies Meta<typeof Graph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pipeline: Story = {
  render: () => (
    <Graph title="mdx → html pipeline">
      <Node id="mdx" label="plan.mdx" path="examples/plan.mdx" />
      <Node id="compile" label="evaluate" icon="lucide:cog" />
      <Node id="render" label="renderToStaticMarkup" note="react-dom/server" />
      <Node id="html" label="out.html" path="examples/out.html" />
      <Edge from="mdx" to="compile" kind="reads" />
      <Edge from="compile" to="render" kind="calls" />
      <Edge from="render" to="html" kind="writes" label="static markup" />
    </Graph>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Graph direction="right" title="layers">
      <Node id="ui" label="components" status="done" />
      <Node id="remark" label="remark plugins" status="doing" />
      <Node id="mdx" label="@mdx-js" external="true" />
      <Edge from="ui" to="remark" kind="calls" />
      <Edge from="remark" to="mdx" kind="imports" />
    </Graph>
  ),
};

export const Fitting: Story = {
  render: () => (
    <div style={{ maxWidth: "100%", width: 480 }}>
      <Graph title="Responsive pipeline" direction="right" minScale="0.65">
        <Node id="ui" label="Application interface" />
        <Node id="session" label="Session service" />
        <Node id="core" label="Independent execution core" />
        <Edge from="ui" to="session" />
        <Edge from="session" to="core" />
      </Graph>
    </div>
  ),
};
