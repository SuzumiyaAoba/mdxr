import type { Meta, StoryObj } from "@storybook/react-vite";

import { Matrix } from "../src/ui/matrix.js";

const meta = {
  component: Matrix,
  title: "Components/Matrix",
} satisfies Meta<typeof Matrix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RendererCompare: Story = {
  render: () => (
    <Matrix cols="mdxr, raw mdx, astro" title="Renderer comparison">
      <ul>
        <li>markdown | yes | yes | yes</li>
        <li>jsx components | yes | yes | partial</li>
        <li>standalone html | yes | no | partial</li>
        <li>editor links | yes | no | no</li>
        <li>hydration | no | yes | yes</li>
      </ul>
    </Matrix>
  ),
};

export const NoHeaders: Story = {
  render: () => (
    <Matrix>
      <ul>
        <li>graphs | yes | ~</li>
        <li>charts | yes | yes</li>
      </ul>
    </Matrix>
  ),
};
